/**
 * Templates HTML pour les emails transactionnels ApeX.
 *
 * Principes de rédaction :
 *   - Voix d'entreprise (« nous », « l'équipe ApeX ») — jamais à la 1re personne du singulier.
 *     Les emails B2B doivent paraître institutionnels et engager la responsabilité d'ApeX,
 *     pas celle d'un signataire individuel.
 *   - Tutoiement bannit. Vouvoiement systématique pour PME et cabinets.
 *   - URLs toujours sur le domaine officiel useapex.ci (jamais apex.ci, qui appartient
 *     à un tiers depuis 2018).
 *   - Liens d'action absolus, avec base = PUBLIC_URL ou FRONTEND_URL.
 *   - HTML inline-CSS uniquement (compat Gmail / Outlook / Yahoo).
 *
 * Chaque template retourne { subject, html, text } prêt à passer à envoyerEmail().
 */
'use strict';

// URL publique de l'app (CTA, activation, portail). Inclut /xxx déjà avec slash absolu.
const APP_URL = () => (process.env.FRONTEND_URL || 'https://app.useapex.ci').replace(/\/+$/, '');
// URL de la landing publique (page d'accueil, CGU, confidentialité).
const PUBLIC_URL = () => (process.env.PUBLIC_URL || 'https://useapex.ci').replace(/\/+$/, '');
// Email de support affiché dans les pieds de page et les réponses.
const SUPPORT_EMAIL = () => process.env.SUPPORT_EMAIL || 'support@useapex.ci';

const BASE_STYLE = `
  body { margin: 0; padding: 0; background: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
  .container { max-width: 580px; margin: 32px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08); }
  .header { background: linear-gradient(135deg, #10B981, #0F8A6E); padding: 36px 32px; text-align: center; color: #FFFFFF; }
  .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.015em; }
  .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.92; }
  .body { padding: 32px; color: #1F2937; font-size: 15px; line-height: 1.65; }
  .body p { margin: 0 0 14px; }
  .body h2 { font-size: 17px; font-weight: 700; margin: 24px 0 12px; color: #0F172A; }
  .button { display: inline-block; padding: 14px 32px; background: #10B981; color: #FFFFFF !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; }
  .button-wrap { text-align: center; margin: 24px 0; }
  .benefits { background: #ECFDF5; border-left: 4px solid #10B981; padding: 18px 22px; margin: 22px 0; border-radius: 0 8px 8px 0; }
  .benefits strong { color: #065F46; }
  .benefits ul { margin: 10px 0 0; padding-left: 20px; }
  .benefits li { margin: 6px 0; }
  .code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 22px; font-weight: 700; color: #065F46; background: #FFFFFF; border: 1px solid #A7F3D0; padding: 10px 14px; border-radius: 8px; display: inline-block; letter-spacing: 0.05em; }
  .footer { padding: 22px 32px; background: #F9FAFB; color: #6B7280; font-size: 12px; text-align: center; border-top: 1px solid #E5E7EB; line-height: 1.6; }
  .footer a { color: #10B981; text-decoration: none; }
  .footer .brand { font-weight: 700; color: #0F172A; }
  .small { font-size: 12px; color: #6B7280; }
  .signature { margin-top: 28px; padding-top: 18px; border-top: 1px solid #E5E7EB; color: #4B5563; font-size: 14px; line-height: 1.5; }
`;

/**
 * Enveloppe HTML standard.
 * @param {string} preheader Texte invisible affiché en aperçu boîte mail (90 chars max).
 * @param {string} headerTitle Titre dans l'entête vert.
 * @param {string} headerSubtitle Sous-titre optionnel.
 * @param {string} bodyHtml Contenu HTML principal (déjà échappé / sécurisé).
 * @param {string} footerNote Phrase additionnelle au-dessus du footer commun.
 */
function wrap(preheader, headerTitle, headerSubtitle, bodyHtml, footerNote = '') {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${headerTitle}</title>
  <style>${BASE_STYLE}</style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="container">
    <div class="header">
      <h1>${headerTitle}</h1>
      ${headerSubtitle ? `<p>${headerSubtitle}</p>` : ''}
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">
      ${footerNote ? footerNote + '<br><br>' : ''}
      <span class="brand">ApeX</span> · Logiciel de gestion SYSCOHADA pour les PME ivoiriennes 🇨🇮<br>
      <a href="${PUBLIC_URL()}">useapex.ci</a> ·
      <a href="${PUBLIC_URL()}/cgu">CGU</a> ·
      <a href="${PUBLIC_URL()}/confidentialite">Confidentialité</a> ·
      <a href="mailto:${SUPPORT_EMAIL()}">${SUPPORT_EMAIL()}</a>
    </div>
  </div>
</body></html>`;
}

// ─── Invitation PME par un cabinet partenaire ─────────────────────────────
function invitationPme({ cabinet_nom, lien_invitation, remise_pct = 15, nom_pme }) {
  const subject = `${cabinet_nom} vous invite à digitaliser votre comptabilité avec ApeX`;
  const preheader = `Votre cabinet ${cabinet_nom} vous offre 14 jours d'essai et ${remise_pct}% de remise sur ApeX.`;
  const civilite = nom_pme ? ` ${nom_pme}` : '';

  const html = wrap(preheader, 'Votre cabinet vous invite sur ApeX', `Programme partenaire ${cabinet_nom}`, `
    <p>Bonjour${civilite},</p>

    <p>Votre cabinet d'expertise comptable <strong>${cabinet_nom}</strong> vous invite à
    rejoindre <strong>ApeX</strong>, la plateforme de gestion comptable et fiscale conçue
    pour les PME ivoiriennes en conformité SYSCOHADA, FNE et CNPS.</p>

    <p>Avec ApeX, vous et votre cabinet partagez un dossier unique en temps réel :
    fini les allers-retours d'Excel, les pièces oubliées et les écritures à ressaisir.</p>

    <div class="benefits">
      <strong>Vos avantages, activés via ce lien :</strong>
      <ul>
        <li><strong>14 jours d'essai gratuit</strong>, sans carte bancaire ni engagement</li>
        <li><strong>−${remise_pct} % de remise</strong> sur votre abonnement la première année</li>
        <li><strong>Accès direct</strong> de votre cabinet à votre dossier, sans export ni envoi de fichier</li>
        <li>Facturation FNE certifiée, paie CNPS&nbsp;2024, comptabilité SYSCOHADA automatisée</li>
        <li>Configuration en moins de 5 minutes (plan comptable, exercice, rubriques pré-paramétrés)</li>
      </ul>
    </div>

    <div class="button-wrap">
      <a href="${lien_invitation}" class="button">Activer mon compte ApeX</a>
    </div>

    <p class="small">Ce lien est personnel et expire dans 30 jours. Si le bouton ne s'ouvre pas,
    copiez l'URL suivante dans votre navigateur&nbsp;:<br>
    <span style="color:#10B981; word-break: break-all;">${lien_invitation}</span></p>

    <div class="signature">
      L'équipe ApeX<br>
      <span class="small">Support&nbsp;: <a href="mailto:${SUPPORT_EMAIL()}" style="color:#10B981;">${SUPPORT_EMAIL()}</a></span>
    </div>
  `, `Vous recevez cet email car votre cabinet ${cabinet_nom} vous a invité(e). Vous pouvez l'ignorer si vous n'êtes pas intéressé(e).`);

  const text = `Bonjour${civilite},

Votre cabinet ${cabinet_nom} vous invite à rejoindre ApeX, la plateforme
de gestion comptable et fiscale pour les PME ivoiriennes (SYSCOHADA, FNE, CNPS).

Vos avantages, activés via ce lien :
  • 14 jours d'essai gratuit, sans carte bancaire
  • −${remise_pct} % de remise la première année
  • Accès direct de votre cabinet à votre dossier
  • Facturation FNE certifiée, paie CNPS 2024
  • Comptabilité SYSCOHADA automatisée
  • Configuration en moins de 5 minutes

Activez votre compte :
${lien_invitation}

Ce lien est personnel et expire dans 30 jours.

— L'équipe ApeX
Support : ${SUPPORT_EMAIL()}
${PUBLIC_URL()}
`;
  return { subject, html, text };
}

// ─── Relance J+2 sur invitation pending ───────────────────────────────────
function relanceInvitationPme({ cabinet_nom, lien_invitation, remise_pct = 15, nom_pme }) {
  const subject = `Rappel — votre invitation ApeX de ${cabinet_nom} reste valable`;
  const preheader = `Quelques jours qu'elle vous attend. ${remise_pct}% de remise + 14 jours offerts.`;
  const civilite = nom_pme ? ` ${nom_pme}` : '';

  const html = wrap(preheader, 'Votre invitation ApeX vous attend', `Rappel courtois — sans relance automatique supplémentaire`, `
    <p>Bonjour${civilite},</p>

    <p>Il y a quelques jours, votre cabinet <strong>${cabinet_nom}</strong> vous a invité(e)
    à rejoindre ApeX. Nous nous permettons ce rappel courtois au cas où le message
    précédent vous serait passé inaperçu.</p>

    <div class="benefits">
      <strong>Vos avantages restent activables jusqu'à expiration du lien&nbsp;:</strong>
      <ul>
        <li>14 jours d'essai gratuit, sans carte bancaire</li>
        <li><strong>−${remise_pct} %</strong> sur votre abonnement la première année</li>
        <li>Configuration guidée en 5 minutes</li>
      </ul>
    </div>

    <div class="button-wrap">
      <a href="${lien_invitation}" class="button">Activer mon compte maintenant</a>
    </div>

    <p>Pour toute question, vous pouvez répondre directement à cet email — notre équipe
    basée à Abidjan vous répond sous 2 heures ouvrées.</p>

    <div class="signature">
      L'équipe ApeX<br>
      <span class="small">Support&nbsp;: <a href="mailto:${SUPPORT_EMAIL()}" style="color:#10B981;">${SUPPORT_EMAIL()}</a></span>
    </div>
  `, `Vous pouvez ignorer ce rappel si vous n'êtes plus intéressé(e). Aucun autre email automatique ne vous sera envoyé.`);

  const text = `Bonjour${civilite},

Il y a quelques jours, votre cabinet ${cabinet_nom} vous a invité(e) à rejoindre
ApeX. Voici un rappel courtois au cas où le message précédent vous serait
passé inaperçu.

Vos avantages restent activables :
  • 14 jours d'essai gratuit, sans carte bancaire
  • −${remise_pct} % la première année
  • Configuration en 5 minutes

Activez maintenant : ${lien_invitation}

Une question ? Répondez à cet email, notre équipe répond sous 2h ouvrées.

— L'équipe ApeX
Support : ${SUPPORT_EMAIL()}
${PUBLIC_URL()}
`;
  return { subject, html, text };
}

// ─── Activation du compte Cabinet Partenaire ──────────────────────────────
function activationCabinet({ cabinet_nom, code_parrain, lien_portail }) {
  const portail = lien_portail || `${APP_URL()}/login`;
  const lienParrain = `${PUBLIC_URL()}/r/${code_parrain}`;
  const subject = `Bienvenue dans le Programme Partenaires ApeX`;
  const preheader = `Votre licence cabinet ${cabinet_nom} est activée. Code parrain : ${code_parrain}.`;

  const html = wrap(preheader, 'Bienvenue, Cabinet Partenaire', `Programme Partenaires Cabinets — réservé aux membres ONECCA`, `
    <p>Bonjour,</p>

    <p>Nous avons le plaisir de vous compter parmi nos <strong>Cabinets Partenaires ApeX</strong>.
    Votre espace <strong>${cabinet_nom}</strong> a été configuré et activé.</p>

    <p>Votre licence professionnelle (dossiers illimités, révision SYSCOHADA, conformité
    ITS&nbsp;2024, support prioritaire 2&nbsp;heures) est <strong>intégralement offerte</strong>
    dans le cadre de notre programme de soutien à la digitalisation des cabinets ivoiriens.</p>

    <div class="benefits">
      <strong>Votre code parrain unique&nbsp;:</strong>
      <div style="margin-top: 12px;">
        <span class="code">${code_parrain}</span>
      </div>
      <p class="small" style="margin: 14px 0 0;">Lien à partager à vos clients PME&nbsp;:<br>
      <a href="${lienParrain}" style="color:#10B981; word-break: break-all;">${lienParrain}</a></p>
    </div>

    <h2>Vos premiers pas, en 3 étapes</h2>
    <ol>
      <li>Connectez-vous à votre portail sécurisé</li>
      <li>Depuis l'onglet <em>Cabinet</em>, cliquez sur <em>Inviter une PME</em>
      pour ajouter votre premier client de test</li>
      <li>Observez en temps réel l'activation du dossier client sur votre tableau de bord</li>
    </ol>

    <div class="button-wrap">
      <a href="${portail}" class="button">Accéder à mon portail</a>
    </div>

    <p>Notre équipe reste à votre disposition par email ou WhatsApp pour vous accompagner
    lors de vos premières liaisons clients.</p>

    <div class="signature">
      L'équipe ApeX — Programme Partenaires<br>
      <span class="small">Support&nbsp;: <a href="mailto:${SUPPORT_EMAIL()}" style="color:#10B981;">${SUPPORT_EMAIL()}</a></span>
    </div>
  `, `Programme Partenaires ApeX — réservé aux cabinets d'expertise comptable membres ONECCA.`);

  const text = `Bonjour,

Nous avons le plaisir de vous compter parmi nos Cabinets Partenaires ApeX.
Votre espace ${cabinet_nom} est activé.

Votre licence professionnelle (dossiers illimités, révision SYSCOHADA,
conformité ITS 2024, support prioritaire 2 h) est intégralement offerte.

Code parrain : ${code_parrain}
Lien à partager : ${lienParrain}

Vos premiers pas, en 3 étapes :
  1. Connectez-vous à votre portail
  2. Onglet Cabinet → Inviter une PME (ajoutez votre 1er client test)
  3. Observez son activation en temps réel sur votre tableau de bord

Accédez à votre portail : ${portail}

Notre équipe est à votre disposition pour vous accompagner.

— L'équipe ApeX — Programme Partenaires
Support : ${SUPPORT_EMAIL()}
${PUBLIC_URL()}
`;
  return { subject, html, text };
}

// ─── Invitation directe d'un cabinet par le super-admin ───────────────────
// Ici l'admin choisit personnellement le cabinet et l'invite. Le ton reste
// institutionnel (« nous ») mais permet un message personnel optionnel
// inséré dans un encadré dédié, pour humaniser sans renier la voix d'entreprise.
function invitationDirecteCabinet({ nom_responsable, lien_activation, message_personnel }) {
  const prenom = (nom_responsable || '').trim().split(/\s+/)[0] || nom_responsable;
  const subject = `${prenom}, rejoignez le Programme Partenaires Cabinets ApeX`;
  const preheader = `Licence cabinet 100% offerte, support prioritaire 2h, visibilité sur useapex.ci.`;

  const messageBloc = message_personnel ? `
    <div style="padding: 16px 20px; background: #F0FDF4; border-left: 4px solid #10B981; border-radius: 0 8px 8px 0; margin: 22px 0; font-style: italic; color: #1F2937;">
      ${String(message_personnel).replace(/[<>]/g, '').replace(/\n/g, '<br>')}
    </div>` : '';

  const html = wrap(preheader, 'Programme Partenaires Cabinets', `Une invitation personnelle pour rejoindre ApeX`, `
    <p>Bonjour ${nom_responsable},</p>

    <p>Nous vous écrivons pour vous proposer de rejoindre le
    <strong>Programme Partenaires Cabinets ApeX</strong>, réservé aux
    experts-comptables ONECCA qui accompagnent les PME ivoiriennes au quotidien.</p>

    ${messageBloc}

    <p>ApeX a été pensé en étroite collaboration avec des cabinets de la Place
    pour répondre aux exigences SYSCOHADA, FNE et CNPS, tout en libérant les
    cabinets des tâches répétitives à faible valeur ajoutée (ressaisie, allers-retours
    Excel, suivi des pièces).</p>

    <div class="benefits">
      <strong>Vos avantages, 100 % offerts pour les premiers cabinets partenaires&nbsp;:</strong>
      <ul>
        <li><strong>Licence cabinet complète</strong> — dossiers clients illimités, révision SYSCOHADA, conformité ITS&nbsp;2024</li>
        <li><strong>Code parrain personnel</strong> à partager à vos clients PME, qui bénéficient d'une remise sur leur première année</li>
        <li>Support prioritaire en <strong>2 heures ouvrées</strong> par email et WhatsApp</li>
        <li>Une <strong>page dédiée</strong> sur <a href="${PUBLIC_URL()}" style="color:#10B981;">useapex.ci</a> où votre cabinet apparaît en référence</li>
      </ul>
    </div>

    <div class="button-wrap">
      <a href="${lien_activation}" class="button">Activer mon compte cabinet</a>
    </div>

    <p class="small">L'activation prend 2 minutes&nbsp;: vous définissez votre mot de passe,
    votre code parrain est généré automatiquement, vous pouvez inviter vos premiers
    clients dans la foulée.</p>

    <p>Ce lien est personnel et expire dans 30 jours. Si une question vous vient,
    répondez simplement à cet email — nous vous répondons sous 2 heures ouvrées.</p>

    <div class="signature">
      L'équipe ApeX — Programme Partenaires<br>
      <span class="small">Support&nbsp;: <a href="mailto:${SUPPORT_EMAIL()}" style="color:#10B981;">${SUPPORT_EMAIL()}</a></span>
    </div>
  `, `Invitation personnelle envoyée par l'équipe ApeX. Vous pouvez ignorer ce mail si le projet ne vous intéresse pas — aucun rappel automatique ne vous sera envoyé.`);

  const text = `Bonjour ${nom_responsable},

Nous vous écrivons pour vous proposer de rejoindre le Programme Partenaires
Cabinets ApeX, réservé aux experts-comptables ONECCA qui accompagnent les
PME ivoiriennes au quotidien.

${message_personnel ? message_personnel + '\n\n' : ''}ApeX a été pensé en étroite collaboration avec des cabinets de la Place
pour répondre aux exigences SYSCOHADA, FNE et CNPS, tout en libérant les
cabinets des tâches répétitives à faible valeur ajoutée.

Vos avantages, 100 % offerts pour les premiers cabinets partenaires :
  • Licence cabinet complète (dossiers illimités, révision SYSCOHADA, ITS 2024)
  • Code parrain personnel à partager à vos clients PME
  • Support prioritaire 2 heures ouvrées (email + WhatsApp)
  • Page dédiée sur useapex.ci

Activez votre compte (lien personnel, expire dans 30 jours) :
${lien_activation}

Une question ? Répondez à cet email, nous vous répondons sous 2h ouvrées.

— L'équipe ApeX — Programme Partenaires
Support : ${SUPPORT_EMAIL()}
${PUBLIC_URL()}
`;
  return { subject, html, text };
}

module.exports = { invitationPme, relanceInvitationPme, activationCabinet, invitationDirecteCabinet };
