/**
 * Console super-admin ApeX (migration 029).
 *
 * Endpoints (tous protégés par requireSuperAdmin) :
 *   GET    /api/admin/stats               — KPIs globaux (MRR, cabinets, PME…)
 *   GET    /api/admin/cabinets            — Leaderboard cabinets partenaires
 *   GET    /api/admin/candidatures        — Liste des candidatures cabinets
 *   POST   /api/admin/candidatures/:id/valider — Active une candidature
 *   POST   /api/admin/candidatures/:id/refuser — Refuse une candidature
 *   GET    /api/admin/relances            — Dernières invitations relancées
 */
const crypto = require('crypto');
const pool = require('../../config/database');
const {
  creerCategoriesDefaut, creerPlanComptableSyscohada,
  creerJournauxDefaut, creerExerciceCourant,
  creerRubriquesPaieDefaut,
} = require('../utils/helpers');
const { envoyerEmail } = require('../utils/email');
const { invitationDirecteCabinet: tplInvitDirecte } = require('../utils/emailTemplates');
const { logAudit } = require('../utils/audit');

function genererCodeParrain() {
  return `CAB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// ─── GET /api/admin/stats — KPIs globaux ───────────────────────────────────
async function getStats(req, res) {
  try {
    // MRR : somme des prix_mensuel_fcfa des abonnements actifs (hors gratuits).
    // Exclut explicitement les entreprises et utilisateurs démo : leurs
    // abonnements sont ouverts à 60 000 FCFA pour débloquer tous les
    // modules dans la démo, mais ce n'est PAS du revenu réel.
    const mrr = await pool.query(`
      SELECT COALESCE(SUM(a.prix_mensuel_fcfa), 0) AS total
        FROM abonnements a
        JOIN entreprises  e ON e.id = a.entreprise_id
       WHERE a.statut = 'actif'
         AND a.palier NOT IN ('decouverte', 'cabinet_partenaire')
         AND COALESCE(e.is_demo, FALSE) = FALSE
    `);

    // Compteurs : tous filtrés pour exclure le contenu démo, sauf les
    // métriques qui ciblent explicitement la démo (users_demo_actifs).
    const compteurs = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM entreprises
          WHERE type_compte = 'cabinet_partenaire'
            AND COALESCE(is_demo, FALSE) = FALSE) AS cabinets_partenaires,
        (SELECT COUNT(*) FROM entreprises
          WHERE type_compte = 'pme' AND actif = TRUE
            AND COALESCE(is_demo, FALSE) = FALSE) AS pme_actives,
        (SELECT COUNT(*) FROM entreprises
          WHERE parrainee_par_cabinet_id IS NOT NULL
            AND COALESCE(is_demo, FALSE) = FALSE) AS pme_parrainees,
        (SELECT COUNT(*) FROM cabinet_invitations WHERE statut = 'pending') AS invitations_pending,
        (SELECT COUNT(*) FROM cabinet_invitations WHERE statut = 'accepted') AS invitations_acceptees,
        (SELECT COUNT(*) FROM cabinet_invitations) AS invitations_total,
        (SELECT COUNT(*) FROM utilisateurs
          WHERE actif = TRUE
            AND COALESCE(is_demo, FALSE) = FALSE) AS utilisateurs_actifs,
        (SELECT COUNT(*) FROM utilisateurs WHERE is_demo = TRUE AND actif = TRUE) AS users_demo_actifs
    `);

    const c = compteurs.rows[0];
    const totalInv = parseInt(c.invitations_total) || 0;
    const acceptees = parseInt(c.invitations_acceptees) || 0;
    const tauxConversion = totalInv > 0 ? Math.round((acceptees / totalInv) * 1000) / 10 : 0;

    res.json({
      success: true,
      data: {
        mrr_fcfa: parseInt(mrr.rows[0].total) || 0,
        cabinets_partenaires: parseInt(c.cabinets_partenaires) || 0,
        pme_actives: parseInt(c.pme_actives) || 0,
        pme_parrainees: parseInt(c.pme_parrainees) || 0,
        invitations_pending: parseInt(c.invitations_pending) || 0,
        invitations_acceptees: acceptees,
        invitations_total: totalInv,
        taux_conversion_pct: tauxConversion,
        utilisateurs_actifs: parseInt(c.utilisateurs_actifs) || 0,
        users_demo_actifs: parseInt(c.users_demo_actifs) || 0,
      },
    });
  } catch (err) {
    console.error('Erreur admin/stats:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/admin/cabinets — Leaderboard cabinets partenaires ────────────
async function getCabinetsLeaderboard(req, res) {
  try {
    const r = await pool.query(`
      SELECT
        e.id, e.nom AS cabinet_nom, e.code_parrain, e.created_at AS active_depuis,
        (SELECT COUNT(*) FROM cabinet_invitations WHERE cabinet_id = e.id) AS invitations_emises,
        (SELECT COUNT(*) FROM cabinet_invitations WHERE cabinet_id = e.id AND statut = 'accepted') AS invitations_acceptees,
        (SELECT COUNT(*) FROM entreprises WHERE parrainee_par_cabinet_id = e.id) AS pme_parrainees,
        (SELECT COUNT(*) FROM cabinet_connections WHERE cabinet_id = e.id AND statut = 'active') AS clients_actifs,
        COALESCE((
          SELECT SUM(ab.prix_mensuel_fcfa)
            FROM entreprises p
            JOIN abonnements ab ON ab.entreprise_id = p.id
           WHERE p.parrainee_par_cabinet_id = e.id
             AND ab.statut = 'actif'
        ), 0) AS mrr_genere_fcfa
      FROM entreprises e
      WHERE e.type_compte = 'cabinet_partenaire'
      ORDER BY pme_parrainees DESC, invitations_emises DESC
      LIMIT 100
    `);
    // Calcul taux de conversion par cabinet
    const data = r.rows.map((c) => {
      const e = parseInt(c.invitations_emises) || 0;
      const a = parseInt(c.invitations_acceptees) || 0;
      return {
        ...c,
        invitations_emises: e,
        invitations_acceptees: a,
        pme_parrainees: parseInt(c.pme_parrainees) || 0,
        clients_actifs: parseInt(c.clients_actifs) || 0,
        mrr_genere_fcfa: parseInt(c.mrr_genere_fcfa) || 0,
        taux_conversion_pct: e > 0 ? Math.round((a / e) * 1000) / 10 : 0,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


// ─── GET /api/admin/relances — Dernières relances envoyées ─────────────────
async function getRelances(req, res) {
  try {
    const r = await pool.query(`
      SELECT ci.id, ci.email_pme, ci.nom_pme, ci.created_at, ci.relance_envoyee_at,
             ci.statut, e.nom AS cabinet_nom
        FROM cabinet_invitations ci
        JOIN entreprises e ON e.id = ci.cabinet_id
       WHERE ci.relance_envoyee_at IS NOT NULL
       ORDER BY ci.relance_envoyee_at DESC
       LIMIT 50
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/admin/test-email ────────────────────────────────────────────
// Envoie un email de test à l'email du super-admin connecté, sans toucher
// à la BDD. Sert à valider que RESEND_API_KEY est correctement configurée
// et que le domaine d'envoi est bien vérifié sur Resend.
async function envoyerEmailTest(req, res) {
  try {
    const r = await pool.query('SELECT email, nom FROM utilisateurs WHERE id=$1', [req.user.id]);
    const dest = r.rows[0];
    if (!dest) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    const appUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const publicUrl = (process.env.PUBLIC_URL || 'https://useapex.ci').replace(/\/+$/, '');
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@useapex.ci';
    const envLabel = process.env.NODE_ENV || 'development';
    const fromLabel = process.env.EMAIL_FROM || 'non configuré';
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:540px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
    <div style="background:linear-gradient(135deg,#10B981,#0F8A6E);padding:34px 32px;text-align:center;color:#FFFFFF;">
      <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.015em;">Configuration Resend validée</h1>
      <p style="margin:8px 0 0;font-size:13px;opacity:0.92;">Diagnostic technique — environnement ${envLabel}</p>
    </div>
    <div style="padding:30px 32px;color:#1F2937;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 14px;">Bonjour ${dest.nom || ''},</p>
      <p style="margin:0 0 14px;">Cet email confirme que la clé <strong>RESEND_API_KEY</strong> est
      correctement configurée et que le domaine d'envoi <strong>${fromLabel}</strong>
      est bien vérifié sur Resend (SPF + DKIM&nbsp;OK).</p>
      <p style="margin:0 0 14px;">Vous pouvez à présent inviter des cabinets partenaires depuis
      votre <a href="${appUrl}/admin" style="color:#10B981;text-decoration:none;font-weight:600;">Console Admin</a> —
      les emails d'invitation, les relances et les emails d'activation partiront
      automatiquement à partir de ${fromLabel}.</p>
      <div style="padding:14px 18px;background:#F0FDF4;border-left:4px solid #10B981;border-radius:0 8px 8px 0;margin:18px 0;font-size:13px;color:#065F46;">
        <strong>Bonnes pratiques&nbsp;:</strong>
        <ul style="margin:8px 0 0;padding-left:20px;">
          <li>Surveillez votre tableau Resend → <em>Emails</em> pour suivre les délivrabilités.</li>
          <li>Configurez une alerte sur les <em>bounces</em> pour détecter les adresses invalides.</li>
          <li>Ajoutez un enregistrement DMARC sur useapex.ci pour réduire le risque de spam.</li>
        </ul>
      </div>
    </div>
    <div style="padding:18px 32px;background:#F9FAFB;color:#6B7280;font-size:12px;text-align:center;border-top:1px solid #E5E7EB;line-height:1.6;">
      <strong style="color:#0F172A;">ApeX</strong> · Logiciel de gestion SYSCOHADA pour les PME ivoiriennes 🇨🇮<br>
      <a href="${publicUrl}" style="color:#10B981;text-decoration:none;">useapex.ci</a> ·
      <a href="${publicUrl}/cgu" style="color:#10B981;text-decoration:none;">CGU</a> ·
      <a href="${publicUrl}/confidentialite" style="color:#10B981;text-decoration:none;">Confidentialité</a> ·
      <a href="mailto:${supportEmail}" style="color:#10B981;text-decoration:none;">${supportEmail}</a>
    </div>
  </div>
</body></html>`;
    const text = `Bonjour ${dest.nom || ''},

Cet email confirme que la clé RESEND_API_KEY est correctement configurée
et que le domaine d'envoi ${fromLabel} est bien vérifié sur Resend
(SPF + DKIM OK).

Vous pouvez à présent inviter des cabinets partenaires depuis votre
Console Admin (${appUrl}/admin).

— L'équipe ApeX
Support : ${supportEmail}
${publicUrl}
`;
    const result = await envoyerEmail({
      to: dest.email,
      subject: '[ApeX] Configuration Resend validée',
      html,
      text,
      tags: { type: 'test_email' },
    });
    logAudit(req, 'TEST_EMAIL', 'admin', null, { destinataire: dest.email, mode: result.mode });

    if (result.sent) {
      return res.json({ success: true, message: `Email de test envoyé à ${dest.email}`, data: { mode: result.mode, id: result.id } });
    }
    return res.status(200).json({
      success: false,
      message: result.mode === 'logged'
        ? `RESEND_API_KEY non configurée — email loggé en console uniquement. Édite backend/.env puis redémarre.`
        : `Échec de l'envoi : ${result.error}. Vérifie que le domaine est bien vérifié sur Resend (Dashboard → Domains).`,
      data: { mode: result.mode, error: result.error },
    });
  } catch (err) {
    console.error('Erreur envoyerEmailTest:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/admin/inviter-cabinet ───────────────────────────────────────
// Invitation DIRECTE par le super-admin (≠ candidature spontanée).
// L'admin saisit nom + email (+ téléphone WhatsApp optionnel + nom cabinet
// optionnel + message personnel optionnel), et le système :
//   1. Crée le compte cabinet complet (entreprise, plan compta, abonnement…)
//      avec utilisateur en statut « invité » (actif=FALSE, invitation_token).
//   2. Envoie un email chaleureux signé par le super-admin avec le bouton
//      d'activation pointant sur /invitation/<token> (page existante).
//   3. Si un téléphone est fourni, génère en plus un lien wa.me que l'admin
//      peut cliquer pour relayer manuellement sur WhatsApp.
// Le destinataire clique → définit son mot de passe → atterrit sur /cabinet.
async function inviterCabinetDirect(req, res) {
  const { nom_responsable, email, telephone, nom_cabinet, message_personnel } = req.body;

  if (!nom_responsable || !email) {
    return res.status(400).json({ success: false, message: 'Nom du responsable et email sont obligatoires' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Email invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Vérifier qu'aucun compte actif n'existe avec cet email
    const existing = await client.query(
      'SELECT id, actif FROM utilisateurs WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existing.rows.length > 0 && existing.rows[0].actif) {
      await client.query('ROLLBACK');
      const cestMoi = existing.rows[0].id === req.user.id;
      return res.status(409).json({
        success: false,
        message: cestMoi
          ? `Vous essayez de vous inviter vous-même. Pour tester l'envoi d'emails sans créer de compte, utilisez le bouton « Tester Resend » dans le header.`
          : `Un compte actif existe déjà avec ${email}. Cette personne peut se connecter directement.`,
      });
    }

    const bcrypt = require('bcryptjs');
    const motDePasseTemp = crypto.randomBytes(24).toString('hex');
    const hash = await bcrypt.hash(motDePasseTemp, 12);
    const invitationToken = crypto.randomBytes(32).toString('hex');

    // Crée ou recycle l'utilisateur (compte inactif jusqu'à activation)
    const userRes = await client.query(`
      INSERT INTO utilisateurs
        (nom, email, mot_de_passe, telephone, actif, invitation_token, invitation_expire_at)
      VALUES ($1, $2, $3, $4, FALSE, $5, NOW() + INTERVAL '30 days')
      ON CONFLICT (email) DO UPDATE SET
        nom = EXCLUDED.nom,
        telephone = COALESCE(EXCLUDED.telephone, utilisateurs.telephone),
        actif = FALSE,
        invitation_token = EXCLUDED.invitation_token,
        invitation_expire_at = EXCLUDED.invitation_expire_at,
        updated_at = NOW()
      RETURNING id
    `, [nom_responsable.trim(), email.toLowerCase().trim(), hash, telephone || null, invitationToken]);
    const userId = userRes.rows[0].id;

    // Génère un code parrain unique (5 tentatives anti-collision)
    let codeParrain = null;
    for (let i = 0; i < 5; i++) {
      const candidate = genererCodeParrain();
      const coll = await client.query('SELECT 1 FROM entreprises WHERE code_parrain = $1', [candidate]);
      if (coll.rows.length === 0) { codeParrain = candidate; break; }
    }
    if (!codeParrain) throw new Error('Génération code parrain échouée');

    // Nom cabinet par défaut basé sur le responsable si non fourni
    const nomCabinet = (nom_cabinet || `Cabinet ${nom_responsable.split(/\s+/).slice(-1)[0]}`).trim();

    const entRes = await client.query(`
      INSERT INTO entreprises
        (nom, forme_juridique, pays, devise, regime_fiscal, ville,
         type_compte, code_parrain)
      VALUES ($1, 'SARL', 'Côte d''Ivoire', 'FCFA', 'RNI', 'Abidjan',
              'cabinet_partenaire', $2)
      RETURNING id
    `, [nomCabinet, codeParrain]);
    const eid = entRes.rows[0].id;

    // Membre propriétaire
    await client.query(`
      INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role)
      VALUES ($1, $2, 'proprietaire')
    `, [userId, eid]);

    // Plan compta + journaux + exercice + rubriques paie (réutilise les helpers)
    await creerCategoriesDefaut(eid, client);
    await creerPlanComptableSyscohada(eid, client);
    await creerJournauxDefaut(eid, client);
    await creerExerciceCourant(eid, client);
    await creerRubriquesPaieDefaut(eid, client);

    // Abonnement gratuit cabinet_partenaire
    await client.query(`
      INSERT INTO abonnements
        (entreprise_id, palier, statut, periodicite,
         date_debut, date_fin, prix_mensuel_fcfa, notes_commerciales)
      VALUES ($1, 'cabinet_partenaire', 'actif', 'annuel',
              CURRENT_DATE, CURRENT_DATE + INTERVAL '999 years', 0,
              'Invitation directe super-admin')
    `, [eid]);

    await client.query('COMMIT');

    // Envoi email d'invitation (hors transaction).
    // ⚠️ Route frontend distincte de celle des PME : les cabinets atterrissent
    // sur /rejoindre/:token (RejoindreCabinetPage), pas /invitation/:token
    // qui est la page PME et ne reconnaîtrait pas le token cabinet.
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const lienActivation = `${baseUrl}/rejoindre/${invitationToken}`;
    // Récupère le nom du super-admin pour signer l'email et le message WA
    const adminRes = await pool.query('SELECT nom FROM utilisateurs WHERE id=$1', [req.user.id]);
    const expediteurNom = adminRes.rows[0]?.nom || "L'équipe ApeX";

    const emailRes = await envoyerEmail({
      to: email,
      ...tplInvitDirecte({
        nom_responsable: nom_responsable.trim(),
        lien_activation: lienActivation,
        message_personnel: message_personnel ? message_personnel.trim() : null,
        expediteur_nom: expediteurNom,
      }),
      tags: { type: 'invitation_cabinet_direct', cabinet_id: eid },
    });

    // Lien WhatsApp prêt-à-cliquer si téléphone fourni
    let lienWhatsapp = null;
    if (telephone && telephone.trim()) {
      const phone = telephone.replace(/[^\d+]/g, '').replace(/^\+/, '');
      const msgWa = `Bonjour ${nom_responsable},\n\n${expediteurNom} (ApeX) vous invite à rejoindre le Programme Partenaires Cabinets — licence gratuite + commission sur chaque PME parrainée.\n\nActivez votre compte : ${lienActivation}\n\nÀ très vite !`;
      lienWhatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(msgWa)}`;
    }

    logAudit(req, 'INVITE_DIRECT', 'cabinet', eid, { email, code_parrain: codeParrain });

    res.json({
      success: true,
      message: emailRes.sent
        ? `Invitation envoyée à ${email}`
        : `Cabinet créé, mais l'email automatique a échoué — utilisez le lien WhatsApp ou copiez le lien manuellement.`,
      data: {
        cabinet_id: eid,
        cabinet_nom: nomCabinet,
        code_parrain: codeParrain,
        lien_activation: lienActivation,
        lien_whatsapp: lienWhatsapp,
        email_envoye: emailRes.sent,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur inviterCabinetDirect:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  getStats, getCabinetsLeaderboard, getRelances,
  inviterCabinetDirect, envoyerEmailTest,
};
