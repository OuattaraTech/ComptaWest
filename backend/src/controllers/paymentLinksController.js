/**
 * Génération de liens de paiement externes multi-fournisseurs
 * (Wave, Orange Money, MTN MoMo) + webhooks d'encaissement.
 *
 * Architecture :
 *   - Un service par fournisseur (utils/wave.js, utils/orange.js, utils/mtn.js)
 *     expose la même API : creerCheckoutSession + verifierSignatureWebhook.
 *   - Un helper genererLienPaiement() factorise la création de session
 *     pour les 3 fournisseurs (lecture de la conf + appel du bon service +
 *     persistance dans sessions_paiement).
 *   - Un helper encaisserSessionPaiement() crée mouvement de trésorerie
 *     + paiement facture + écriture comptable. Identique pour les 3.
 *   - Les webhooks (1 par fournisseur car les payloads diffèrent) appellent
 *     encaisserSessionPaiement quand la session passe à 'payee'.
 *
 * Backwards-compat : POST /factures/:id/lien-paiement-wave reste valide,
 * appelle creerLienPaiementFacture avec fournisseur='wave' en dur.
 */

const pool = require('../../config/database');
const wave   = require('../utils/wave');
const orange = require('../utils/orange');
const mtn    = require('../utils/mtn');
const { ecriturePaiementFacture } = require('../utils/comptabilite-auto');
const { logAudit } = require('../utils/audit');

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
const BACKEND_BASE_URL  = process.env.BACKEND_BASE_URL  || 'http://localhost:5000';

const FOURNISSEURS_VALIDES = ['wave', 'orange_money', 'mtn_momo'];

// Aiguillage vers le bon service selon le fournisseur
const SERVICES = {
  wave, orange_money: orange, mtn_momo: mtn,
};

/**
 * Appelle le service du fournisseur pour créer une session de paiement.
 * Normalise la réponse en { id, url, status, mode, raw, ... } quel que
 * soit le fournisseur.
 */
async function appelerServiceFournisseur(fournisseur, integration, facture, payerMobile, entrepriseId) {
  const montant = Math.round((parseFloat(facture.total_ttc) - parseFloat(facture.montant_paye || 0)) * 100) / 100;
  const currency = facture.devise || 'XOF';
  const ref = facture.numero;
  const successUrl = `${FRONTEND_BASE_URL}/factures?paiement=success&facture=${ref}`;
  const errorUrl   = `${FRONTEND_BASE_URL}/factures?paiement=error&facture=${ref}`;
  const notifUrl   = `${BACKEND_BASE_URL}/api/webhooks/${fournisseur}/${entrepriseId}`;

  if (fournisseur === 'wave') {
    const s = await wave.creerCheckoutSession({
      apiKey: integration.api_key,
      mode:   integration.mode || 'mock',
      amount: montant, currency, clientReference: ref,
      successUrl, errorUrl,
    });
    return { ...s, url: s.wave_launch_url, montant, currency };
  }
  if (fournisseur === 'orange_money') {
    const s = await orange.creerCheckoutSession({
      apiKey: integration.api_key,
      mode:   integration.mode || 'mock',
      amount: montant, currency, clientReference: ref,
      returnUrl: successUrl, cancelUrl: errorUrl, notifUrl,
    });
    return { ...s, url: s.payment_url, montant, currency };
  }
  if (fournisseur === 'mtn_momo') {
    if (!payerMobile) throw new Error('Numéro du payeur requis pour MTN MoMo');
    const s = await mtn.creerCheckoutSession({
      apiKey: integration.api_key,
      subscriptionKey: integration.webhook_secret, // on réutilise webhook_secret pour le subscription_key MTN
      mode: integration.mode || 'mock',
      amount: montant, currency, clientReference: ref,
      payerMobile,
    });
    return { ...s, url: s.payment_url, payer_mobile: s.payer_mobile, montant, currency };
  }
  throw new Error(`Fournisseur inconnu : ${fournisseur}`);
}

/**
 * POST /api/factures/:id/lien-paiement
 * Body : { fournisseur: 'wave' | 'orange_money' | 'mtn_momo',
 *          payer_mobile?: '+225 07 ...'  (requis pour mtn_momo) }
 *
 * Crée (ou réutilise) une session de paiement pour la facture donnée.
 */
const creerLienPaiementFacture = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: factureId } = req.params;
    const eid = req.entrepriseId;
    const fournisseur = (req.body?.fournisseur || req.params?.fournisseur || 'wave').toLowerCase();
    const payerMobile = req.body?.payer_mobile || null;

    if (!FOURNISSEURS_VALIDES.includes(fournisseur)) {
      return res.status(400).json({
        success: false,
        message: `Fournisseur invalide. Valeurs acceptées : ${FOURNISSEURS_VALIDES.join(', ')}`,
      });
    }

    // 1. Facture
    const fRes = await client.query(
      `SELECT id, numero, total_ttc, montant_paye, statut, client_id, devise
       FROM factures WHERE id = $1 AND entreprise_id = $2`,
      [factureId, eid]
    );
    const facture = fRes.rows[0];
    if (!facture) return res.status(404).json({ success: false, message: 'Facture introuvable' });
    if (facture.statut === 'brouillon') {
      return res.status(400).json({
        success: false,
        message: 'Validez la facture avant de générer un lien de paiement.',
      });
    }
    const reste = Math.round((parseFloat(facture.total_ttc) - parseFloat(facture.montant_paye || 0)) * 100) / 100;
    if (reste <= 0) {
      return res.status(400).json({ success: false, message: 'Cette facture est déjà entièrement payée.' });
    }

    // 2. Idempotence : si une session active non expirée existe pour ce
    //    couple (facture, fournisseur), on la renvoie.
    const existing = await client.query(
      `SELECT id, session_id_externe, url_paiement, statut, montant, devise, expire_at, payeur_telephone
       FROM sessions_paiement
       WHERE facture_id = $1 AND fournisseur = $2 AND statut IN ('initiee', 'en_attente')
       ORDER BY created_at DESC LIMIT 1`,
      [factureId, fournisseur]
    );
    if (existing.rows[0] && existing.rows[0].expire_at && new Date(existing.rows[0].expire_at) > new Date()) {
      const e = existing.rows[0];
      return res.json({
        success: true,
        data: {
          url: e.url_paiement, session_id: e.session_id_externe,
          statut: e.statut, mode: 'reused', fournisseur,
          montant: parseFloat(e.montant), devise: e.devise,
          payer_mobile: e.payeur_telephone, expire_at: e.expire_at,
        },
      });
    }

    // 3. Conf du fournisseur (peut être absente -> mode mock)
    const intRes = await client.query(
      `SELECT api_key, webhook_secret, mode FROM integrations_paiement
       WHERE entreprise_id = $1 AND fournisseur = $2 AND actif = true`,
      [eid, fournisseur]
    );
    const integration = intRes.rows[0] || { api_key: null, webhook_secret: null, mode: 'mock' };

    // 4. Appel du service
    const session = await appelerServiceFournisseur(fournisseur, integration, facture, payerMobile, eid);

    // 5. Persistance
    const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const persistee = await client.query(
      `INSERT INTO sessions_paiement (
         entreprise_id, facture_id, fournisseur, session_id_externe,
         url_paiement, montant, devise, statut, expire_at, raw_payload,
         payeur_telephone, cree_par
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'initiee', $8, $9, $10, $11)
       RETURNING id, session_id_externe, url_paiement, statut, expire_at`,
      [
        eid, factureId, fournisseur, session.id, session.url,
        session.montant, session.currency, expireAt,
        JSON.stringify(session.raw),
        session.payer_mobile || payerMobile,
        req.user?.id,
      ]
    );
    const row = persistee.rows[0];

    logAudit(req, 'CREATE', 'sessions_paiement', row.id, {
      facture: facture.numero, fournisseur, montant: session.montant, mode: session.mode,
    });

    return res.json({
      success: true,
      data: {
        url: row.url_paiement, session_id: row.session_id_externe,
        statut: row.statut, mode: session.mode, fournisseur,
        montant: session.montant, devise: session.currency,
        payer_mobile: session.payer_mobile || payerMobile,
        expire_at: row.expire_at,
      },
    });
  } catch (err) {
    console.error('Erreur creerLienPaiementFacture:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Impossible de générer le lien' });
  } finally {
    client.release();
  }
};

// Alias rétrocompatible (lot A.1) : POST /factures/:id/lien-paiement-wave
const creerLienWaveFacture = (req, res) => {
  req.body = { ...(req.body || {}), fournisseur: 'wave' };
  return creerLienPaiementFacture(req, res);
};

/**
 * Helper : encaisse une session (mouvement trésorerie + paiement facture
 * + écriture comptable). Idempotent.
 */
async function encaisserSession(client, { session, payeurTelephone = null, payeurNom = null, dateOperation = null }) {
  const eid = session.entreprise_id;
  const sRes = await client.query(
    `SELECT * FROM sessions_paiement WHERE id = $1 FOR UPDATE`,
    [session.id]
  );
  const s = sRes.rows[0];
  if (!s) throw new Error('Session de paiement introuvable');
  if (s.statut === 'payee') return { session: s, deja_payee: true };

  // Compte de trésorerie cible (intégration ou fallback)
  const intRes = await client.query(
    `SELECT compte_tresorerie_id FROM integrations_paiement
     WHERE entreprise_id = $1 AND fournisseur = $2 AND actif = true`,
    [eid, s.fournisseur]
  );
  let compteId = intRes.rows[0]?.compte_tresorerie_id || null;
  if (!compteId) {
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
  const fournisseurLabel = s.fournisseur.replace('_', ' ').toUpperCase();

  // Mouvement de trésorerie
  const mvtRes = await client.query(
    `INSERT INTO mouvements_tresorerie
       (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, cree_par)
     VALUES ($1, $2, $3, 'entree', $4, $5, $6, 'paiement_facture', NULL)
     RETURNING id`,
    [
      eid, compteId, datePaiement, montant,
      `Encaissement ${fournisseurLabel} ${payeurTelephone || s.payeur_telephone || ''}`.trim(),
      s.session_id_externe,
    ]
  );
  const mouvementId = mvtRes.rows[0].id;

  let facture = null, paiement = null;
  if (s.facture_id) {
    const fRes = await client.query(
      `SELECT * FROM factures WHERE id = $1 AND entreprise_id = $2 FOR UPDATE`,
      [s.facture_id, eid]
    );
    facture = fRes.rows[0];
    if (facture) {
      const pRes = await client.query(
        `INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference, notes, compte_tresorerie_id)
         VALUES ($1, $2, $3, 'mobile_money', $4, $5, $6) RETURNING *`,
        [
          facture.id, montant, datePaiement,
          s.session_id_externe,
          `Paiement ${fournisseurLabel} ${payeurTelephone || s.payeur_telephone || ''} ${payeurNom || ''}`.trim(),
          compteId,
        ]
      );
      paiement = pRes.rows[0];

      const nouveauPaye = Math.round((parseFloat(facture.montant_paye) + montant) * 100) / 100;
      const ttc = parseFloat(facture.total_ttc);
      const nouveauStatut = nouveauPaye >= ttc - 0.01 ? 'payee' : 'en_attente';
      await client.query(
        `UPDATE factures SET montant_paye = $1, statut = $2, updated_at = NOW() WHERE id = $3`,
        [nouveauPaye, nouveauStatut, facture.id]
      );
      facture.montant_paye = nouveauPaye;
      facture.statut = nouveauStatut;

      try {
        await ecriturePaiementFacture(client, {
          entrepriseId: eid, utilisateurId: s.cree_par, facture, paiement,
        });
      } catch (err) {
        console.warn('Écriture compta encaissement échouée:', err.message);
      }
    }
  }

  await client.query(
    `UPDATE sessions_paiement
     SET statut = 'payee', paye_at = NOW(), mouvement_id = $1,
         payeur_telephone = COALESCE($2, payeur_telephone),
         payeur_nom = COALESCE($3, payeur_nom),
         updated_at = NOW()
     WHERE id = $4`,
    [mouvementId, payeurTelephone, payeurNom, s.id]
  );

  return { session: s, facture, paiement, mouvement_id: mouvementId, deja_payee: false };
}

/**
 * POST /api/webhooks/:fournisseur/:entreprise_id
 * Endpoint PUBLIC appelé par Wave/Orange/MTN après une tentative de paiement.
 * La sécurité repose sur la signature configurée côté fournisseur.
 */
const webhookFournisseur = async (req, res) => {
  const client = await pool.connect();
  try {
    const { fournisseur, entreprise_id: entrepriseId } = req.params;
    if (!FOURNISSEURS_VALIDES.includes(fournisseur)) {
      return res.status(400).json({ success: false, message: 'Fournisseur invalide' });
    }
    if (!entrepriseId || !/^[0-9a-f-]{36}$/i.test(entrepriseId)) {
      return res.status(400).json({ success: false, message: 'Entreprise invalide' });
    }

    const intRes = await client.query(
      `SELECT api_key, webhook_secret, mode FROM integrations_paiement
       WHERE entreprise_id = $1 AND fournisseur = $2 AND actif = true`,
      [entrepriseId, fournisseur]
    );
    const integration = intRes.rows[0];
    if (!integration || !integration.webhook_secret) {
      return res.status(400).json({ success: false, message: 'Webhook secret non configuré' });
    }

    const signature = req.headers['x-signature']
                   || req.headers['wave-signature']
                   || req.headers['x-callback-signature'];
    const payloadBrut = req.rawBody?.toString('utf8') || JSON.stringify(req.body);

    // Aiguillage du verifier
    let signatureValide = false;
    if (fournisseur === 'wave') {
      signatureValide = wave.verifierSignatureWebhook({
        payloadBrut, signature, webhookSecret: integration.webhook_secret,
      });
    } else if (fournisseur === 'orange_money') {
      signatureValide = orange.verifierSignatureWebhook({
        payloadBrut, signature, webhookSecret: integration.webhook_secret,
        notifToken: integration.webhook_secret, // Orange : on stocke le notif_token côté secret
      });
    } else if (fournisseur === 'mtn_momo') {
      signatureValide = mtn.verifierSignatureWebhook({
        payloadBrut, signature, webhookSecret: integration.webhook_secret,
      });
    }
    if (!signatureValide) {
      return res.status(401).json({ success: false, message: 'Signature invalide' });
    }

    // Extraction de l'ID de session côté fournisseur + statut
    const event = req.body;
    let sessionExterne, statutExterne, payeurMobile, payeurNom;
    if (fournisseur === 'wave') {
      sessionExterne = event?.data?.id;
      statutExterne  = event?.type === 'checkout.session.completed' ? 'completed'
                     : event?.type === 'checkout.session.payment_failed' ? 'failed'
                     : 'pending';
      payeurMobile = event?.data?.payment_address?.mobile;
      payeurNom    = event?.data?.payment_address?.name;
    } else if (fournisseur === 'orange_money') {
      sessionExterne = event?.pay_token || event?.txnid;
      statutExterne  = event?.status === 'SUCCESS' ? 'completed'
                     : event?.status === 'FAILED'  ? 'failed' : 'pending';
      payeurMobile = event?.customer_msisdn;
    } else if (fournisseur === 'mtn_momo') {
      sessionExterne = event?.referenceId || event?.financialTransactionId;
      statutExterne  = event?.status === 'SUCCESSFUL' ? 'completed'
                     : event?.status === 'FAILED'     ? 'failed' : 'pending';
      payeurMobile = event?.payer?.partyId;
    }
    if (!sessionExterne) {
      return res.status(400).json({ success: false, message: 'Payload sans session id' });
    }

    const sRes = await client.query(
      `SELECT * FROM sessions_paiement WHERE fournisseur = $1 AND session_id_externe = $2`,
      [fournisseur, sessionExterne]
    );
    const session = sRes.rows[0];
    if (!session) {
      console.warn(`[webhook ${fournisseur}] session externe ${sessionExterne} inconnue`);
      return res.json({ success: true, ignored: true });
    }

    await client.query('BEGIN');

    if (statutExterne === 'completed') {
      const result = await encaisserSession(client, {
        session, payeurTelephone: payeurMobile, payeurNom,
      });
      await client.query(
        `UPDATE sessions_paiement SET raw_payload = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(event), session.id]
      );
      await client.query('COMMIT');
      return res.json({ success: true, deja_payee: result.deja_payee });
    }

    if (statutExterne === 'failed') {
      await client.query(
        `UPDATE sessions_paiement SET statut = 'echouee', raw_payload = $1, updated_at = NOW()
         WHERE id = $2 AND statut NOT IN ('payee')`,
        [JSON.stringify(event), session.id]
      );
      await client.query('COMMIT');
      return res.json({ success: true });
    }

    await client.query('COMMIT');
    return res.json({ success: true, ignored: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erreur webhookFournisseur:', err.message);
    res.status(500).json({ success: false, message: 'Erreur traitement webhook' });
  } finally {
    client.release();
  }
};

// Backwards-compat lot A.2
const webhookWave = (req, res) => {
  req.params.fournisseur = 'wave';
  return webhookFournisseur(req, res);
};

/**
 * POST /api/factures/:id/lien-paiement-wave/simuler-paiement
 *
 * Simule l'encaissement d'une session existante (mode 'mock' uniquement).
 * Réutilisable pour les 3 fournisseurs : prend la session active la plus
 * récente, peu importe le fournisseur.
 */
const simulerPaiementWave = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    const { id: factureId } = req.params;
    const eid = req.entrepriseId;
    const fournisseurDemande = (req.body?.fournisseur || 'wave').toLowerCase();

    // Vérifie le mode mock pour le fournisseur demandé
    const intRes = await dbClient.query(
      `SELECT mode FROM integrations_paiement
       WHERE entreprise_id = $1 AND fournisseur = $2 AND actif = true`,
      [eid, fournisseurDemande]
    );
    const mode = intRes.rows[0]?.mode || 'mock';
    if (mode !== 'mock') {
      return res.status(400).json({
        success: false,
        message: 'La simulation n\'est disponible qu\'en mode démo (mock).',
      });
    }

    const sRes = await dbClient.query(
      `SELECT * FROM sessions_paiement
       WHERE facture_id = $1 AND fournisseur = $2 AND statut IN ('initiee', 'en_attente')
       ORDER BY created_at DESC LIMIT 1`,
      [factureId, fournisseurDemande]
    );
    const session = sRes.rows[0];
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Aucune session de paiement active. Générez d\'abord un lien.',
      });
    }

    await dbClient.query('BEGIN');
    const result = await encaisserSession(dbClient, {
      session,
      payeurTelephone: session.payeur_telephone || '+225 07 00 00 00 00',
      payeurNom: 'Client Démo',
    });
    await dbClient.query('COMMIT');

    logAudit(req, 'PAY', 'sessions_paiement', session.id, {
      facture_id: factureId, fournisseur: fournisseurDemande,
      mode: 'mock-simulation', montant: parseFloat(session.montant),
    });

    return res.json({
      success: true,
      data: {
        deja_payee: result.deja_payee,
        montant: parseFloat(session.montant),
        fournisseur: fournisseurDemande,
        facture_statut: result.facture?.statut,
        facture_montant_paye: result.facture?.montant_paye,
      },
    });
  } catch (err) {
    try { await dbClient.query('ROLLBACK'); } catch {}
    console.error('Erreur simulerPaiement:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Erreur simulation' });
  } finally {
    dbClient.release();
  }
};

module.exports = {
  creerLienPaiementFacture,
  creerLienWaveFacture,        // alias backward-compat
  webhookFournisseur,
  webhookWave,                 // alias backward-compat
  simulerPaiementWave,
};
