const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { creerCategoriesDefaut } = require('../utils/helpers');

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
        (SELECT COUNT(*) FROM factures f WHERE f.entreprise_id = e.id) AS nb_factures,
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
       ORDER BY CASE me.role WHEN 'proprietaire' THEN 1 WHEN 'admin' THEN 2 WHEN 'comptable' THEN 3 ELSE 4 END, u.nom ASC`,
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

    const rolesValides = ['admin', 'comptable', 'user', 'lecture'];
    if (!rolesValides.includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }

    let userRes = await client.query('SELECT id FROM utilisateurs WHERE email = $1', [email]);
    let userId;

    if (userRes.rows.length === 0) {
      // Compte provisoire avec mot de passe aléatoire fort
      const tempPwd = await bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 12);
      const newUser = await client.query(
        'INSERT INTO utilisateurs (nom, email, mot_de_passe) VALUES ($1,$2,$3) RETURNING id',
        [nom || email.split('@')[0], email, tempPwd]
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    const exist = await client.query(
      'SELECT id FROM membres_entreprise WHERE utilisateur_id=$1 AND entreprise_id=$2',
      [userId, id]
    );

    if (exist.rows.length > 0) {
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
    res.json({ success: true, message: `Membre ${email} ajouté avec le rôle ${role}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur inviterMembre:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// PUT /api/entreprises/:id/membres/:userId/role
const updateRoleMembre = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    const rolesValides = ['admin', 'comptable', 'user', 'lecture'];
    if (!rolesValides.includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }

    // Empêcher de changer le rôle du propriétaire
    const check = await pool.query(
      'SELECT role FROM membres_entreprise WHERE utilisateur_id=$1 AND entreprise_id=$2',
      [userId, id]
    );
    if (check.rows[0]?.role === 'proprietaire') {
      return res.status(400).json({ success: false, message: 'Impossible de modifier le rôle du propriétaire' });
    }

    const result = await pool.query(
      'UPDATE membres_entreprise SET role=$1 WHERE utilisateur_id=$2 AND entreprise_id=$3 RETURNING *',
      [role, userId, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Membre introuvable' });
    }
    res.json({ success: true, message: 'Rôle mis à jour' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// DELETE /api/entreprises/:id/membres/:userId
const retirerMembre = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const check = await pool.query(
      'SELECT role FROM membres_entreprise WHERE utilisateur_id=$1 AND entreprise_id=$2',
      [userId, id]
    );
    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: 'Membre introuvable' });
    }
    if (check.rows[0].role === 'proprietaire') {
      return res.status(400).json({ success: false, message: 'Impossible de retirer le propriétaire' });
    }
    await pool.query(
      'UPDATE membres_entreprise SET actif=false WHERE utilisateur_id=$1 AND entreprise_id=$2',
      [userId, id]
    );
    res.json({ success: true, message: 'Membre retiré' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  getMesEntreprises, createEntreprise, updateEntreprise,
  getMembres, inviterMembre, updateRoleMembre, retirerMembre,
  entrepriseRules,
};
