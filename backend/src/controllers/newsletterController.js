/**
 * Newsletter ApeX — inscription publique depuis le pied de page de la landing.
 *
 * Routes :
 *   POST /api/newsletter                       → inscription (email)
 *   GET  /api/newsletter/desabonnement/:token  → désinscription en un clic
 *
 * Aucune authentification : ce sont des prospects, pas des utilisateurs.
 * L'envoi de l'email de bienvenue est en « fire-and-forget » : il ne doit
 * jamais retarder ni faire échouer la réponse HTTP.
 */
'use strict';

const pool = require('../../config/database');
const { body } = require('express-validator');
const { envoyerEmail } = require('../utils/email');
const { bienvenueNewsletter } = require('../utils/emailTemplates');
const { ajouterContact, desabonnerContact } = require('../utils/resendAudience');

const subscribeRules = [
  body('email')
    .trim()
    .isEmail().withMessage('Email invalide')
    .normalizeEmail()
    .isLength({ max: 255 }),
  body('langue')
    .optional()
    .isIn(['fr', 'en']).withMessage('Langue invalide'),
];

const BACKEND_BASE = () =>
  (process.env.BACKEND_BASE_URL || '').replace(/\/+$/, '');

// POST /api/newsletter
const subscribe = async (req, res) => {
  const email = req.body.email;
  const langue = req.body.langue === 'en' ? 'en' : 'fr';
  const ip = (req.ip || '').slice(0, 64);

  try {
    // Upsert idempotent : ré-inscription après désabonnement = réactivation.
    // `xmax = 0` distingue une vraie insertion d'une mise à jour ; la CTE
    // `prev` capture le statut AVANT l'upsert pour repérer une réactivation.
    const r = await pool.query(
      `WITH prev AS (
         SELECT statut AS ancien_statut FROM newsletter_abonnes WHERE email = $1
       )
       INSERT INTO newsletter_abonnes (email, langue, source, ip)
       VALUES ($1, $2, 'footer', $3)
       ON CONFLICT (email) DO UPDATE
         SET statut = 'actif',
             langue = EXCLUDED.langue,
             maj_le = NOW(),
             desabonne_le = NULL
       RETURNING unsubscribe_token,
                 (xmax = 0) AS is_new,
                 (SELECT ancien_statut FROM prev) AS ancien_statut`,
      [email, langue, ip]
    );

    const { unsubscribe_token, is_new, ancien_statut } = r.rows[0];
    const dejaActif = !is_new && ancien_statut === 'actif';

    // Miroir vers l'audience Resend (pour l'envoi des newsletters via
    // Broadcasts). Fire-and-forget, ne bloque jamais la réponse.
    ajouterContact({ email }).catch(() => {});

    // Email de bienvenue uniquement pour une nouvelle inscription ou une
    // réactivation — on n'inonde pas quelqu'un qui resoumet par mégarde.
    if (!dejaActif) {
      const lien_desabo = BACKEND_BASE()
        ? `${BACKEND_BASE()}/api/newsletter/desabonnement/${unsubscribe_token}`
        : null;
      const { subject, html, text } = bienvenueNewsletter({ lien_desabo });
      envoyerEmail({
        to: email,
        subject, html, text,
        tags: { type: 'newsletter_bienvenue', langue },
        headers: lien_desabo
          ? { 'List-Unsubscribe': `<${lien_desabo}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
          : {},
      }).catch(() => { /* fire-and-forget */ });
    }

    return res.json({
      success: true,
      statut: dejaActif ? 'deja_abonne' : (is_new ? 'inscrit' : 'reactive'),
      message: dejaActif
        ? 'Vous êtes déjà abonné·e — merci !'
        : 'Inscription confirmée. Vérifiez votre boîte mail.',
    });
  } catch (err) {
    console.error('[newsletter][subscribe]', err.message);
    return res.status(500).json({ success: false, message: "Inscription impossible pour l'instant." });
  }
};

// GET /api/newsletter/desabonnement/:token
// Désinscription en un clic (header List-Unsubscribe + lien email). Renvoie
// une petite page HTML de confirmation, sans dépendre du frontend.
const desabonner = async (req, res) => {
  const { token } = req.params;
  const page = (titre, message) => `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre} — ApeX</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       background:#0E1116;color:#E8EAE3;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{max-width:440px;text-align:center;background:#151A21;border:1px solid #2A323E;border-radius:18px;padding:40px 32px}
  h1{font-size:22px;margin:0 0 12px}
  p{color:#A9B1BC;line-height:1.6;margin:0 0 24px}
  a{display:inline-block;background:#2DBF9C;color:#0A1411;text-decoration:none;font-weight:700;
    padding:12px 22px;border-radius:10px}
</style></head><body><div class="card">
  <h1>${titre}</h1><p>${message}</p>
  <a href="${(process.env.FRONTEND_URL || 'https://useapex.ci').replace(/\/+$/, '')}">Retour sur ApeX</a>
</div></body></html>`;

  // Garde-fou : un token mal formé ne doit pas atteindre la requête SQL.
  if (!/^[0-9a-f-]{36}$/i.test(token || '')) {
    return res.status(400).send(page('Lien invalide', 'Ce lien de désinscription est incorrect ou incomplet.'));
  }

  try {
    const r = await pool.query(
      `UPDATE newsletter_abonnes
          SET statut = 'desabonne', desabonne_le = NOW(), maj_le = NOW()
        WHERE unsubscribe_token = $1 AND statut = 'actif'
      RETURNING email`,
      [token]
    );
    if (r.rowCount === 0) {
      return res.send(page('Déjà désabonné·e', 'Vous ne recevez plus la lettre ApeX. Rien à faire de plus.'));
    }
    // Reflète le désabonnement dans l'audience Resend (fire-and-forget).
    desabonnerContact(r.rows[0].email).catch(() => {});
    return res.send(page('Désinscription confirmée', 'Vous ne recevrez plus la lettre ApeX. Vous pouvez vous réabonner à tout moment depuis le site.'));
  } catch (err) {
    console.error('[newsletter][desabonner]', err.message);
    return res.status(500).send(page('Erreur', "La désinscription a échoué. Réessayez plus tard ou écrivez-nous."));
  }
};

module.exports = { subscribe, subscribeRules, desabonner };
