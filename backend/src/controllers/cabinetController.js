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
    const r = await pool.query(
      `SELECT cc.id AS connection_id, cc.statut AS statut_connection, cc.active_at,
              p.id AS pme_id, p.nom AS pme_nom, p.ncc, p.regime_fiscal, p.secteur,
              p.remise_parrainage_pct,
              ab.palier, ab.prix_mensuel_fcfa, ab.statut AS statut_abonnement
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
    const { email_pme, nom_pme, telephone_pme, remise_proposee_pct } = req.body;
    if (!email_pme) {
      return res.status(400).json({ success: false, message: 'Email de la PME requis' });
    }

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
    const remise = Math.min(50, Math.max(0, parseInt(remise_proposee_pct) || 15));

    const inv = await pool.query(
      `INSERT INTO cabinet_invitations
         (cabinet_id, email_pme, nom_pme, telephone_pme, token,
          remise_proposee_pct, cree_par)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.entrepriseId, email_pme.toLowerCase().trim(),
       nom_pme || null, telephone_pme || null, token, remise, req.user.id]
    );

    logAudit(req, 'INVITE', 'cabinet_invitation', inv.rows[0].id,
      { email: email_pme, remise });

    // TODO L3 : envoi email réel via service email (en attendant, on retourne le lien)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const lienInvitation = `${baseUrl}/rejoindre/${token}`;
    res.json({
      success: true,
      message: 'Invitation enregistrée. Lien à transmettre à la PME.',
      data: { ...inv.rows[0], lien_invitation: lienInvitation },
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

// ─── PUBLIC : POST /api/cabinets/candidature ────────────────────────────────
// Formulaire public pour postuler au programme Partenaire (LOT 2).
// Le super-admin valide manuellement via /admin (LOT 4) avant activation.
async function postulerPartenariat(req, res) {
  try {
    const {
      nom_cabinet, nom_responsable, email_pro, telephone,
      numero_onecca, ville, nb_collaborateurs, nb_clients_pme,
      message, source,
    } = req.body;

    if (!nom_cabinet || !nom_responsable || !email_pro) {
      return res.status(400).json({
        success: false,
        message: 'Nom du cabinet, nom du responsable et email professionnel requis',
      });
    }

    // Anti-doublon : refuse les candidatures en double sous 24h pour le même email
    const doublon = await pool.query(
      `SELECT id, statut FROM cabinet_candidatures
        WHERE LOWER(email_pro) = LOWER($1) AND created_at > NOW() - INTERVAL '24 hours'`,
      [email_pro]
    );
    if (doublon.rows.length > 0) {
      return res.status(429).json({
        success: false,
        message: 'Une candidature avec cet email a déjà été soumise dans les 24 dernières heures. Notre équipe vous recontactera sous 48h.',
      });
    }

    const r = await pool.query(
      `INSERT INTO cabinet_candidatures
         (nom_cabinet, nom_responsable, email_pro, telephone, numero_onecca,
          ville, nb_collaborateurs, nb_clients_pme, message, source,
          ip_soumission, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, created_at`,
      [nom_cabinet.trim(), nom_responsable.trim(), email_pro.toLowerCase().trim(),
       telephone || null, numero_onecca || null, ville || null,
       parseInt(nb_collaborateurs) || null, parseInt(nb_clients_pme) || null,
       message || null, source || 'site_web',
       req.ip, req.get('user-agent')]
    );

    console.log(`[CANDIDATURE CABINET] ${email_pro} — ${nom_cabinet}`);
    res.json({
      success: true,
      message: 'Candidature reçue. Notre équipe vous recontactera sous 48 heures ouvrées.',
      data: { id: r.rows[0].id },
    });
  } catch (err) {
    console.error('Erreur postulerPartenariat:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
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
  postulerPartenariat,
};
