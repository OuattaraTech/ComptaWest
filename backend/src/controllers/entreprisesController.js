const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const {
  creerCategoriesDefaut, creerPlanComptableSyscohada,
  creerJournauxDefaut, creerExerciceCourant,
} = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

const entrepriseRules = [
  body('nom').trim().notEmpty().withMessage('Nom requis').isLength({ max: 150 }),
  body('email').optional().isEmail().withMessage('Email invalide').normalizeEmail(),
  body('taux_tva').optional().isFloat({ min: 0, max: 100 }).withMessage('TVA invalide'),
];

// GET /api/entreprises
const getMesEntreprises = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, me.role,
        (SELECT COUNT(*) FROM membres_entreprise m2 WHERE m2.entreprise_id = e.id AND m2.actif = true) AS nb_membres,
        (SELECT COUNT(*) FROM factures f WHERE f.entreprise_id = e.id AND f.type = 'facture') AS nb_factures,
        (SELECT COUNT(*) FROM clients c WHERE c.entreprise_id = e.id AND c.actif = true) AS nb_clients
       FROM entreprises e
       JOIN membres_entreprise me ON me.entreprise_id = e.id
       WHERE me.utilisateur_id = $1 AND me.actif = true AND e.actif = true
       ORDER BY me.created_at ASC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getMesEntreprises:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/entreprises
const createEntreprise = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      nom, sigle, forme_juridique, secteur, email, telephone,
      adresse, ville, pays, ninea, rccm, regime_fiscal, taux_tva,
    } = req.body;

    const entRes = await client.query(
      `INSERT INTO entreprises (nom, sigle, forme_juridique, secteur, email, telephone,
        adresse, ville, pays, ninea, rccm, regime_fiscal, taux_tva)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        nom.trim(), sigle || null, forme_juridique || 'SARL', secteur || null,
        email || null, telephone || null, adresse || null,
        ville || null, pays || "Côte d'Ivoire", ninea || null,
        rccm || null, regime_fiscal || 'RSI', parseFloat(taux_tva) || 18.00,
      ]
    );
    const entreprise = entRes.rows[0];

    await client.query(
      'INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role) VALUES ($1,$2,$3)',
      [req.user.id, entreprise.id, 'proprietaire']
    );

    // Helper partagé (zéro duplication)
    await creerCategoriesDefaut(entreprise.id, client);

    // Comptabilité SYSCOHADA : plan de comptes, journaux, exercice en cours
    await creerPlanComptableSyscohada(entreprise.id, client);
    await creerJournauxDefaut(entreprise.id, client);
    await creerExerciceCourant(entreprise.id, client);

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: entreprise });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur createEntreprise:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// PUT /api/entreprises/:id
const updateEntreprise = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom, sigle, forme_juridique, secteur, email, telephone,
      adresse, ville, pays, ninea, rccm, regime_fiscal, taux_tva,
    } = req.body;

    if (!nom || !nom.trim()) {
      return res.status(400).json({ success: false, message: 'Nom requis' });
    }

    const result = await pool.query(
      `UPDATE entreprises SET
        nom=$1, sigle=$2, forme_juridique=$3, secteur=$4, email=$5, telephone=$6,
        adresse=$7, ville=$8, pays=$9, ninea=$10, rccm=$11, regime_fiscal=$12, taux_tva=$13,
        updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [
        nom.trim(), sigle || null, forme_juridique || 'SARL', secteur || null,
        email || null, telephone || null, adresse || null,
        ville || null, pays || "Côte d'Ivoire", ninea || null,
        rccm || null, regime_fiscal || 'RSI', parseFloat(taux_tva) || 18.00,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    }
    logAudit(req, 'UPDATE', 'entreprises', id, { nom: nom.trim(), regime_fiscal, taux_tva });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateEntreprise:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/entreprises/:id/membres
const getMembres = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.nom, u.email, u.telephone, me.role, me.created_at, me.actif
       FROM membres_entreprise me
       JOIN utilisateurs u ON u.id = me.utilisateur_id
       WHERE me.entreprise_id = $1
       ORDER BY CASE me.role WHEN 'proprietaire' THEN 1 WHEN 'admin' THEN 2 WHEN 'comptable' THEN 3 WHEN 'rh' THEN 4 ELSE 5 END, u.nom ASC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/entreprises/:id/membres
const inviterMembre = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { email, role = 'user', nom } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    const rolesValides = ['admin', 'comptable', 'rh', 'user', 'lecture'];
    if (!rolesValides.includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }

    const emailNorm = email.trim().toLowerCase();

    // Garde-fou : on ne peut pas s'inviter soi-même (cela écraserait son propre rôle)
    if (req.user?.email && emailNorm === req.user.email.trim().toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas vous inviter vous-même : vous êtes déjà membre de cette entreprise.',
      });
    }

    let userRes = await client.query(
      'SELECT id, actif FROM utilisateurs WHERE email = $1', [emailNorm]
    );
    let userId;
    let invitationToken = null;       // non-null seulement pour un nouveau compte
    let compteExistant = false;

    if (userRes.rows.length === 0) {
      // Nouveau compte : créé inactif, avec un lien d'invitation à usage unique.
      // Le mot de passe restera un hash aléatoire jusqu'à ce que l'invité
      // définisse le sien via /invitation/<token>.
      const tempPwd = await bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 12);
      invitationToken = require('crypto').randomBytes(24).toString('hex');
      const expire = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 jours
      const newUser = await client.query(
        `INSERT INTO utilisateurs (nom, email, mot_de_passe, actif, invitation_token, invitation_expire_at)
         VALUES ($1,$2,$3,false,$4,$5) RETURNING id`,
        [nom || emailNorm.split('@')[0], emailNorm, tempPwd, invitationToken, expire]
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
      compteExistant = userRes.rows[0].actif;
      // Compte existant mais encore inactif (invitation précédente non acceptée) :
      // on régénère un token frais.
      if (!userRes.rows[0].actif) {
        invitationToken = require('crypto').randomBytes(24).toString('hex');
        const expire = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await client.query(
          'UPDATE utilisateurs SET invitation_token=$1, invitation_expire_at=$2 WHERE id=$3',
          [invitationToken, expire, userId]
        );
      }
    }

    const exist = await client.query(
      'SELECT id, role, actif FROM membres_entreprise WHERE utilisateur_id=$1 AND entreprise_id=$2',
      [userId, id]
    );

    if (exist.rows.length > 0) {
      // Le membre a déjà une ligne pour cette entreprise.
      if (exist.rows[0].actif) {
        // Déjà membre actif : on NE touche PAS à son rôle (une invitation ne doit
        // jamais rétrograder ni reconfigurer un membre existant — risque de se
        // dégrader soi-même ou un propriétaire).
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `${emailNorm} est déjà membre de cette entreprise. Modifiez son rôle depuis la liste des membres.`,
        });
      }
      // Membre anciennement retiré (actif = false) : on le réactive avec le nouveau rôle.
      await client.query(
        'UPDATE membres_entreprise SET role=$1, actif=true WHERE utilisateur_id=$2 AND entreprise_id=$3',
        [role, userId, id]
      );
    } else {
      await client.query(
        'INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role) VALUES ($1,$2,$3)',
        [userId, id, role]
      );
    }

    await client.query('COMMIT');
    logAudit(req, 'INVITE', 'membres', userId, { email: emailNorm, role, nouveau_compte: !!invitationToken });

    // Construit le lien d'invitation pour le front (le frontend complète le domaine)
    const lienInvitation = invitationToken ? `/invitation/${invitationToken}` : null;

    res.json({
      success: true,
      message: compteExistant
        ? `${email} a déjà un compte ComptaWest : il/elle verra l'entreprise dès sa prochaine connexion.`
        : `Invitation créée pour ${email}. Transmettez-lui le lien ci-dessous.`,
      data: {
        email, role,
        compte_existant: compteExistant,
        lien_invitation: lienInvitation,    // null si le compte existait déjà et est actif
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur inviterMembre:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// Compte les propriétaires actifs d'une entreprise, en excluant éventuellement un membre.
const compterProprietaires = async (entrepriseId, exclureUserId = null) => {
  const r = await pool.query(
    `SELECT COUNT(*) FROM membres_entreprise
     WHERE entreprise_id = $1 AND role = 'proprietaire' AND actif = true
       AND ($2::uuid IS NULL OR utilisateur_id != $2)`,
    [entrepriseId, exclureUserId]
  );
  return parseInt(r.rows[0].count, 10);
};

// PUT /api/entreprises/:id/membres/:userId/role
const updateRoleMembre = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    // 'proprietaire' est assignable : on peut promouvoir un membre ou transférer la propriété
    const rolesValides = ['proprietaire', 'admin', 'comptable', 'rh', 'user', 'lecture'];
    if (!rolesValides.includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }

    const check = await pool.query(
      'SELECT role FROM membres_entreprise WHERE utilisateur_id=$1 AND entreprise_id=$2 AND actif=true',
      [userId, id]
    );
    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: 'Membre introuvable' });
    }
    const ancienRole = check.rows[0].role;
    if (ancienRole === role) {
      return res.json({ success: true, message: 'Aucun changement' });
    }

    // Garde-fou : une entreprise doit toujours garder au moins un propriétaire.
    // Si on rétrograde un propriétaire, il doit en rester au moins un autre.
    if (ancienRole === 'proprietaire' && role !== 'proprietaire') {
      const autresProprietaires = await compterProprietaires(id, userId);
      if (autresProprietaires === 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible : c\'est le dernier propriétaire. Nommez d\'abord un autre propriétaire.',
        });
      }
    }

    await pool.query(
      'UPDATE membres_entreprise SET role=$1 WHERE utilisateur_id=$2 AND entreprise_id=$3',
      [role, userId, id]
    );
    logAudit(req, 'ROLE_CHANGE', 'membres', userId, { ancien_role: ancienRole, nouveau_role: role });
    res.json({ success: true, message: 'Rôle mis à jour' });
  } catch (err) {
    console.error('Erreur updateRoleMembre:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// DELETE /api/entreprises/:id/membres/:userId
const retirerMembre = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const check = await pool.query(
      'SELECT role FROM membres_entreprise WHERE utilisateur_id=$1 AND entreprise_id=$2 AND actif=true',
      [userId, id]
    );
    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: 'Membre introuvable' });
    }

    // Garde-fou : ne pas retirer le dernier propriétaire de l'entreprise
    if (check.rows[0].role === 'proprietaire') {
      const autresProprietaires = await compterProprietaires(id, userId);
      if (autresProprietaires === 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible : c\'est le dernier propriétaire. L\'entreprise doit garder au moins un propriétaire.',
        });
      }
    }

    await pool.query(
      'UPDATE membres_entreprise SET actif=false WHERE utilisateur_id=$1 AND entreprise_id=$2',
      [userId, id]
    );
    logAudit(req, 'REVOKE', 'membres', userId, { ancien_role: check.rows[0].role });
    res.json({ success: true, message: 'Membre retiré' });
  } catch (err) {
    console.error('Erreur retirerMembre:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  getMesEntreprises, createEntreprise, updateEntreprise,
  getMembres, inviterMembre, updateRoleMembre, retirerMembre,
  entrepriseRules,
};
