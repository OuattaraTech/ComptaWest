/**
 * Service d'envoi d'emails ApeX — sans dépendance externe (fetch natif).
 *
 * Stratégie en cascade :
 *   1. Si RESEND_API_KEY est configurée → envoi via l'API Resend (HTTPS)
 *      (Resend = 100 mails/jour gratuits, parfait pour démarrer).
 *   2. Sinon → mode log : on écrit le message dans audit_log + console
 *      (utile en dev et tant que le SMTP n'est pas branché — les emails
 *      ratés sont rejouables manuellement depuis l'admin).
 *
 * Bonnes pratiques anti-spam appliquées :
 *   - Header `Reply-To` toujours présent (boîte support relevée par un humain).
 *   - Header `List-Unsubscribe` (RFC 8058) avec lien `mailto:` — la plupart
 *     des moteurs anti-spam (Gmail, Microsoft) réduisent fortement le score
 *     spam quand ce header est présent et que l'expéditeur a SPF + DKIM PASS.
 *   - Header `X-Entity-Ref-ID` pour le suivi des envois côté Resend.
 *   - Champ `from` toujours avec un libellé humain (ex. "ApeX <noreply@useapex.ci>").
 *
 * Variables d'env utilisées :
 *   RESEND_API_KEY     — clé API Resend (re_xxxx)
 *   EMAIL_FROM         — adresse expéditeur (défaut "ApeX <noreply@useapex.ci>")
 *   EMAIL_REPLY_TO     — adresse de réponse (défaut SUPPORT_EMAIL ou support@useapex.ci)
 *   SUPPORT_EMAIL      — email du support (fallback Reply-To et List-Unsubscribe)
 *   FRONTEND_URL       — base URL pour les liens dans les emails
 */
'use strict';

const pool = require('../../config/database');
const crypto = require('crypto');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function getFrom() {
  return process.env.EMAIL_FROM || 'ApeX <noreply@useapex.ci>';
}
function getReplyTo() {
  return process.env.EMAIL_REPLY_TO || process.env.SUPPORT_EMAIL || 'support@useapex.ci';
}
function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || 'support@useapex.ci';
}

/**
 * Envoie un email. Retourne { sent: bool, mode: 'resend'|'logged', id?, error? }.
 * Ne throw JAMAIS : un email raté n'est pas une erreur fatale côté flow métier.
 *
 * @param {object}   opts
 * @param {string|string[]} opts.to     Destinataire(s)
 * @param {string}   opts.subject       Sujet
 * @param {string}   [opts.html]        Corps HTML
 * @param {string}   [opts.text]        Corps texte (fallback)
 * @param {string}   [opts.replyTo]     Override du Reply-To (sinon EMAIL_REPLY_TO)
 * @param {object}   [opts.tags]        Tags (envoyés à Resend pour analytics)
 * @param {object}   [opts.headers]     Headers SMTP additionnels (List-Unsubscribe, etc.)
 */
async function envoyerEmail({ to, subject, html, text, replyTo, tags = {}, headers = {} }) {
  if (!to || !subject || (!html && !text)) {
    return { sent: false, mode: 'invalid', error: 'to/subject/body manquant' };
  }

  // Headers anti-spam et de traçage (toujours appliqués sauf override explicite)
  const support = getSupportEmail();
  const finalHeaders = {
    'List-Unsubscribe': `<mailto:${support}?subject=Désinscription>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'X-Entity-Ref-ID': crypto.randomUUID(),
    ...headers,
  };

  // Mode RESEND (envoi réel)
  if (process.env.RESEND_API_KEY) {
    try {
      const payload = {
        from: getFrom(),
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || undefined,
        text: text || undefined,
        reply_to: replyTo || getReplyTo(),
        headers: finalHeaders,
        tags: Object.entries(tags).map(([name, value]) => ({ name, value: String(value) })),
      };

      const r = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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

  // Mode LOG (pas de RESEND_API_KEY)
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
  } catch (_) { /* swallow : audit_log peut ne pas exister sur une très ancienne base */ }
}

module.exports = { envoyerEmail };
