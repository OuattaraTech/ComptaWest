/**
 * Contrôleur FNE — gère le cycle de certification des factures auprès de
 * la DGI Côte d'Ivoire (modes mock / sandbox / prod).
 *
 * Routes exposées :
 *   POST /factures/:id/certifier-fne   → certifier (idempotent)
 *   GET  /factures/:id/certification   → consulter la certification existante
 *   GET  /fne/ping                     → diagnostic serveur DGI (avec cache 60s)
 *   GET  /fne/queue                    → factures en attente de resynchronisation
 *   POST /fne/queue/rejouer            → relance manuelle de la queue
 *
 * Pré-conditions de certification :
 *   - la facture n'est plus en brouillon (statut envoyee/payee/en_attente/retard)
 *   - la facture n'est pas déjà certifiée (contrainte UNIQUE sur facture_id)
 *
 * Le service `utils/fne.js` calcule numéro + hash + QR. Le contrôleur ne
 * fait qu'orchestrer les vérifications et la persistance. En cas d'erreur
 * réseau (FneNetworkError), la facture est mise en file d'attente plutôt
 * que renvoyée en 500.
 */

const pool = require('../../config/database');
const { certifierFacture, pingDgi, FneNetworkError } = require('../utils/fne');
const { logAudit } = require('../utils/audit');

// Délai entre deux tentatives automatiques (15 min, conforme à la
// suggestion technique pré-déploiement).
const RETRY_INTERVAL_MS = 15 * 60 * 1000;
// Au-delà, on bascule la ligne en echec_definitif : il faut une action
// humaine (corriger NCC, repasser en mock, etc.).
const MAX_TENTATIVES = 16; // ≈ 4 h de retry avant d'abandonner.

/**
 * Procède à une certification + persistance dans la même transaction.
 * Réutilisé par la route manuelle, l'auto-certif (statut → envoyée) et
 * le worker de queue. La fonction lève les erreurs ; c'est à l'appelant
 * de gérer la mise en queue ou la réponse HTTP.
 */
async function executerCertification(client, { factureId, entrepriseId, userId }) {
  // NB : la table factures n'a pas de `mode_paiement` ni `taux_change`.
  // On déduit le moyen de paiement depuis le dernier encaissement (table
  // paiements_facture) si présent, sinon « deferred » (à terme) par défaut.
  // Le taux de change n'est pas géré dans cette version (factures XOF only).
  const fact = await client.query(
    `SELECT id, numero, date_emission AS date_facture,
            sous_total AS total_ht, montant_tva AS total_tva,
            total_ttc, devise, statut, client_id, taux_tva,
            (SELECT mode_paiement FROM paiements
              WHERE facture_id = factures.id
              ORDER BY date_paiement DESC LIMIT 1) AS mode_paiement
       FROM factures
      WHERE id = $1 AND entreprise_id = $2
      FOR UPDATE`,
    [factureId, entrepriseId]
  );
  if (fact.rows.length === 0) {
    const err = new Error('Facture introuvable');
    err.code = 'FACTURE_INTROUVABLE';
    throw err;
  }
  const facture = fact.rows[0];

  if (!['envoyee', 'en_attente', 'retard', 'payee'].includes(facture.statut)) {
    const err = new Error('Seules les factures émises (non brouillon) peuvent être certifiées DGI');
    err.code = 'FACTURE_BROUILLON';
    throw err;
  }

  const exist = await client.query(
    'SELECT * FROM factures_certifications_fne WHERE facture_id = $1',
    [factureId]
  );
  if (exist.rows.length > 0) {
    return { deja_certifiee: true, certification: exist.rows[0] };
  }

  // Données entreprise (NCC, clé API, mode, nom commercial pour
  // pointOfSale/establishment du payload DGI)
  const ent = await client.query(
    `SELECT id, nom, ncc, fne_actif, fne_mode, fne_api_key, fne_certificat
       FROM entreprises WHERE id = $1`,
    [entrepriseId]
  );
  const entreprise = ent.rows[0];

  // Lignes facture — la DGI exige au moins 1 item avec quantité, prix et TVA.
  // En mode mock ces données ne servent à rien, mais on les charge quand même
  // pour que la bascule mock → sandbox/prod n'oblige pas à modifier l'appel.
  // taux_tva est au niveau facture (pas par ligne dans le schéma actuel) ;
  // on le propage sur chaque ligne pour le mapping vers le code DGI.
  const lignesRes = await client.query(
    `SELECT l.description, l.quantite, l.prix_unitaire, l.unite,
            l.remise AS remise_percent, p.code AS reference
       FROM lignes_facture l
       LEFT JOIN produits p ON p.id = l.produit_id
      WHERE l.facture_id = $1
      ORDER BY l.ordre, l.id`,
    [factureId]
  );
  // On enrichit chaque ligne avec le taux TVA global de la facture
  const lignesAvecTva = lignesRes.rows.map(l => ({
    ...l,
    taux_tva: facture.taux_tva,
  }));

  // Client — facultatif (B2C anonyme accepté par DGI). Si client_id pointe
  // sur un tiers, on charge ses coordonnées pour les renseigner.
  let clientData = null;
  if (facture.client_id) {
    const cliRes = await client.query(
      'SELECT nom, email, telephone, ninea, ville, pays FROM clients WHERE id = $1',
      [facture.client_id]
    );
    clientData = cliRes.rows[0] || null;
  }

  const cert = await certifierFacture({
    facture, entreprise,
    lignes: lignesAvecTva,
    client: clientData,
  });

  const ins = await client.query(
    `INSERT INTO factures_certifications_fne
       (facture_id, entreprise_id, numero_fne, hash_facture, qr_data,
        mode, dgi_response_raw, certified_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      factureId, entrepriseId,
      cert.numero_fne, cert.hash_facture, cert.qr_data,
      cert.mode, cert.dgi_response_raw, userId,
    ]
  );

  // Sur succès, on purge la queue si la facture s'y trouvait.
  await client.query('DELETE FROM pending_sync_fne WHERE facture_id = $1', [factureId]);

  return { deja_certifiee: false, certification: ins.rows[0] };
}

/**
 * Pousse (ou met à jour) une ligne de queue suite à un échec réseau.
 * UPSERT via la contrainte UNIQUE pending_sync_fne_facture_unique.
 */
async function poussierEnQueue(client, { factureId, entrepriseId, erreur }) {
  await client.query(
    `INSERT INTO pending_sync_fne
       (facture_id, entreprise_id, nb_tentatives, derniere_tentative_at,
        prochaine_tentative_at, derniere_erreur, statut)
     VALUES ($1, $2, 1, NOW(), NOW() + INTERVAL '15 minutes', $3, 'en_attente')
     ON CONFLICT (facture_id) DO UPDATE
       SET nb_tentatives = pending_sync_fne.nb_tentatives + 1,
           derniere_tentative_at = NOW(),
           prochaine_tentative_at = NOW() + INTERVAL '15 minutes',
           derniere_erreur = EXCLUDED.derniere_erreur,
           statut = CASE
             WHEN pending_sync_fne.nb_tentatives + 1 >= $4 THEN 'echec_definitif'
             ELSE 'en_attente'
           END,
           updated_at = NOW()`,
    [factureId, entrepriseId, erreur, MAX_TENTATIVES]
  );
}

/**
 * Rejoue les certifications dues. Appelée :
 *   - en arrière-plan au /fne/ping (lazy, pas de cron à provisionner)
 *   - manuellement via POST /fne/queue/rejouer
 *   - automatiquement après un updateStatut qui passe une facture en émise
 *
 * Limitée à 10 lignes par appel pour ne pas bloquer une requête HTTP.
 */
async function rejouerQueue(entrepriseId) {
  const dues = await pool.query(
    `SELECT facture_id FROM pending_sync_fne
      WHERE entreprise_id = $1
        AND statut = 'en_attente'
        AND prochaine_tentative_at <= NOW()
      ORDER BY prochaine_tentative_at ASC
      LIMIT 10`,
    [entrepriseId]
  );
  let succes = 0;
  let echec = 0;
  for (const ligne of dues.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await executerCertification(client, {
        factureId: ligne.facture_id,
        entrepriseId,
        userId: null,
      });
      await client.query('COMMIT');
      succes++;
    } catch (err) {
      await client.query('ROLLBACK');
      // Replanifie la ligne (UPSERT) sauf si l'erreur est métier non récupérable.
      const irrecuperable = err.code === 'FACTURE_INTROUVABLE' || err.code === 'FACTURE_BROUILLON';
      if (irrecuperable) {
        await pool.query('DELETE FROM pending_sync_fne WHERE facture_id = $1', [ligne.facture_id]);
      } else {
        const c2 = await pool.connect();
        try {
          await poussierEnQueue(c2, {
            factureId: ligne.facture_id,
            entrepriseId,
            erreur: err.message,
          });
        } finally { c2.release(); }
      }
      echec++;
    } finally {
      client.release();
    }
  }
  return { tentees: dues.rows.length, succes, echec };
}

// ─── Routes ────────────────────────────────────────────────────────────────

async function certifierFactureRoute(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await executerCertification(client, {
      factureId: req.params.id,
      entrepriseId: req.entrepriseId,
      userId: req.user.id,
    });
    await client.query('COMMIT');

    logAudit(req, 'CERTIFY_FNE', 'factures', req.params.id, {
      numero_fne: out.certification.numero_fne,
      mode: out.certification.mode,
    });

    return res.status(out.deja_certifiee ? 200 : 201).json({
      success: true,
      data: { ...out.certification, deja_certifiee: out.deja_certifiee },
    });
  } catch (err) {
    await client.query('ROLLBACK');

    // Erreur réseau DGI : on met en queue et on répond 202 (Accepted).
    if (err instanceof FneNetworkError) {
      const c2 = await pool.connect();
      try {
        await poussierEnQueue(c2, {
          factureId: req.params.id,
          entrepriseId: req.entrepriseId,
          erreur: err.message,
        });
      } finally { c2.release(); }
      return res.status(202).json({
        success: true,
        en_attente: true,
        message: 'Serveur DGI injoignable — facture placée en file d\'attente, retry automatique toutes les 15 minutes.',
      });
    }

    if (err.code === 'FACTURE_INTROUVABLE') return res.status(404).json({ success: false, message: err.message });
    if (err.code === 'FACTURE_BROUILLON')   return res.status(400).json({ success: false, message: err.message });
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
      `SELECT ncc, centre_fiscal, fne_actif, fne_mode, fne_auto_certif,
              fne_ping_statut, fne_ping_at,
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
    const { ncc, centre_fiscal, fne_actif, fne_mode, fne_api_key, fne_certificat, fne_auto_certif } = req.body;

    if (fne_mode && !['mock', 'sandbox', 'prod'].includes(fne_mode)) {
      return res.status(400).json({ success: false, message: 'Mode FNE invalide' });
    }

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

    if (ncc !== undefined)              pousser('ncc', ncc || null);
    if (centre_fiscal !== undefined)    pousser('centre_fiscal', centre_fiscal || null);
    if (fne_actif !== undefined)        pousser('fne_actif', !!fne_actif);
    if (fne_auto_certif !== undefined)  pousser('fne_auto_certif', !!fne_auto_certif);
    if (fne_mode !== undefined)         pousser('fne_mode', fne_mode);
    if (fne_api_key && fne_api_key.length > 0)         pousser('fne_api_key', fne_api_key);
    if (fne_certificat && fne_certificat.length > 0)   pousser('fne_certificat', fne_certificat);

    if (champs.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });
    }

    valeurs.push(req.entrepriseId);
    await pool.query(
      `UPDATE entreprises SET ${champs.join(', ')}, updated_at = NOW() WHERE id = $${valeurs.length}`,
      valeurs
    );

    logAudit(req, 'UPDATE', 'fne_config', null, { ncc, fne_mode, fne_actif, fne_auto_certif });

    return getFneConfig(req, res, next);
  } catch (err) {
    next(err);
  }
}

/**
 * Diagnostic DGI. Met le résultat en cache (champs fne_ping_*) pour ne
 * pas spammer l'API DGI à chaque rafraîchissement d'écran. En pratique,
 * le frontend appelle /fne/ping toutes les 60 s ; le ping HTTP réel
 * n'est refait que si le cache a plus de 30 s.
 */
async function fnePing(req, res, next) {
  try {
    const cur = await pool.query(
      `SELECT ncc, fne_mode, fne_api_key, fne_ping_statut, fne_ping_at
         FROM entreprises WHERE id = $1`,
      [req.entrepriseId]
    );
    if (cur.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    }
    const ent = cur.rows[0];
    const cacheValide = ent.fne_ping_at
      && (Date.now() - new Date(ent.fne_ping_at).getTime()) < 30_000;

    let resultat;
    if (cacheValide) {
      resultat = { statut: ent.fne_ping_statut, message: 'cache', cached: true };
    } else {
      resultat = await pingDgi(ent);
      await pool.query(
        `UPDATE entreprises
           SET fne_ping_statut = $1, fne_ping_at = NOW()
         WHERE id = $2`,
        [resultat.statut, req.entrepriseId]
      );
    }

    // Tentative de rejeu de la queue en arrière-plan (best-effort).
    // On ne bloque pas la réponse là-dessus ; les erreurs sont silencieuses.
    rejouerQueue(req.entrepriseId).catch((e) => {
      console.warn('[fne-queue] rejeu lazy échoué:', e.message);
    });

    // Compteur de la queue pour affichage UI.
    const q = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE statut = 'en_attente')      AS en_attente,
         COUNT(*) FILTER (WHERE statut = 'echec_definitif') AS echec_definitif
       FROM pending_sync_fne WHERE entreprise_id = $1`,
      [req.entrepriseId]
    );

    res.json({
      success: true,
      data: {
        ...resultat,
        verifie_a: new Date().toISOString(),
        queue: {
          en_attente: parseInt(q.rows[0].en_attente, 10),
          echec_definitif: parseInt(q.rows[0].echec_definitif, 10),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getQueue(req, res, next) {
  try {
    const r = await pool.query(
      `SELECT q.id, q.facture_id, f.numero AS facture_numero,
              q.statut, q.nb_tentatives, q.derniere_tentative_at,
              q.prochaine_tentative_at, q.derniere_erreur, q.created_at
         FROM pending_sync_fne q
         JOIN factures f ON f.id = q.facture_id
        WHERE q.entreprise_id = $1
        ORDER BY q.created_at DESC
        LIMIT 50`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    next(err);
  }
}

async function rejouerQueueRoute(req, res, next) {
  try {
    // Forcer toutes les lignes en attente à devenir dues immédiatement
    // (l'utilisateur a explicitement demandé un retry).
    await pool.query(
      `UPDATE pending_sync_fne SET prochaine_tentative_at = NOW()
        WHERE entreprise_id = $1 AND statut = 'en_attente'`,
      [req.entrepriseId]
    );
    const stats = await rejouerQueue(req.entrepriseId);
    logAudit(req, 'REPLAY_FNE_QUEUE', 'fne_queue', null, stats);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  certifierFactureRoute,
  getCertification,
  getFneConfig,
  putFneConfig,
  fnePing,
  getQueue,
  rejouerQueueRoute,
  // Exporté pour usage interne (auto-certif déclenché par facturesController)
  executerCertification,
  poussierEnQueue,
  rejouerQueue,
};
