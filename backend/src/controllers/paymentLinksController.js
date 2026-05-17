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
const { creerCheckoutSession } = require('../utils/wave');
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

module.exports = { creerLienWaveFacture };
