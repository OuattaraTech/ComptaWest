/**
 * Contrôleur FNE — gère le cycle de certification des factures auprès de
 * la DGI Côte d'Ivoire (modes mock / sandbox / prod).
 *
 * Routes exposées :
 *   POST /factures/:id/certifier-fne   → certifier (idempotent)
 *   GET  /factures/:id/certification   → consulter la certification existante
 *
 * Pré-conditions de certification :
 *   - la facture n'est plus en brouillon (statut envoyee/payee/en_attente/retard)
 *   - la facture n'est pas déjà certifiée (contrainte UNIQUE sur facture_id)
 *
 * Le service `utils/fne.js` calcule numéro + hash + QR. Le contrôleur ne
 * fait qu'orchestrer les vérifications et la persistance.
 */

const pool = require('../../config/database');
const { certifierFacture } = require('../utils/fne');
const { logAudit } = require('../utils/audit');

async function certifierFactureRoute(req, res, next) {
  const client = await pool.connect();
  try {
    const factureId = req.params.id;
    const entrepriseId = req.entrepriseId;

    await client.query('BEGIN');

    // 1) Charger la facture en verrouillant la ligne pour éviter qu'un
    //    appel concurrent ne certifie deux fois la même facture.
    const fact = await client.query(
      `SELECT id, numero, date_emission AS date_facture,
              sous_total AS total_ht, montant_tva AS total_tva,
              total_ttc, devise, statut
         FROM factures
        WHERE id = $1 AND entreprise_id = $2
        FOR UPDATE`,
      [factureId, entrepriseId]
    );
    if (fact.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    const facture = fact.rows[0];

    // 2) Vérifier qu'elle n'est pas en brouillon (on ne certifie que les
    //    factures déjà émises). On accepte les statuts d'émission courants.
    if (!['envoyee', 'en_attente', 'retard', 'payee'].includes(facture.statut)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Seules les factures émises (non brouillon) peuvent être certifiées DGI',
      });
    }

    // 3) Idempotence : si déjà certifiée, on renvoie la certification existante.
    const exist = await client.query(
      'SELECT * FROM factures_certifications_fne WHERE facture_id = $1',
      [factureId]
    );
    if (exist.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.json({
        success: true,
        data: { ...exist.rows[0], deja_certifiee: true },
      });
    }

    // 4) Charger la config FNE de l'entreprise
    const ent = await client.query(
      `SELECT id, ncc, fne_actif, fne_mode, fne_api_key, fne_certificat
         FROM entreprises WHERE id = $1`,
      [entrepriseId]
    );
    const entreprise = ent.rows[0];

    // 5) Appel du service (mock par défaut)
    const cert = await certifierFacture({ facture, entreprise });

    // 6) Persistance
    const ins = await client.query(
      `INSERT INTO factures_certifications_fne
         (facture_id, entreprise_id, numero_fne, hash_facture, qr_data,
          mode, dgi_response_raw, certified_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        factureId, entrepriseId,
        cert.numero_fne, cert.hash_facture, cert.qr_data,
        cert.mode, cert.dgi_response_raw, req.user.id,
      ]
    );

    await client.query('COMMIT');

    logAudit(req, 'CERTIFY_FNE', 'factures', factureId, {
      numero_fne: cert.numero_fne,
      mode: cert.mode,
    });

    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function getCertification(req, res, next) {
  try {
    const r = await pool.query(
      `SELECT c.*, f.numero AS facture_numero
         FROM factures_certifications_fne c
         JOIN factures f ON f.id = c.facture_id
        WHERE c.facture_id = $1 AND c.entreprise_id = $2`,
      [req.params.id, req.entrepriseId]
    );
    if (r.rows.length === 0) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Configuration FNE de l'entreprise — lecture (la clé API n'est jamais
 * renvoyée en clair, seul un flag « set » et un aperçu sont exposés).
 */
async function getFneConfig(req, res, next) {
  try {
    const r = await pool.query(
      `SELECT ncc, centre_fiscal, fne_actif, fne_mode,
              CASE WHEN fne_api_key IS NOT NULL AND fne_api_key <> '' THEN TRUE ELSE FALSE END AS fne_api_key_set,
              CASE WHEN fne_certificat IS NOT NULL AND fne_certificat <> '' THEN TRUE ELSE FALSE END AS fne_certificat_set,
              CASE WHEN fne_api_key IS NOT NULL THEN '•••• ' || RIGHT(fne_api_key, 4) ELSE NULL END AS fne_api_key_apercu
         FROM entreprises WHERE id = $1`,
      [req.entrepriseId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Mise à jour de la config FNE. Règles :
 *   - on ne touche jamais à fne_api_key / fne_certificat si le champ est
 *     vide dans le body (permet à l'utilisateur de modifier le NCC sans
 *     ressaisir sa clé) ;
 *   - on refuse fne_mode != 'mock' si la clé API est absente ET non
 *     fournie, pour éviter une bascule en prod sans credentials.
 */
async function putFneConfig(req, res, next) {
  try {
    const { ncc, centre_fiscal, fne_actif, fne_mode, fne_api_key, fne_certificat } = req.body;

    if (fne_mode && !['mock', 'sandbox', 'prod'].includes(fne_mode)) {
      return res.status(400).json({ success: false, message: 'Mode FNE invalide' });
    }

    // Récupère l'existant pour la règle de protection sandbox/prod
    const cur = await pool.query(
      'SELECT fne_api_key FROM entreprises WHERE id = $1',
      [req.entrepriseId]
    );
    const cleExistante = cur.rows[0]?.fne_api_key;
    const cleApresUpdate = (fne_api_key && fne_api_key.length > 0) ? fne_api_key : cleExistante;
    if (fne_mode && fne_mode !== 'mock' && !cleApresUpdate) {
      return res.status(400).json({
        success: false,
        message: 'Pour activer le mode sandbox ou prod, une clé API DGI est obligatoire.',
      });
    }

    const champs = [];
    const valeurs = [];
    const pousser = (col, val) => { champs.push(`${col} = $${champs.length + 1}`); valeurs.push(val); };

    if (ncc !== undefined)           pousser('ncc', ncc || null);
    if (centre_fiscal !== undefined) pousser('centre_fiscal', centre_fiscal || null);
    if (fne_actif !== undefined)     pousser('fne_actif', !!fne_actif);
    if (fne_mode !== undefined)      pousser('fne_mode', fne_mode);
    // Les secrets ne sont écrasés que si un nouveau est fourni
    if (fne_api_key && fne_api_key.length > 0)     pousser('fne_api_key', fne_api_key);
    if (fne_certificat && fne_certificat.length > 0) pousser('fne_certificat', fne_certificat);

    if (champs.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });
    }

    valeurs.push(req.entrepriseId);
    await pool.query(
      `UPDATE entreprises SET ${champs.join(', ')}, updated_at = NOW() WHERE id = $${valeurs.length}`,
      valeurs
    );

    logAudit(req, 'UPDATE', 'fne_config', null, { ncc, fne_mode, fne_actif });

    // Renvoie l'état mis à jour (via getFneConfig pour réutiliser le masquage)
    return getFneConfig(req, res, next);
  } catch (err) {
    next(err);
  }
}

module.exports = { certifierFactureRoute, getCertification, getFneConfig, putFneConfig };
