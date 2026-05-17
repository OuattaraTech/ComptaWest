/**
 * Génération de liens de paiement externes pour les factures.
 *
 * Workflow (lot A.1) :
 *   1. Le commercial valide une facture (statut != 'brouillon', reste > 0)
 *   2. POST /api/factures/:id/lien-paiement-wave
 *   3. On lit l'intégration Wave de l'entreprise (table integrations_paiement)
 *      - Si absente ou mode='mock', on génère un faux lien (utile en dev)
 *   4. On crée une session Wave (utils/wave.js)
 *   5. On persiste dans sessions_paiement (statut 'initiee')
 *   6. On renvoie { url, expire_at, mode } au frontend
 *
 * Le webhook (lot A.2) basculera la session à 'payee' et créera le mouvement
 * de trésorerie + le paiement de facture automatiquement.
 */

const pool = require('../../config/database');
const { creerCheckoutSession, verifierSignatureWebhook } = require('../utils/wave');
const { ecriturePaiementFacture } = require('../utils/comptabilite-auto');
const { logAudit } = require('../utils/audit');

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

/**
 * POST /api/factures/:id/lien-paiement-wave
 * Crée (ou récupère) un lien de paiement Wave pour la facture donnée.
 *
 * Réponse :
 *   { success: true, data: { url, session_id, statut, mode, montant, devise, expire_at } }
 */
const creerLienWaveFacture = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: factureId } = req.params;
    const eid = req.entrepriseId;

    // 1. Récupérer la facture
    const fRes = await client.query(
      `SELECT id, numero, total_ttc, montant_paye, statut, client_id, devise
       FROM factures WHERE id = $1 AND entreprise_id = $2`,
      [factureId, eid]
    );
    const facture = fRes.rows[0];
    if (!facture) {
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    if (facture.statut === 'brouillon') {
      return res.status(400).json({
        success: false,
        message: 'Validez la facture avant de générer un lien de paiement.',
      });
    }
    const reste = Math.round((parseFloat(facture.total_ttc) - parseFloat(facture.montant_paye || 0)) * 100) / 100;
    if (reste <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cette facture est déjà entièrement payée.',
      });
    }

    // 2. Si une session 'initiee' ou 'en_attente' existe déjà, la renvoyer
    //    au lieu d'en créer une nouvelle (idempotence).
    const existing = await client.query(
      `SELECT id, session_id_externe, url_paiement, statut, montant, devise, expire_at
       FROM sessions_paiement
       WHERE facture_id = $1 AND fournisseur = 'wave' AND statut IN ('initiee', 'en_attente')
       ORDER BY created_at DESC LIMIT 1`,
      [factureId]
    );
    if (existing.rows[0] && existing.rows[0].expire_at && new Date(existing.rows[0].expire_at) > new Date()) {
      const e = existing.rows[0];
      return res.json({
        success: true,
        data: {
          url: e.url_paiement,
          session_id: e.session_id_externe,
          statut: e.statut,
          mode: 'reused',
          montant: parseFloat(e.montant),
          devise: e.devise,
          expire_at: e.expire_at,
        },
      });
    }

    // 3. Charger la configuration Wave de l'entreprise (peut être absente)
    const intRes = await client.query(
      `SELECT api_key, mode FROM integrations_paiement
       WHERE entreprise_id = $1 AND fournisseur = 'wave' AND actif = true`,
      [eid]
    );
    const integration = intRes.rows[0] || { api_key: null, mode: 'mock' };

    // 4. Créer la session via le service Wave (mock par défaut)
    const session = await creerCheckoutSession({
      apiKey: integration.api_key,
      mode: integration.mode || 'mock',
      amount: reste,
      currency: facture.devise || 'XOF',
      clientReference: facture.numero,
      successUrl: `${FRONTEND_BASE_URL}/factures?paiement=success&facture=${facture.numero}`,
      errorUrl:   `${FRONTEND_BASE_URL}/factures?paiement=error&facture=${facture.numero}`,
    });

    // 5. Persister la session
    const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const persistee = await client.query(
      `INSERT INTO sessions_paiement (
        entreprise_id, facture_id, fournisseur, session_id_externe,
        url_paiement, montant, devise, statut, expire_at, raw_payload, cree_par
      ) VALUES ($1, $2, 'wave', $3, $4, $5, $6, 'initiee', $7, $8, $9)
      RETURNING id, session_id_externe, url_paiement, statut, expire_at`,
      [
        eid, factureId, session.id, session.wave_launch_url,
        reste, facture.devise || 'XOF', expireAt, JSON.stringify(session.raw),
        req.user?.id,
      ]
    );
    const row = persistee.rows[0];

    logAudit(req, 'CREATE', 'sessions_paiement', row.id, {
      facture: facture.numero, fournisseur: 'wave', montant: reste, mode: session.mode,
    });

    return res.json({
      success: true,
      data: {
        url: row.url_paiement,
        session_id: row.session_id_externe,
        statut: row.statut,
        mode: session.mode,
        montant: reste,
        devise: facture.devise || 'XOF',
        expire_at: row.expire_at,
      },
    });
  } catch (err) {
    console.error('Erreur creerLienWaveFacture:', err.message);
    res.status(500).json({ success: false, message: 'Impossible de générer le lien de paiement' });
  } finally {
    client.release();
  }
};

/**
 * Helper interne : encaisse une session de paiement Wave qui vient d'être
 * confirmée. Doit être appelé dans une transaction (client.query('BEGIN')
 * faite par l'appelant). Idempotent : si la session est déjà 'payee', on
 * ne fait rien.
 *
 * Étapes :
 *   1. Reload session FOR UPDATE
 *   2. Si déjà payée, return sans erreur
 *   3. Détermine le compte de trésorerie cible (intégration.compte_id ou
 *      compte par défaut de type 'mobile_money')
 *   4. Crée le mouvement de trésorerie (entrée)
 *   5. Si une facture est liée :
 *      - INSERT paiements (facture_id, montant, mode='mobile_money', ref)
 *      - UPDATE factures.montant_paye + statut
 *      - Génère l'écriture comptable d'encaissement
 *   6. UPDATE sessions_paiement.statut='payee', paye_at, mouvement_id,
 *      payeur_telephone, payeur_nom
 *
 * @returns {object} { session, facture, paiement, mouvement_id, deja_payee }
 */
async function encaisserSessionWave(client, { session, payeurTelephone = null, payeurNom = null, dateOperation = null }) {
  const eid = session.entreprise_id;
  // Re-lecture FOR UPDATE pour éviter les race-conditions sur un double webhook
  const sRes = await client.query(
    `SELECT * FROM sessions_paiement WHERE id = $1 FOR UPDATE`,
    [session.id]
  );
  const s = sRes.rows[0];
  if (!s) throw new Error('Session de paiement introuvable');
  if (s.statut === 'payee') {
    return { session: s, deja_payee: true };
  }

  // Compte de trésorerie cible : configuration intégration ou défaut Wave
  const intRes = await client.query(
    `SELECT compte_tresorerie_id FROM integrations_paiement
     WHERE entreprise_id = $1 AND fournisseur = $2 AND actif = true`,
    [eid, s.fournisseur]
  );
  let compteId = intRes.rows[0]?.compte_tresorerie_id || null;
  if (!compteId) {
    // Fallback : premier compte mobile_money de l'entreprise, sinon banque
    const r = await client.query(
      `SELECT id FROM comptes_tresorerie
       WHERE entreprise_id = $1 AND archived_at IS NULL
         AND type IN ('mobile_money', 'banque')
       ORDER BY (type = 'mobile_money') DESC, par_defaut DESC LIMIT 1`,
      [eid]
    );
    compteId = r.rows[0]?.id;
  }
  if (!compteId) {
    throw new Error('Aucun compte de trésorerie configuré pour recevoir le paiement Mobile Money');
  }

  const datePaiement = dateOperation || new Date().toISOString().split('T')[0];
  const montant = parseFloat(s.montant);

  // Mouvement de trésorerie (entrée)
  const mvtRes = await client.query(
    `INSERT INTO mouvements_tresorerie
       (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, cree_par)
     VALUES ($1, $2, $3, 'entree', $4, $5, $6, 'paiement_facture', NULL)
     RETURNING id`,
    [
      eid, compteId, datePaiement, montant,
      `Encaissement ${s.fournisseur.toUpperCase()} ${payeurTelephone || ''}`.trim(),
      s.session_id_externe,
    ]
  );
  const mouvementId = mvtRes.rows[0].id;

  // Si une facture est liée : créer le paiement + maj facture + écriture compta
  let facture = null, paiement = null;
  if (s.facture_id) {
    const fRes = await client.query(
      `SELECT * FROM factures WHERE id = $1 AND entreprise_id = $2 FOR UPDATE`,
      [s.facture_id, eid]
    );
    facture = fRes.rows[0];
    if (facture) {
      // INSERT paiement
      const pRes = await client.query(
        `INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference, notes, compte_tresorerie_id)
         VALUES ($1, $2, $3, 'mobile_money', $4, $5, $6) RETURNING *`,
        [
          facture.id, montant, datePaiement,
          s.session_id_externe,
          `Paiement Wave ${payeurTelephone || ''} ${payeurNom || ''}`.trim(),
          compteId,
        ]
      );
      paiement = pRes.rows[0];

      // Maj facture
      const nouveauPaye = Math.round((parseFloat(facture.montant_paye) + montant) * 100) / 100;
      const ttc = parseFloat(facture.total_ttc);
      const nouveauStatut = nouveauPaye >= ttc - 0.01 ? 'payee' : 'en_attente';
      await client.query(
        `UPDATE factures SET montant_paye = $1, statut = $2, updated_at = NOW() WHERE id = $3`,
        [nouveauPaye, nouveauStatut, facture.id]
      );
      facture.montant_paye = nouveauPaye;
      facture.statut = nouveauStatut;

      // Écriture comptable (best-effort, ne casse pas l'encaissement)
      try {
        await ecriturePaiementFacture(client, {
          entrepriseId: eid,
          utilisateurId: s.cree_par,
          facture, paiement,
        });
      } catch (err) {
        console.warn('Écriture compta encaissement Wave échouée:', err.message);
      }
    }
  }

  // Maj session
  await client.query(
    `UPDATE sessions_paiement
     SET statut = 'payee', paye_at = NOW(), mouvement_id = $1,
         payeur_telephone = $2, payeur_nom = $3, updated_at = NOW()
     WHERE id = $4`,
    [mouvementId, payeurTelephone, payeurNom, s.id]
  );

  return { session: s, facture, paiement, mouvement_id: mouvementId, deja_payee: false };
}

/**
 * POST /api/webhooks/wave/:entreprise_id
 * Endpoint public appelé par Wave après une tentative de paiement.
 *
 * Sécurité :
 *  - Vérifie la signature HMAC-SHA256 du payload (en-tête Wave-Signature)
 *    contre le webhook_secret stocké dans integrations_paiement.
 *  - Sans secret configuré, on rejette en 400 (sinon n'importe qui pourrait
 *    faire passer une facture en payée).
 *
 * Événements gérés :
 *  - checkout.session.completed     -> encaissement
 *  - checkout.session.payment_failed -> statut = 'echouee'
 *
 * Le body doit avoir été parsé en RAW (Buffer) côté Express pour pouvoir
 * vérifier la signature ; voir middleware rawBodyForWebhook dans index.js.
 */
const webhookWave = async (req, res) => {
  const client = await pool.connect();
  try {
    const { entreprise_id: entrepriseId } = req.params;
    if (!entrepriseId || !/^[0-9a-f-]{36}$/i.test(entrepriseId)) {
      return res.status(400).json({ success: false, message: 'Entreprise invalide' });
    }

    // 1. Charger les credentials Wave de l'entreprise
    const intRes = await client.query(
      `SELECT webhook_secret, mode FROM integrations_paiement
       WHERE entreprise_id = $1 AND fournisseur = 'wave' AND actif = true`,
      [entrepriseId]
    );
    const integration = intRes.rows[0];
    if (!integration || !integration.webhook_secret) {
      return res.status(400).json({
        success: false,
        message: 'Webhook secret non configuré pour cette entreprise',
      });
    }

    // 2. Vérifier la signature
    const signature = req.headers['wave-signature'] || req.headers['Wave-Signature'];
    const payloadBrut = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
    const signatureValide = verifierSignatureWebhook({
      payloadBrut, signature,
      webhookSecret: integration.webhook_secret,
    });
    if (!signatureValide) {
      return res.status(401).json({ success: false, message: 'Signature invalide' });
    }

    // 3. Parser l'événement
    const event = req.body;
    const eventType = event?.type;
    const sessionExterne = event?.data?.id;
    if (!sessionExterne) {
      return res.status(400).json({ success: false, message: 'Payload sans session id' });
    }

    // 4. Retrouver la session locale correspondante
    const sRes = await client.query(
      `SELECT * FROM sessions_paiement WHERE fournisseur = 'wave' AND session_id_externe = $1`,
      [sessionExterne]
    );
    const session = sRes.rows[0];
    if (!session) {
      // On accepte (200) pour éviter que Wave réessaye en boucle, mais on log
      console.warn(`[webhook wave] session externe ${sessionExterne} inconnue`);
      return res.json({ success: true, ignored: true });
    }

    await client.query('BEGIN');

    if (eventType === 'checkout.session.completed') {
      const result = await encaisserSessionWave(client, {
        session,
        payeurTelephone: event.data.payment_address?.mobile || null,
        payeurNom:       event.data.payment_address?.name   || null,
      });
      await client.query(
        `UPDATE sessions_paiement SET raw_payload = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(event), session.id]
      );
      await client.query('COMMIT');
      return res.json({ success: true, deja_payee: result.deja_payee });
    }

    if (eventType === 'checkout.session.payment_failed') {
      await client.query(
        `UPDATE sessions_paiement
         SET statut = 'echouee', raw_payload = $1, updated_at = NOW()
         WHERE id = $2 AND statut NOT IN ('payee')`,
        [JSON.stringify(event), session.id]
      );
      await client.query('COMMIT');
      return res.json({ success: true });
    }

    // Autres événements : on accuse réception sans rien faire
    await client.query('COMMIT');
    return res.json({ success: true, ignored: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur webhookWave:', err.message);
    res.status(500).json({ success: false, message: 'Erreur traitement webhook' });
  } finally {
    client.release();
  }
};

/**
 * POST /api/factures/:id/lien-paiement-wave/simuler-paiement
 * Réservé au mode démo : déclenche manuellement l'encaissement d'une
 * session Wave existante, comme si Wave avait envoyé un webhook
 * checkout.session.completed.
 *
 * Pratique pour montrer le flux complet en démo commerciale sans avoir
 * de compte marchand Wave réel ni de tunnel ngrok.
 *
 * Refusé si l'intégration n'est pas en mode 'mock'.
 */
const simulerPaiementWave = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    const { id: factureId } = req.params;
    const eid = req.entrepriseId;

    // Vérification du mode démo
    const intRes = await dbClient.query(
      `SELECT mode FROM integrations_paiement
       WHERE entreprise_id = $1 AND fournisseur = 'wave' AND actif = true`,
      [eid]
    );
    const mode = intRes.rows[0]?.mode || 'mock';
    if (mode !== 'mock') {
      return res.status(400).json({
        success: false,
        message: 'La simulation n\'est disponible qu\'en mode démo (mock).',
      });
    }

    // Charger la session active la plus récente pour cette facture
    const sRes = await dbClient.query(
      `SELECT * FROM sessions_paiement
       WHERE facture_id = $1 AND fournisseur = 'wave' AND statut IN ('initiee', 'en_attente')
       ORDER BY created_at DESC LIMIT 1`,
      [factureId]
    );
    const session = sRes.rows[0];
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Aucune session de paiement active pour cette facture. Générez d\'abord un lien.',
      });
    }

    await dbClient.query('BEGIN');
    const result = await encaisserSessionWave(dbClient, {
      session,
      payeurTelephone: '+225 07 00 00 00 00',
      payeurNom: 'Client Démo',
    });
    await dbClient.query('COMMIT');

    logAudit(req, 'PAY', 'sessions_paiement', session.id, {
      facture_id: factureId, mode: 'mock-simulation', montant: parseFloat(session.montant),
    });

    return res.json({
      success: true,
      data: {
        deja_payee: result.deja_payee,
        montant: parseFloat(session.montant),
        facture_statut: result.facture?.statut,
        facture_montant_paye: result.facture?.montant_paye,
      },
    });
  } catch (err) {
    try { await dbClient.query('ROLLBACK'); } catch {}
    console.error('Erreur simulerPaiementWave:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Erreur simulation' });
  } finally {
    dbClient.release();
  }
};

module.exports = { creerLienWaveFacture, webhookWave, simulerPaiementWave };
