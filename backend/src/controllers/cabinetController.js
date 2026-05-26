/**
 * Programme Partenaires Cabinets Comptables (migration 029).
 *
 * Endpoints :
 *   POST   /api/cabinets/activer-partenariat        — transforme une entreprise en cabinet partenaire
 *   GET    /api/cabinets/me                         — infos du cabinet courant + stats
 *   GET    /api/cabinets/mes-clients                — liste des PME connectées
 *   POST   /api/cabinets/inviter-pme                — envoie une invitation par email
 *   GET    /api/cabinets/invitations                — liste des invitations en cours
 *   DELETE /api/cabinets/invitations/:id            — révoque une invitation pending
 *   DELETE /api/cabinets/connections/:id            — révoque l'accès à une PME
 *
 * Endpoints publics (sans auth, pour le parcours d'acceptation) :
 *   GET    /api/invitations/cabinet/:token          — récupère les infos d'une invitation
 *   POST   /api/invitations/cabinet/:token/accepter — accepte l'invitation + crée la PME
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');
const { envoyerEmail } = require('../utils/email');
const {
  invitationPme: tplInvitationPme,
  relanceInvitationPme: tplRelance,
  activationCabinet: tplActivation,
} = require('../utils/emailTemplates');
const {
  creerCategoriesDefaut, creerPlanComptableSyscohada,
  creerJournauxDefaut, creerExerciceCourant,
  creerRubriquesPaieDefaut,
} = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

// Génère un code parrain unique du type CAB-A3F9B2 (6 hex après le préfixe).
// Le préfixe rend le code reconnaissable visuellement dans une URL.
function genererCodeParrain() {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CAB-${hex}`;
}

// Génère un token d'invitation de 64 hex (256 bits, anti-bruteforce)
function genererTokenInvitation() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Activation du partenariat ──────────────────────────────────────────────
// Transforme une entreprise existante en cabinet_partenaire.
// Action manuelle par le super-admin (sécurité : on ne veut pas que n'importe
// qui s'auto-active gratuit) — pour la v1, on autorise aussi le propriétaire
// de l'entreprise à se déclarer cabinet partenaire après avoir prouvé son
// statut ONECCA (vérification offline pour l'instant).
async function activerPartenariat(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;

    // Vérifie qu'il n'est pas déjà partenaire
    const existant = await client.query(
      'SELECT type_compte, code_parrain FROM entreprises WHERE id = $1',
      [eid]
    );
    if (existant.rows[0]?.type_compte === 'cabinet_partenaire') {
      return res.status(400).json({
        success: false,
        message: 'Ce compte est déjà un Cabinet Partenaire.',
        data: { code_parrain: existant.rows[0].code_parrain },
      });
    }

    // Génère un code parrain unique (boucle si collision)
    let codeParrain;
    for (let i = 0; i < 5; i++) {
      codeParrain = genererCodeParrain();
      const collision = await client.query(
        'SELECT 1 FROM entreprises WHERE code_parrain = $1', [codeParrain]
      );
      if (collision.rows.length === 0) break;
      codeParrain = null;
    }
    if (!codeParrain) {
      throw new Error('Impossible de générer un code parrain unique');
    }

    // Active : type_compte = cabinet_partenaire + code parrain
    const result = await client.query(
      `UPDATE entreprises SET
         type_compte = 'cabinet_partenaire',
         code_parrain = $1,
         updated_at = NOW()
       WHERE id = $2 RETURNING id, nom, code_parrain, type_compte`,
      [codeParrain, eid]
    );

    // Bascule l'abonnement vers le palier gratuit cabinet_partenaire
    await client.query(
      `INSERT INTO abonnements (entreprise_id, palier, statut, periodicite,
         date_debut, date_fin, prix_mensuel_fcfa, notes_commerciales)
       VALUES ($1, 'cabinet_partenaire', 'actif', 'annuel',
         CURRENT_DATE, CURRENT_DATE + INTERVAL '999 years', 0,
         'Licence offerte — programme Partenaire ONECCA')
       ON CONFLICT (entreprise_id) DO UPDATE SET
         palier = 'cabinet_partenaire',
         prix_mensuel_fcfa = 0,
         date_fin = CURRENT_DATE + INTERVAL '999 years',
         notes_commerciales = 'Licence offerte — programme Partenaire ONECCA',
         updated_at = NOW()`,
      [eid]
    );

    await client.query('COMMIT');
    logAudit(req, 'ACTIVATE', 'cabinet_partenariat', eid, { code_parrain: codeParrain });
    res.json({
      success: true,
      message: 'Cabinet Partenaire activé. Licence gratuite à vie.',
      data: result.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur activerPartenariat:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ─── GET /api/cabinets/me ───────────────────────────────────────────────────
async function getCabinetInfo(req, res) {
  try {
    const eid = req.entrepriseId;
    const r = await pool.query(
      `SELECT e.id, e.nom, e.type_compte, e.code_parrain,
              (SELECT COUNT(*) FROM cabinet_connections WHERE cabinet_id = e.id AND statut = 'active') AS nb_clients_actifs,
              (SELECT COUNT(*) FROM cabinet_invitations WHERE cabinet_id = e.id AND statut = 'pending') AS nb_invitations_en_attente,
              (SELECT COUNT(*) FROM entreprises WHERE parrainee_par_cabinet_id = e.id) AS nb_pme_parrainees_total
         FROM entreprises e WHERE e.id = $1`,
      [eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/cabinets/mes-clients ──────────────────────────────────────────
async function getMesClients(req, res) {
  try {
    // Volontairement : pas de prix_mensuel_fcfa ni statut_abonnement dans
    // la réponse. Le MRR par client est une donnée commerciale d'ApeX
    // qui ne regarde pas le cabinet partenaire.
    const r = await pool.query(
      `SELECT cc.id AS connection_id, cc.statut AS statut_connection, cc.active_at,
              cc.tags, cc.notes_privees,
              p.id AS pme_id, p.nom AS pme_nom, p.ncc, p.regime_fiscal, p.secteur,
              p.remise_parrainage_pct,
              ab.palier
         FROM cabinet_connections cc
         JOIN entreprises p ON p.id = cc.pme_id
         LEFT JOIN abonnements ab ON ab.entreprise_id = p.id
        WHERE cc.cabinet_id = $1 AND cc.statut != 'revoked'
        ORDER BY cc.active_at DESC`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/cabinets/inviter-pme ─────────────────────────────────────────
async function inviterPme(req, res) {
  try {
    const { email_pme, nom_pme, telephone_pme } = req.body;
    if (!email_pme) {
      return res.status(400).json({ success: false, message: 'Email de la PME requis' });
    }
    // Remise fixée par ApeX, non négociable côté cabinet (décision commerciale
    // centralisée du super-admin). Toute valeur envoyée dans req.body est ignorée.
    const REMISE_PARRAINAGE_PCT = 15;

    // Vérifie que c'est bien un cabinet partenaire
    const cab = await pool.query(
      'SELECT type_compte FROM entreprises WHERE id = $1', [req.entrepriseId]
    );
    if (cab.rows[0]?.type_compte !== 'cabinet_partenaire') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les Cabinets Partenaires peuvent inviter des PME.',
      });
    }

    // Si la PME existe déjà sur ApeX (par email d'un user), proposer une demande de connexion
    // V1 : on crée toujours une nouvelle invitation, la résolution se fera au moment du clic
    const token = genererTokenInvitation();

    const inv = await pool.query(
      `INSERT INTO cabinet_invitations
         (cabinet_id, email_pme, nom_pme, telephone_pme, token,
          remise_proposee_pct, cree_par)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.entrepriseId, email_pme.toLowerCase().trim(),
       nom_pme || null, telephone_pme || null, token, REMISE_PARRAINAGE_PCT, req.user.id]
    );

    logAudit(req, 'INVITE', 'cabinet_invitation', inv.rows[0].id,
      { email: email_pme, remise: REMISE_PARRAINAGE_PCT });

    // Envoi de l'email d'invitation (Resend si configuré, sinon log)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const lienInvitation = `${baseUrl}/rejoindre/${token}`;
    const cabRes = await pool.query('SELECT nom FROM entreprises WHERE id = $1', [req.entrepriseId]);
    const cabinet_nom = cabRes.rows[0]?.nom || 'Votre cabinet';

    const emailRes = await envoyerEmail({
      to: email_pme,
      ...tplInvitationPme({
        cabinet_nom, lien_invitation: lienInvitation,
        remise_pct: REMISE_PARRAINAGE_PCT, nom_pme,
      }),
      tags: { type: 'invitation_pme', cabinet_id: req.entrepriseId },
    });

    res.json({
      success: true,
      message: emailRes.sent
        ? 'Invitation envoyée par email à la PME.'
        : 'Invitation créée. Email pas encore envoyé (transmettez le lien manuellement).',
      data: {
        ...inv.rows[0],
        lien_invitation: lienInvitation,
        email_envoye: emailRes.sent,
      },
    });
  } catch (err) {
    console.error('Erreur inviterPme:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/cabinets/invitations ──────────────────────────────────────────
async function getInvitations(req, res) {
  try {
    const r = await pool.query(
      `SELECT * FROM cabinet_invitations
        WHERE cabinet_id = $1
        ORDER BY created_at DESC LIMIT 200`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── DELETE /api/cabinets/invitations/:id ──────────────────────────────────
async function revoquerInvitation(req, res) {
  try {
    const r = await pool.query(
      `UPDATE cabinet_invitations SET statut = 'revoked', updated_at = NOW()
        WHERE id = $1 AND cabinet_id = $2 AND statut = 'pending'
        RETURNING id`,
      [req.params.id, req.entrepriseId]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Invitation introuvable ou déjà traitée' });
    res.json({ success: true, message: 'Invitation révoquée' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── DELETE /api/cabinets/connections/:id ──────────────────────────────────
async function revoquerConnection(req, res) {
  try {
    const r = await pool.query(
      `UPDATE cabinet_connections SET statut = 'revoked', revoked_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND cabinet_id = $2 AND statut = 'active'
        RETURNING pme_id`,
      [req.params.id, req.entrepriseId]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Connection introuvable' });
    // TODO : retirer également le membre dans membres_entreprise (futur lot)
    res.json({ success: true, message: 'Accès au dossier révoqué' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── PUBLIC : GET /api/invitations/cabinet/:token ──────────────────────────
// Récupère les infos d'une invitation pour pré-remplir la page /rejoindre/:token
async function getInvitationPublic(req, res) {
  try {
    const r = await pool.query(
      `SELECT ci.email_pme, ci.nom_pme, ci.remise_proposee_pct, ci.statut,
              ci.expires_at, e.nom AS cabinet_nom, e.code_parrain
         FROM cabinet_invitations ci
         JOIN entreprises e ON e.id = ci.cabinet_id
        WHERE ci.token = $1`,
      [req.params.token]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Invitation introuvable' });
    const inv = r.rows[0];
    if (inv.statut !== 'pending') {
      return res.status(410).json({
        success: false,
        message: inv.statut === 'accepted'
          ? 'Cette invitation a déjà été utilisée.'
          : 'Cette invitation n\'est plus valide.',
      });
    }
    if (new Date(inv.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'Invitation expirée. Demandez-en une nouvelle à votre cabinet.' });
    }
    res.json({ success: true, data: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── PUBLIC : POST /api/invitations/cabinet/:token/accepter ────────────────
// Crée l'utilisateur PME + l'entreprise + lie au cabinet + applique la remise
async function accepterInvitationPme(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { nom_dirigeant, mot_de_passe, nom_entreprise, ncc, centre_fiscal } = req.body;
    if (!mot_de_passe || mot_de_passe.length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe : 8 caractères minimum' });
    }
    if (!nom_entreprise || !nom_entreprise.trim()) {
      return res.status(400).json({ success: false, message: 'Nom de l\'entreprise requis' });
    }

    // Verrouille l'invitation pour éviter qu'elle soit acceptée 2 fois
    const invRes = await client.query(
      `SELECT * FROM cabinet_invitations WHERE token = $1 AND statut = 'pending' FOR UPDATE`,
      [req.params.token]
    );
    const inv = invRes.rows[0];
    if (!inv) {
      await client.query('ROLLBACK');
      return res.status(410).json({ success: false, message: 'Invitation introuvable ou déjà acceptée' });
    }
    if (new Date(inv.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ success: false, message: 'Invitation expirée' });
    }

    // Crée l'utilisateur dirigeant
    const hash = await bcrypt.hash(mot_de_passe, 12);
    const userRes = await client.query(
      `INSERT INTO utilisateurs (nom, email, mot_de_passe, actif)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET mot_de_passe = $3, nom = $1, actif = TRUE
       RETURNING id, nom, email`,
      [nom_dirigeant || inv.nom_pme || 'Dirigeant', inv.email_pme, hash]
    );
    const user = userRes.rows[0];

    // Crée l'entreprise PME avec parrainage + remise
    const entRes = await client.query(
      `INSERT INTO entreprises
         (nom, forme_juridique, pays, devise, regime_fiscal, ncc, centre_fiscal,
          type_compte, parrainee_par_cabinet_id, remise_parrainage_pct)
       VALUES ($1, 'SARL', 'Côte d''Ivoire', 'FCFA', 'RNI', $2, $3,
               'pme', $4, $5)
       RETURNING id, nom`,
      [nom_entreprise.trim(), ncc || null, centre_fiscal || null,
       inv.cabinet_id, inv.remise_proposee_pct]
    );
    const eid = entRes.rows[0].id;

    // Le dirigeant est propriétaire
    await client.query(
      `INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role)
       VALUES ($1, $2, 'proprietaire')`,
      [user.id, eid]
    );

    // Plan comptable, journaux, rubriques, catégories
    await creerCategoriesDefaut(eid, client);
    await creerPlanComptableSyscohada(eid, client);
    await creerJournauxDefaut(eid, client);
    await creerExerciceCourant(eid, client);
    await creerRubriquesPaieDefaut(eid, client);

    // Connecte le cabinet à la PME (le cabinet a accès au dossier)
    const connRes = await client.query(
      `INSERT INTO cabinet_connections
         (cabinet_id, pme_id, statut, role_dans_pme, invitation_id, cree_par_cabinet)
       VALUES ($1, $2, 'active', 'comptable', $3, TRUE)
       RETURNING id`,
      [inv.cabinet_id, eid, inv.id]
    );

    // Crée le membre cabinet dans la PME (accès direct au dossier sans changer de mdp)
    const proprioCabinet = await client.query(
      `SELECT utilisateur_id FROM membres_entreprise
        WHERE entreprise_id = $1 AND role = 'proprietaire' LIMIT 1`,
      [inv.cabinet_id]
    );
    if (proprioCabinet.rows[0]) {
      await client.query(
        `INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role)
         VALUES ($1, $2, 'comptable')
         ON CONFLICT DO NOTHING`,
        [proprioCabinet.rows[0].utilisateur_id, eid]
      );
    }

    // Marque l'invitation comme acceptée
    await client.query(
      `UPDATE cabinet_invitations SET
         statut = 'accepted', acceptee_at = NOW(), acceptee_par = $1, updated_at = NOW()
       WHERE id = $2`,
      [user.id, inv.id]
    );

    // Crée un abonnement Découverte (gratuit) — la PME pourra upgrader après l'essai
    await client.query(
      `INSERT INTO abonnements (entreprise_id, palier, statut, periodicite,
         date_debut, date_fin, prix_mensuel_fcfa, notes_commerciales)
       VALUES ($1, 'decouverte', 'actif', 'mensuel',
         CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 0,
         $2)
       ON CONFLICT (entreprise_id) DO NOTHING`,
      [eid, `Essai 14j · Parrainée par cabinet ${inv.cabinet_id.slice(0, 8)} · Remise ${inv.remise_proposee_pct}% à l'upgrade`]
    );

    await client.query('COMMIT');

    // JWT direct pour login auto
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Compte créé avec succès. Bienvenue sur ApeX.',
      data: {
        token,
        user: { id: user.id, nom: user.nom, email: user.email },
        entreprise: { id: eid, nom: entRes.rows[0].nom },
        connection_id: connRes.rows[0].id,
        remise_appliquee_pct: inv.remise_proposee_pct,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur accepterInvitationPme:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ─── GET /api/entreprises/:id/public-info ───────────────────────────────────
// Renvoie les infos NON sensibles d'une entreprise (nom + type_compte +
// code_parrain) — utilisé par le Welcome Modal PME pour afficher « votre
// cabinet [Nom] ». Auth requise (n'importe quel utilisateur logué).
async function getEntreprisePublicInfo(req, res) {
  try {
    const r = await pool.query(
      `SELECT id, nom, type_compte, code_parrain FROM entreprises WHERE id = $1`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── PUBLIC : POST /api/cabinets/candidature ────────────────────────────────
// Formulaire public pour postuler au programme Partenaire (LOT 2).
// Le super-admin valide manuellement via /admin (LOT 4) avant activation.
// ─── CRON : relance des invitations pending J+2 ────────────────────────────
// Cherche les invitations pending sans relance_envoyee_at créées il y a > 2j,
// envoie un email de relance, marque relance_envoyee_at = NOW().
// Une seule relance par invitation (volontairement : pas de spam).
// Appelé toutes les heures par le cron applicatif (backend/src/index.js).
async function relancerInvitationsPending() {
  const client = await pool.connect();
  try {
    let dues;
    try {
      dues = await client.query(
        `SELECT ci.*, e.nom AS cabinet_nom
           FROM cabinet_invitations ci
           JOIN entreprises e ON e.id = ci.cabinet_id
          WHERE ci.statut = 'pending'
            AND ci.relance_envoyee_at IS NULL
            AND ci.created_at < NOW() - INTERVAL '2 days'
            AND ci.expires_at > NOW()
          LIMIT 20`
      );
    } catch (err) {
      // 42P01 = table inexistante (migration 029 pas appliquée)
      if (err.code === '42P01') return { skipped: true, raison: 'migration_029_non_appliquee' };
      throw err;
    }
    if (dues.rows.length === 0) return { relancees: 0 };

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    let envoyees = 0;
    for (const inv of dues.rows) {
      const lien = `${baseUrl}/rejoindre/${inv.token}`;
      const r = await envoyerEmail({
        to: inv.email_pme,
        ...tplRelance({
          cabinet_nom: inv.cabinet_nom,
          lien_invitation: lien,
          remise_pct: inv.remise_proposee_pct,
          nom_pme: inv.nom_pme,
        }),
        tags: { type: 'relance_invitation_pme', invitation_id: inv.id },
      });
      // On marque toujours comme « relance envoyée », même si l'email a juste
      // été loggé en console — ça évite de spammer le cron en boucle.
      await client.query(
        `UPDATE cabinet_invitations SET relance_envoyee_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [inv.id]
      );
      if (r.sent) envoyees++;
    }
    return { relancees: dues.rows.length, envoyees };
  } finally {
    client.release();
  }
}

// ─── POST /api/cabinets/echeances/marquer-faite ────────────────────────────
// L'EC marque manuellement une échéance comme déclarée pour la masquer
// du calendrier. Idempotent (UNIQUE sur cabinet+pme+type+periode).
async function marquerEcheanceFaite(req, res) {
  try {
    const { pme_id, type, periode, note } = req.body;
    if (!pme_id || !type || !periode) {
      return res.status(400).json({ success: false, message: 'pme_id, type et periode requis' });
    }
    // Sécurité : la PME doit être connectée à ce cabinet
    const ok = await pool.query(
      `SELECT 1 FROM cabinet_connections
        WHERE cabinet_id = $1 AND pme_id = $2 AND statut = 'active'`,
      [req.entrepriseId, pme_id]
    );
    if (ok.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'PME non connectée à votre cabinet' });
    }
    await pool.query(
      `INSERT INTO cabinet_echeances_traitees
         (cabinet_id, pme_id, type, periode, traite_par, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (cabinet_id, pme_id, type, periode) DO UPDATE
         SET traite_par = EXCLUDED.traite_par,
             traite_at = NOW(),
             note = EXCLUDED.note`,
      [req.entrepriseId, pme_id, type, periode, req.user.id, note || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur marquerEcheanceFaite:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── DELETE /api/cabinets/echeances/marquer-faite ──────────────────────────
// Annule le marquage (la déclaration n'est finalement pas faite).
async function annulerEcheanceFaite(req, res) {
  try {
    const { pme_id, type, periode } = req.body;
    if (!pme_id || !type || !periode) {
      return res.status(400).json({ success: false, message: 'pme_id, type et periode requis' });
    }
    await pool.query(
      `DELETE FROM cabinet_echeances_traitees
        WHERE cabinet_id = $1 AND pme_id = $2 AND type = $3 AND periode = $4`,
      [req.entrepriseId, pme_id, type, periode]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/cabinets/charge-clients ──────────────────────────────────────
// Pour chaque PME connectée, compte les actions en attente de l'EC :
//   - factures en brouillon (à valider/envoyer)
//   - dépenses en attente (à comptabiliser)
//   - échéances fiscales dans les 7 prochains jours (déduites du calendrier)
// Retourne par PME un total + breakdown. Utilisé pour afficher des
// pastilles d'urgence sur les cards client du portail.
async function getChargeClients(req, res) {
  try {
    const clientsRes = await pool.query(
      `SELECT p.id AS pme_id, p.regime_fiscal
         FROM cabinet_connections cc
         JOIN entreprises p ON p.id = cc.pme_id
        WHERE cc.cabinet_id = $1 AND cc.statut = 'active'`,
      [req.entrepriseId]
    );
    const pmes = clientsRes.rows;
    if (pmes.length === 0) return res.json({ success: true, data: {} });

    const pmeIds = pmes.map(p => p.pme_id);

    // Factures en brouillon (toutes PME en une requête)
    const facturesRes = await pool.query(
      `SELECT entreprise_id, COUNT(*)::int AS n
         FROM factures
        WHERE entreprise_id = ANY($1::uuid[]) AND statut = 'brouillon'
        GROUP BY entreprise_id`,
      [pmeIds]
    );
    const facturesMap = Object.fromEntries(facturesRes.rows.map(r => [r.entreprise_id, r.n]));

    // Dépenses en attente
    const depensesRes = await pool.query(
      `SELECT entreprise_id, COUNT(*)::int AS n
         FROM depenses
        WHERE entreprise_id = ANY($1::uuid[]) AND statut = 'en_attente'
        GROUP BY entreprise_id`,
      [pmeIds]
    );
    const depensesMap = Object.fromEntries(depensesRes.rows.map(r => [r.entreprise_id, r.n]));

    // Échéances fiscales dans les 7 jours (logique réutilisée du calendrier)
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    const limite7j = new Date(); limite7j.setDate(limite7j.getDate() + 7);

    const charge = {};
    for (const pme of pmes) {
      const factures = facturesMap[pme.pme_id] || 0;
      const depenses = depensesMap[pme.pme_id] || 0;

      // Compte les échéances proches (mêmes règles que getEcheancesFiscales)
      let echeances = 0;
      const candidats = [];
      // ITS — 15 de chaque mois
      for (let i = 0; i < 2; i++) candidats.push({ d: new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + i, 15) });
      // TVA si RNI
      if (pme.regime_fiscal === 'RNI') {
        for (let i = 0; i < 2; i++) candidats.push({ d: new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + i, 15) });
      }
      // CNPS trimestriel + acomptes IS
      candidats.push({ d: new Date(aujourdhui.getFullYear(), 3, 15) });
      candidats.push({ d: new Date(aujourdhui.getFullYear(), 6, 15) });
      candidats.push({ d: new Date(aujourdhui.getFullYear(), 9, 15) });
      candidats.push({ d: new Date(aujourdhui.getFullYear() + 1, 0, 15) });
      if (pme.regime_fiscal === 'RNI') {
        candidats.push({ d: new Date(aujourdhui.getFullYear(), 2, 15) });
        candidats.push({ d: new Date(aujourdhui.getFullYear(), 5, 15) });
        candidats.push({ d: new Date(aujourdhui.getFullYear(), 8, 15) });
        candidats.push({ d: new Date(aujourdhui.getFullYear(), 11, 15) });
      }
      for (const c of candidats) {
        if (c.d >= aujourdhui && c.d <= limite7j) echeances++;
      }

      const total = factures + depenses + echeances;
      if (total > 0) {
        charge[pme.pme_id] = { total, factures_brouillon: factures, depenses_en_attente: depenses, echeances_proches: echeances };
      }
    }
    res.json({ success: true, data: charge });
  } catch (err) {
    console.error('Erreur getChargeClients:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/cabinets/notifications ───────────────────────────────────────
// Feed unifié des événements récents pour le cabinet :
//   - Invitations PME acceptées (7 derniers jours)
//   - Connexions PME nouvellement actives (7 derniers jours)
//   - Échéances fiscales en retard et non marquées comme traitées
// Retourne 20 max, triés par date desc. Front affiche pastille + liste.
async function getNotifications(req, res) {
  try {
    const items = [];

    // Invitations acceptées récentes
    const invAcc = await pool.query(
      `SELECT id, email_pme, nom_pme, updated_at AS at, 'invitation_acceptee' AS type
         FROM cabinet_invitations
        WHERE cabinet_id = $1 AND statut = 'accepted'
          AND updated_at > NOW() - INTERVAL '7 days'
        ORDER BY updated_at DESC LIMIT 10`,
      [req.entrepriseId]
    );
    for (const r of invAcc.rows) {
      items.push({
        type: 'invitation_acceptee',
        at: r.at,
        titre: `${r.nom_pme || r.email_pme} a accepté votre invitation`,
        sub: 'Vous avez maintenant accès à son dossier',
      });
    }

    // Connexions récentes
    const conn = await pool.query(
      `SELECT cc.active_at AS at, p.nom AS pme_nom, p.id AS pme_id
         FROM cabinet_connections cc
         JOIN entreprises p ON p.id = cc.pme_id
        WHERE cc.cabinet_id = $1 AND cc.statut = 'active'
          AND cc.active_at > NOW() - INTERVAL '7 days'
        ORDER BY cc.active_at DESC LIMIT 10`,
      [req.entrepriseId]
    );
    for (const r of conn.rows) {
      items.push({
        type: 'connexion_nouvelle',
        at: r.at,
        titre: `${r.pme_nom} est désormais connecté à votre cabinet`,
        sub: 'Dossier prêt à être révisé',
        pme_id: r.pme_id,
      });
    }

    // Échéances déjà dépassées et non traitées (calcule via le même
    // moteur que getEcheancesFiscales mais ne garde que les retards)
    // Pour simplifier, on lit les pme connectées et on regarde les
    // échéances calendaires des 30 jours passés.
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    const il30j = new Date(); il30j.setDate(il30j.getDate() - 30);
    const pmes = await pool.query(
      `SELECT p.id, p.nom, p.regime_fiscal
         FROM cabinet_connections cc
         JOIN entreprises p ON p.id = cc.pme_id
        WHERE cc.cabinet_id = $1 AND cc.statut = 'active'`,
      [req.entrepriseId]
    );
    let traitees = new Set();
    try {
      const tr = await pool.query(
        `SELECT pme_id, type, periode FROM cabinet_echeances_traitees WHERE cabinet_id = $1`,
        [req.entrepriseId]
      );
      for (const r of tr.rows) traitees.add(`${r.pme_id}|${r.type}|${r.periode.toISOString().slice(0,10)}`);
    } catch (err) { if (err.code !== '42P01') throw err; }

    for (const pme of pmes.rows) {
      // Pour chaque type récurrent mensuel (ITS), on vérifie les
      // 15 du mois passés dans les 30j
      const dates = [
        new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 15),
        new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 15),
      ];
      for (const d of dates) {
        if (d >= il30j && d < aujourdhui) {
          const cle = `${pme.id}|ITS|${d.toISOString().slice(0,10)}`;
          if (!traitees.has(cle)) {
            items.push({
              type: 'echeance_retard',
              at: d.toISOString(),
              titre: `ITS ${pme.nom} en retard`,
              sub: `Échéance du ${d.toLocaleDateString('fr-FR')} non déclarée`,
              pme_id: pme.id,
            });
          }
        }
      }
    }

    // Tri par date desc, top 20
    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ success: true, data: items.slice(0, 20) });
  } catch (err) {
    console.error('Erreur getNotifications:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── PATCH /api/cabinets/connections/:id ───────────────────────────────────
// Met à jour les tags et notes privées d'une connexion cabinet↔PME.
// Annotations strictement internes au cabinet, invisibles pour la PME.
async function mettreAJourConnection(req, res) {
  try {
    const { tags, notes_privees } = req.body;
    // Normalise les tags : array de strings non vides, trim, sans doublon
    let tagsArr = null;
    if (Array.isArray(tags)) {
      tagsArr = [...new Set(tags
        .map(t => typeof t === 'string' ? t.trim() : '')
        .filter(t => t.length > 0 && t.length <= 30)
      )].slice(0, 10);
    }
    const r = await pool.query(
      `UPDATE cabinet_connections
          SET tags = COALESCE($1, tags),
              notes_privees = $2,
              updated_at = NOW()
        WHERE id = $3 AND cabinet_id = $4
        RETURNING id, tags, notes_privees`,
      [tagsArr, notes_privees ?? null, req.params.id, req.entrepriseId]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, message: 'Connexion introuvable' });
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur mettreAJourConnection:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/cabinets/echeances-fiscales ──────────────────────────────────
// Calcule les échéances DGI/CNPS des 60 prochains jours pour chaque PME
// connectée au cabinet. Pure logique calendaire (pas de lecture de
// déclarations existantes — version 1 informative). Côte d'Ivoire :
//   - ITS    : 15 de CHAQUE mois (déclaration et versement)
//   - TVA    : 15 de chaque mois (régime RNI assujetti)
//   - CNPS   : 15 du mois suivant chaque trimestre civil
//   - IS (acompte) : 15 mars, 15 juin, 15 sept, 15 déc (RNI)
//   - DSF / liasse fiscale : 30 avril N+1 (RNI), 31 mai N+1 (autres)
async function getEcheancesFiscales(req, res) {
  try {
    const cli = await pool.query(
      `SELECT p.id AS pme_id, p.nom AS pme_nom, p.regime_fiscal
         FROM cabinet_connections cc
         JOIN entreprises p ON p.id = cc.pme_id
        WHERE cc.cabinet_id = $1 AND cc.statut = 'active'`,
      [req.entrepriseId]
    );

    // Échéances déjà marquées comme traitées par l'EC (table override).
    // Clé "pme_id|type|YYYY-MM-DD" pour matching rapide.
    let traitees = new Set();
    try {
      const tr = await pool.query(
        `SELECT pme_id, type, periode FROM cabinet_echeances_traitees
          WHERE cabinet_id = $1`,
        [req.entrepriseId]
      );
      for (const r of tr.rows) {
        traitees.add(`${r.pme_id}|${r.type}|${r.periode.toISOString().slice(0,10)}`);
      }
    } catch (err) {
      if (err.code !== '42P01') throw err; // migration 033 pas appliquée → ignore
    }
    const aujourdhui = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 60);

    const echeances = [];
    for (const pme of cli.rows) {
      // ITS — le 15 de chaque mois (mois courant + suivants jusqu'à la limite)
      for (let i = 0; i < 3; i++) {
        const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + i, 15);
        if (d >= aujourdhui && d <= limite) {
          echeances.push({ pme_id: pme.pme_id, pme_nom: pme.pme_nom, type: 'ITS', label: 'Déclaration ITS mensuelle', date: d.toISOString().slice(0, 10), severite: 'mensuel' });
        }
      }
      // TVA — le 15 de chaque mois pour RNI
      if (pme.regime_fiscal === 'RNI') {
        for (let i = 0; i < 3; i++) {
          const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + i, 15);
          if (d >= aujourdhui && d <= limite) {
            echeances.push({ pme_id: pme.pme_id, pme_nom: pme.pme_nom, type: 'TVA', label: 'Déclaration TVA mensuelle', date: d.toISOString().slice(0, 10), severite: 'mensuel' });
          }
        }
      }
      // CNPS — trimestriel : 15 du mois suivant le trimestre civil clos
      const trimestres = [
        new Date(aujourdhui.getFullYear(), 3, 15),  // Q1 → 15 avril
        new Date(aujourdhui.getFullYear(), 6, 15),  // Q2 → 15 juillet
        new Date(aujourdhui.getFullYear(), 9, 15),  // Q3 → 15 octobre
        new Date(aujourdhui.getFullYear() + 1, 0, 15), // Q4 → 15 janvier N+1
      ];
      for (const d of trimestres) {
        if (d >= aujourdhui && d <= limite) {
          echeances.push({ pme_id: pme.pme_id, pme_nom: pme.pme_nom, type: 'CNPS', label: 'Cotisations CNPS trimestrielles', date: d.toISOString().slice(0, 10), severite: 'trimestriel' });
        }
      }
      // Acomptes IS — 15 mars/juin/sept/déc (RNI)
      if (pme.regime_fiscal === 'RNI') {
        const acomptes = [
          new Date(aujourdhui.getFullYear(), 2, 15),
          new Date(aujourdhui.getFullYear(), 5, 15),
          new Date(aujourdhui.getFullYear(), 8, 15),
          new Date(aujourdhui.getFullYear(), 11, 15),
        ];
        for (const d of acomptes) {
          if (d >= aujourdhui && d <= limite) {
            echeances.push({ pme_id: pme.pme_id, pme_nom: pme.pme_nom, type: 'IS', label: 'Acompte impôt sur les sociétés', date: d.toISOString().slice(0, 10), severite: 'trimestriel' });
          }
        }
      }
      // DSF / liasse fiscale — 30 avril N+1 (RNI), 31 mai N+1 (autres)
      const dsfDate = pme.regime_fiscal === 'RNI'
        ? new Date(aujourdhui.getFullYear(), 3, 30)
        : new Date(aujourdhui.getFullYear(), 4, 31);
      if (dsfDate >= aujourdhui && dsfDate <= limite) {
        echeances.push({ pme_id: pme.pme_id, pme_nom: pme.pme_nom, type: 'DSF', label: 'États financiers annuels', date: dsfDate.toISOString().slice(0, 10), severite: 'annuel' });
      }
    }
    // Tri chronologique + filtre des échéances déjà traitées
    const restantes = echeances
      .filter(e => !traitees.has(`${e.pme_id}|${e.type}|${e.date}`))
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json({ success: true, data: restantes });
  } catch (err) {
    console.error('Erreur getEcheancesFiscales:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  activerPartenariat,
  getCabinetInfo,
  getMesClients,
  inviterPme,
  getInvitations,
  revoquerInvitation,
  revoquerConnection,
  getInvitationPublic,
  accepterInvitationPme,
  relancerInvitationsPending,
  getEntreprisePublicInfo,
  mettreAJourConnection,
  getEcheancesFiscales,
  getChargeClients,
  marquerEcheanceFaite,
  annulerEcheanceFaite,
  getNotifications,
};
