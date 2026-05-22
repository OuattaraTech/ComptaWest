/**
 * Configuration des intégrations de paiement externes (Wave aujourd'hui,
 * Orange Money / MTN MoMo plus tard).
 *
 * Sécurité :
 *   - GET ne renvoie JAMAIS la clé API en clair. On renvoie un indicateur
 *     `api_key_set: true/false` + les 4 derniers caractères pour que
 *     l'admin reconnaisse la clé sans pouvoir la copier.
 *   - PUT n'accepte la clé que si elle est fournie (vide -> on garde celle
 *     déjà en base, utile pour modifier le mode sans re-saisir la clé).
 *   - Routes protégées par `entreprise.update` : seuls propriétaire + admin
 *     peuvent configurer.
 */

const pool = require('../../config/database');
const { logAudit } = require('../utils/audit');

const FOURNISSEURS_VALIDES = ['wave', 'orange_money', 'mtn_momo'];
const MODES_VALIDES = ['mock', 'sandbox', 'live'];

// Tronque une clé pour affichage : ne renvoie que les 4 derniers caractères
// précédés de •••• (jamais la clé entière).
const masquerCle = (cle) => {
  if (!cle) return null;
  const s = String(cle);
  return `•••• ${s.slice(-4)}`;
};

/**
 * GET /api/integrations-paiement
 * Liste les intégrations configurées pour l'entreprise courante.
 */
const listerIntegrations = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT i.fournisseur, i.mode, i.actif, i.compte_tresorerie_id,
              i.api_key, i.webhook_secret, i.created_at, i.updated_at,
              c.nom AS compte_nom, c.type AS compte_type
       FROM integrations_paiement i
       LEFT JOIN comptes_tresorerie c ON c.id = i.compte_tresorerie_id
       WHERE i.entreprise_id = $1
       ORDER BY i.fournisseur`,
      [req.entrepriseId]
    );
    const data = r.rows.map(row => ({
      fournisseur: row.fournisseur,
      mode: row.mode,
      actif: row.actif,
      compte_tresorerie_id: row.compte_tresorerie_id,
      compte_nom: row.compte_nom,
      compte_type: row.compte_type,
      api_key_set: !!row.api_key,
      api_key_apercu: masquerCle(row.api_key),
      webhook_secret_set: !!row.webhook_secret,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Erreur listerIntegrations:', err.message);
    res.status(500).json({ success: false, message: 'Erreur chargement intégrations' });
  }
};

/**
 * PUT /api/integrations-paiement/:fournisseur
 * Upsert l'intégration. Champs acceptés :
 *   - mode               : 'mock' | 'sandbox' | 'live'
 *   - actif              : boolean
 *   - api_key            : string (vide = inchangée)
 *   - webhook_secret     : string (vide = inchangée)
 *   - compte_tresorerie_id : UUID ou null
 */
const upsertIntegration = async (req, res) => {
  const client = await pool.connect();
  try {
    const { fournisseur } = req.params;
    if (!FOURNISSEURS_VALIDES.includes(fournisseur)) {
      return res.status(400).json({
        success: false,
        message: `Fournisseur invalide. Valeurs acceptées : ${FOURNISSEURS_VALIDES.join(', ')}`,
      });
    }

    const {
      mode = 'mock',
      actif = true,
      api_key,
      webhook_secret,
      compte_tresorerie_id,
    } = req.body;

    if (!MODES_VALIDES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Mode invalide. Valeurs acceptées : ${MODES_VALIDES.join(', ')}`,
      });
    }

    // En mode live, on exige clé + secret (sinon Wave ne pourra pas répondre)
    const existanteRes = await client.query(
      `SELECT api_key, webhook_secret, compte_tresorerie_id
       FROM integrations_paiement
       WHERE entreprise_id = $1 AND fournisseur = $2`,
      [req.entrepriseId, fournisseur]
    );
    const existante = existanteRes.rows[0];
    // Si la clé n'est pas fournie OU vide, on garde l'ancienne
    const cleFinale    = api_key && api_key.trim() ? api_key.trim() : (existante?.api_key || null);
    const secretFinal  = webhook_secret && webhook_secret.trim() ? webhook_secret.trim() : (existante?.webhook_secret || null);
    const compteFinal  = compte_tresorerie_id !== undefined ? compte_tresorerie_id : (existante?.compte_tresorerie_id || null);

    if (mode === 'live' && (!cleFinale || !secretFinal)) {
      return res.status(400).json({
        success: false,
        message: 'Mode live : clé API et webhook secret obligatoires.',
      });
    }

    // ── Quota par palier ─────────────────────────────────────────────
    // Découverte : 0 opérateur live (mode démo seulement).
    // Starter   : 1 opérateur live au choix.
    // Pro       : 2 opérateurs live au choix.
    // Cabinet   : 3 opérateurs (tous débloqués).
    // Le mode 'mock' n'est PAS compté — chacun peut tester sans débourser.
    if (mode === 'live' && actif) {
      const palierRes = await client.query(
        `SELECT palier FROM abonnements WHERE entreprise_id = $1 LIMIT 1`,
        [req.entrepriseId]
      ).catch(() => ({ rows: [] }));
      const palier = palierRes.rows[0]?.palier || 'decouverte';
      const { getQuotas } = require('../utils/quotas');
      const max = getQuotas(palier).paiement_fournisseurs;

      if (max === 0) {
        return res.status(402).json({
          success: false,
          code: 'QUOTA_PALIER',
          message: `Votre palier (${palier}) n'autorise pas le mode production. Passez en Starter pour activer un opérateur Mobile Money en réel.`,
        });
      }

      // Compte les opérateurs DÉJÀ actifs en live (hors celui qu'on est en train d'éditer)
      const activesRes = await client.query(
        `SELECT fournisseur FROM integrations_paiement
         WHERE entreprise_id = $1 AND mode = 'live' AND actif = true AND fournisseur != $2`,
        [req.entrepriseId, fournisseur]
      );
      if (activesRes.rows.length >= max) {
        return res.status(402).json({
          success: false,
          code: 'QUOTA_PALIER',
          message: `Votre palier (${palier}) limite à ${max} opérateur(s) Mobile Money actifs en production. `
                 + `Désactivez d'abord un opérateur ou passez à un palier supérieur.`,
          data: { actifs: activesRes.rows.map(r => r.fournisseur), max },
        });
      }
    }

    // Validation du compte de trésorerie : doit appartenir à l'entreprise
    if (compteFinal) {
      const cRes = await client.query(
        `SELECT id FROM comptes_tresorerie
         WHERE id = $1 AND entreprise_id = $2 AND archived_at IS NULL`,
        [compteFinal, req.entrepriseId]
      );
      if (!cRes.rows[0]) {
        return res.status(400).json({ success: false, message: 'Compte de trésorerie invalide' });
      }
    }

    const r = await client.query(
      `INSERT INTO integrations_paiement
         (entreprise_id, fournisseur, mode, actif, api_key, webhook_secret, compte_tresorerie_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (entreprise_id, fournisseur) DO UPDATE
         SET mode = EXCLUDED.mode,
             actif = EXCLUDED.actif,
             api_key = EXCLUDED.api_key,
             webhook_secret = EXCLUDED.webhook_secret,
             compte_tresorerie_id = EXCLUDED.compte_tresorerie_id,
             updated_at = NOW()
       RETURNING fournisseur, mode, actif, compte_tresorerie_id, api_key, webhook_secret`,
      [req.entrepriseId, fournisseur, mode, !!actif, cleFinale, secretFinal, compteFinal]
    );
    const row = r.rows[0];

    logAudit(req, 'UPDATE', 'integrations_paiement', null, {
      fournisseur, mode, actif: !!actif,
      api_key_changed: !!(api_key && api_key.trim()),
      webhook_secret_changed: !!(webhook_secret && webhook_secret.trim()),
    });

    res.json({
      success: true,
      data: {
        fournisseur: row.fournisseur,
        mode: row.mode,
        actif: row.actif,
        compte_tresorerie_id: row.compte_tresorerie_id,
        api_key_set: !!row.api_key,
        api_key_apercu: masquerCle(row.api_key),
        webhook_secret_set: !!row.webhook_secret,
      },
    });
  } catch (err) {
    console.error('Erreur upsertIntegration:', err.message);
    res.status(500).json({ success: false, message: 'Erreur enregistrement' });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/integrations-paiement/:fournisseur
 * Désactive l'intégration (actif=false). Conserve les credentials pour
 * réactivation rapide. Pour purger réellement, supprimer la ligne en SQL.
 */
const desactiverIntegration = async (req, res) => {
  try {
    const { fournisseur } = req.params;
    await pool.query(
      `UPDATE integrations_paiement
       SET actif = false, updated_at = NOW()
       WHERE entreprise_id = $1 AND fournisseur = $2`,
      [req.entrepriseId, fournisseur]
    );
    logAudit(req, 'UPDATE', 'integrations_paiement', null, { fournisseur, actif: false });
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur desactiverIntegration:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

module.exports = { listerIntegrations, upsertIntegration, desactiverIntegration };
