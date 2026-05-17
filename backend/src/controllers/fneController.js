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

module.exports = { certifierFactureRoute, getCertification };
