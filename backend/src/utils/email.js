/**
 * Service d'envoi d'emails ultra-léger — sans dépendance externe.
 *
 * Stratégie en cascade :
 *   1. Si RESEND_API_KEY est configurée → envoi via API Resend (HTTPS)
 *      (Resend = 100 emails/jour gratuits, parfait pour démarrer)
 *   2. Sinon → mode log : on écrit le message dans audit_log + console
 *      (utile en dev, et en prod tant que le SMTP n'est pas branché —
 *      les emails ratés sont rejouables manuellement depuis l'admin)
 *
 * Variables d'env requises pour l'envoi réel :
 *   RESEND_API_KEY     — clé API Resend (re_xxxx)
 *   EMAIL_FROM         — adresse expéditeur (ex : "ApeX <noreply@apex.ci>")
 *   FRONTEND_URL       — base URL pour les liens dans les emails
 */
const pool = require('../../config/database');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Envoie un email. Retourne { sent: bool, mode: 'resend'|'logged', error? }.
 * Ne throw JAMAIS : un email raté n'est pas une erreur fatale.
 */
async function envoyerEmail({ to, subject, html, text, replyTo, tags = {} }) {
  if (!to || !subject || (!html && !text)) {
    return { sent: false, mode: 'invalid', error: 'to/subject/body manquant' };
  }

  // Mode RESEND (envoi réel)
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'ApeX <noreply@apex.ci>',
          to: Array.isArray(to) ? to : [to],
          subject,
          html: html || undefined,
          text: text || undefined,
          reply_to: replyTo || undefined,
          tags: Object.entries(tags).map(([name, value]) => ({ name, value })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error(`[EMAIL][resend] FAIL ${r.status} →`, data);
        await logEmailFail(to, subject, `Resend HTTP ${r.status} : ${JSON.stringify(data)}`);
        return { sent: false, mode: 'resend', error: data.message || `HTTP ${r.status}` };
      }
      console.log(`[EMAIL][resend] ✓ ${to} — ${subject} (id ${data.id})`);
      return { sent: true, mode: 'resend', id: data.id };
    } catch (err) {
      console.error('[EMAIL][resend] EXCEPTION', err.message);
      await logEmailFail(to, subject, err.message);
      return { sent: false, mode: 'resend', error: err.message };
    }
  }

  // Mode LOG (pas de SMTP configuré)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📧 [EMAIL — mode log] → ${to}`);
  console.log(`   Sujet : ${subject}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log((text || html || '').slice(0, 500));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await logEmailFail(to, subject, 'RESEND_API_KEY non configurée — email loggé en console uniquement');
  return { sent: false, mode: 'logged' };
}

async function logEmailFail(to, subject, raison) {
  try {
    await pool.query(
      `INSERT INTO audit_log (utilisateur_email, action, entite, details)
       VALUES ($1, 'EMAIL_NOT_SENT', 'email', $2)`,
      [to, JSON.stringify({ subject, raison })]
    );
  } catch (err) { /* swallow : audit_log peut ne pas exister en très ancienne base */ }
}

module.exports = { envoyerEmail };
