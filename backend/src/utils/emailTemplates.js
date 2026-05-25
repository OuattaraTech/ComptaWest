/**
 * Templates HTML pour les emails ApeX.
 * Design minimaliste compatible avec Gmail / Yahoo / Outlook (inline CSS).
 * Couleurs marque : émeraude #10B981, noir #0A0F18, gris #6B7280.
 *
 * Chaque template retourne { subject, html, text } prêt à passer à envoyerEmail().
 */

const BASE_STYLE = `
  body { margin: 0; padding: 0; background: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .container { max-width: 580px; margin: 32px auto; background: #FFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #10B981, #0F8A6E); padding: 32px; text-align: center; color: #FFF; }
  .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
  .body { padding: 32px; color: #1F2937; font-size: 15px; line-height: 1.6; }
  .body h2 { font-size: 20px; font-weight: 700; margin-top: 24px; }
  .button { display: inline-block; padding: 14px 32px; background: #10B981; color: #000 !important; text-decoration: none; border-radius: 10px; font-weight: 700; margin: 16px 0; }
  .benefits { background: #ECFDF5; border-left: 4px solid #10B981; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .benefits ul { margin: 8px 0; padding-left: 20px; }
  .benefits li { margin: 6px 0; }
  .footer { padding: 20px 32px; background: #F9FAFB; color: #6B7280; font-size: 12px; text-align: center; border-top: 1px solid #E5E7EB; }
  .footer a { color: #10B981; text-decoration: none; }
  .small { font-size: 12px; color: #6B7280; }
`;

function wrap(headerTitle, bodyHtml, footerNote = '') {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${headerTitle}</title>
<style>${BASE_STYLE}</style></head>
<body>
  <div class="container">
    <div class="header"><h1>${headerTitle}</h1></div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">
      ${footerNote ? footerNote + '<br><br>' : ''}
      ApeX · La gestion de votre PME, made in Côte d'Ivoire 🇨🇮<br>
      <a href="https://apex.ci">apex.ci</a> ·
      <a href="https://apex.ci/cgu">CGU</a> ·
      <a href="https://apex.ci/confidentialite">Confidentialité</a>
    </div>
  </div>
</body></html>`;
}

// ─── Invitation PME par un cabinet partenaire ─────────────────────────────
function invitationPme({ cabinet_nom, lien_invitation, remise_pct = 15, nom_pme }) {
  const subject = `${cabinet_nom} vous invite sur ApeX (-${remise_pct} % la 1ère année)`;
  const html = wrap('Votre cabinet vous invite sur ApeX', `
    <p>Bonjour${nom_pme ? ' ' + nom_pme : ''},</p>
    <p>Votre cabinet comptable <strong>${cabinet_nom}</strong> vous invite à rejoindre <strong>ApeX</strong>,
    le logiciel de gestion comptable conçu pour les PME ivoiriennes.</p>

    <div class="benefits">
      <strong>🎁 En finalisant votre inscription via ce lien :</strong>
      <ul>
        <li><strong>14 jours d'essai gratuit</strong> de toutes les fonctionnalités</li>
        <li><strong>-${remise_pct} % de remise</strong> sur votre abonnement la 1ère année</li>
        <li>Votre cabinet a un <strong>accès direct</strong> à votre dossier</li>
        <li>Facturation FNE, paie CNPS 2024, comptabilité SYSCOHADA automatisées</li>
      </ul>
    </div>

    <p style="text-align: center;">
      <a href="${lien_invitation}" class="button">Activer mon compte ApeX</a>
    </p>

    <p class="small">Ce lien est personnel et expire dans 30 jours. Si le bouton ne fonctionne pas,
    copiez-collez cette URL dans votre navigateur :<br>
    <span style="color:#10B981;">${lien_invitation}</span></p>
  `, `Vous recevez cet email car votre cabinet ${cabinet_nom} vous a invité.`);
  const text = `Bonjour,

Votre cabinet ${cabinet_nom} vous invite sur ApeX, le logiciel de gestion pour PME ivoiriennes.

🎁 En finalisant votre inscription via ce lien :
  - 14 jours d'essai gratuit
  - -${remise_pct} % de remise la 1ère année
  - Accès direct du cabinet à votre dossier
  - Facturation FNE, paie CNPS 2024, comptabilité SYSCOHADA automatisées

Activez votre compte : ${lien_invitation}

Ce lien expire dans 30 jours.

— ApeX
`;
  return { subject, html, text };
}

// ─── Relance J+2 sur invitation pending ───────────────────────────────────
function relanceInvitationPme({ cabinet_nom, lien_invitation, remise_pct = 15, nom_pme }) {
  const subject = `Rappel : votre invitation ApeX de ${cabinet_nom} expire bientôt`;
  const html = wrap('Votre invitation ApeX est en attente', `
    <p>Bonjour${nom_pme ? ' ' + nom_pme : ''},</p>
    <p>Il y a quelques jours, votre cabinet <strong>${cabinet_nom}</strong> vous a invité(e)
    à rejoindre ApeX. Nous voulions juste nous assurer que le message n'a pas été perdu
    dans vos emails.</p>

    <div class="benefits">
      <strong>Rappel des avantages :</strong>
      <ul>
        <li>14 jours d'essai gratuit, sans carte bancaire</li>
        <li><strong>-${remise_pct} %</strong> sur votre abonnement la 1ère année</li>
        <li>Configuration en 2 minutes (compte créé directement)</li>
      </ul>
    </div>

    <p style="text-align: center;">
      <a href="${lien_invitation}" class="button">Activer mon compte maintenant</a>
    </p>

    <p>Si vous avez des questions, répondez directement à cet email — notre équipe
    basée à Abidjan répond sous 2h ouvrées.</p>
  `, `Vous pouvez ignorer ce rappel si vous n'êtes plus intéressé. Aucun autre email automatique ne vous sera envoyé.`);
  const text = `Bonjour,

Il y a quelques jours, votre cabinet ${cabinet_nom} vous a invité(e) sur ApeX.

🎁 Rappel :
  - 14 jours d'essai gratuit, sans carte bancaire
  - -${remise_pct} % la 1ère année
  - Configuration en 2 minutes

Activez maintenant : ${lien_invitation}

Une question ? Répondez à cet email.

— ApeX
`;
  return { subject, html, text };
}

// ─── Activation du compte Cabinet Partenaire ──────────────────────────────
function activationCabinet({ cabinet_nom, code_parrain, lien_portail = 'https://apex.ci/login' }) {
  const subject = `🚀 Activation de votre espace Cabinet Partenaire ApeX`;
  const html = wrap('Bienvenue, Cabinet Partenaire', `
    <p>Bonjour,</p>
    <p>C'est un plaisir de vous compter parmi nos <strong>Cabinets Partenaires ApeX</strong>.</p>

    <p>Votre espace <strong>${cabinet_nom}</strong> a été configuré et activé avec succès.
    Votre licence professionnelle (accès multi-dossiers, révision SYSCOHADA, conformité ITS 2024,
    support prioritaire 2h) est <strong>intégralement offerte</strong> par notre programme de
    soutien à la digitalisation.</p>

    <div class="benefits">
      <strong>Votre code parrain unique :</strong>
      <div style="font-family: monospace; font-size: 24px; font-weight: 700; color: #10B981; margin-top: 10px; letter-spacing: 0.04em;">${code_parrain}</div>
      <p class="small" style="margin-top: 8px;">Lien à partager à vos clients PME :<br>
      <span style="color:#10B981;">https://apex.ci/r/${code_parrain}</span></p>
    </div>

    <h2>Démarrez en 3 étapes</h2>
    <ol>
      <li>Connectez-vous à votre portail sécurisé</li>
      <li>Cliquez sur <em>Inviter une PME</em> pour ajouter votre 1<sup>er</sup> client de test</li>
      <li>Observez : le client active son compte, vous voyez instantanément son dossier sur votre tableau de bord</li>
    </ol>

    <p style="text-align: center;">
      <a href="${lien_portail}" class="button">Accéder à mon portail</a>
    </p>

    <p>Notre équipe reste à votre disposition sur WhatsApp pour vous accompagner lors de vos
    premières liaisons clients.</p>
  `, `Programme Partenaires ApeX — réservé aux cabinets membres ONECCA.`);
  const text = `Bonjour,

Bienvenue parmi nos Cabinets Partenaires ApeX.

Votre espace ${cabinet_nom} est activé. Licence professionnelle entièrement offerte.

Votre code parrain : ${code_parrain}
Lien à partager : https://apex.ci/r/${code_parrain}

Démarrez en 3 étapes :
  1. Connectez-vous à votre portail
  2. Invitez votre 1er client PME
  3. Observez son activation en temps réel

Accédez à votre portail : ${lien_portail}

— ApeX
`;
  return { subject, html, text };
}

// ─── Invitation directe d'un cabinet par le super-admin ───────────────────
// Différent de `activationCabinet` (qui suit une candidature spontanée) :
// ici l'admin choisit personnellement le cabinet et l'invite.
// Le ton est chaleureux, signé, avec un message personnel optionnel.
function invitationDirecteCabinet({ nom_responsable, lien_activation, message_personnel, expediteur_nom = "L'équipe ApeX" }) {
  const prenom = (nom_responsable || '').trim().split(/\s+/)[0] || nom_responsable;
  const subject = `${prenom}, je vous propose une licence cabinet partenaire ApeX`;

  const messageBloc = message_personnel ? `
    <div style="padding: 16px 20px; background: #F0FDF4; border-left: 4px solid #10B981; border-radius: 0 8px 8px 0; margin: 20px 0; font-style: italic; color: #1F2937;">
      ${message_personnel.replace(/\n/g, '<br>')}
    </div>` : '';

  const html = wrap('Programme Partenaires Cabinets', `
    <p>Bonjour ${nom_responsable},</p>

    <p>Je vous écris personnellement pour vous proposer de rejoindre le
    <strong>Programme Partenaires Cabinets ApeX</strong> — réservé aux
    experts-comptables ONECCA qui accompagnent les PME ivoiriennes au quotidien.</p>

    ${messageBloc}

    <div class="benefits">
      <strong>Vos avantages, 100 % offerts :</strong>
      <ul>
        <li><strong>Licence cabinet complète</strong> — dossiers clients illimités, révision SYSCOHADA, conformité ITS 2024</li>
        <li><strong>Code parrain personnel</strong> à partager à vos clients PME (qui obtiennent une remise sur leur 1ère année)</li>
        <li><strong>Commission</strong> sur chaque PME parrainée (modalités à valider ensemble)</li>
        <li>Support prioritaire WhatsApp en <strong>2 h ouvrées</strong></li>
        <li>Une <strong>page dédiée</strong> sur apex.ci où votre cabinet apparaît en référence</li>
      </ul>
    </div>

    <p style="text-align: center;">
      <a href="${lien_activation}" class="button">Activer mon compte cabinet</a>
    </p>

    <p class="small">L'inscription prend 2 minutes : vous définissez votre mot de passe,
    votre code parrain est généré automatiquement, vous pouvez inviter vos premiers
    clients dans la foulée.</p>

    <p>Le lien ci-dessus est personnel et expire dans 30 jours. Si une question vous
    vient, répondez simplement à ce mail ou écrivez-nous sur WhatsApp.</p>

    <p>À très bientôt,<br>
    <strong>${expediteur_nom}</strong><br>
    <span class="small">ApeX · Programme Partenaires</span></p>
  `, `Invitation personnelle envoyée par ${expediteur_nom}. Vous pouvez ignorer ce mail si le projet ne vous intéresse pas — aucun rappel automatique ne sera envoyé.`);

  const text = `Bonjour ${nom_responsable},

Je vous écris personnellement pour vous proposer de rejoindre le Programme
Partenaires Cabinets ApeX — réservé aux experts-comptables ONECCA.

${message_personnel ? '\n' + message_personnel + '\n' : ''}
Vos avantages, 100 % offerts :
  - Licence cabinet complète (dossiers illimités, révision SYSCOHADA, ITS 2024)
  - Code parrain personnel à partager à vos clients PME
  - Commission sur chaque PME parrainée
  - Support prioritaire WhatsApp 2 h ouvrées
  - Page dédiée sur apex.ci

Activez votre compte (lien personnel, expire dans 30 jours) :
${lien_activation}

À très bientôt,
${expediteur_nom}
— ApeX
`;
  return { subject, html, text };
}

module.exports = { invitationPme, relanceInvitationPme, activationCabinet, invitationDirecteCabinet };
