const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const pool = require('../../config/database');
const { creerCategoriesDefaut } = require('../utils/helpers');

// ── Règles de validation ──────────────────────────────────────────────────
const registerRules = [
  body('nom').trim().notEmpty().withMessage('Nom requis').isLength({ max: 100 }).withMessage('Nom trop long'),
  body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
  body('mot_de_passe').isLength({ min: 8 }).withMessage('Mot de passe : 8 caractères minimum'),
  body('entreprise').optional().trim().isLength({ max: 150 }),
  body('pays').optional().trim().isLength({ max: 50 }),
];

const loginRules = [
  body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
  body('mot_de_passe').notEmpty().withMessage('Mot de passe requis'),
];

// POST /api/auth/register
const register = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nom, email, mot_de_passe, entreprise: entrepriseNom, pays, telephone } = req.body;

    const existing = await client.query('SELECT id FROM utilisateurs WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    const hash = await bcrypt.hash(mot_de_passe, 12);

    const userRes = await client.query(
      `INSERT INTO utilisateurs (nom, email, mot_de_passe, telephone)
       VALUES ($1, $2, $3, $4) RETURNING id, nom, email, telephone, created_at`,
      [nom.trim(), email, hash, telephone || null]
    );
    const user = userRes.rows[0];

    const nomEnt = (entrepriseNom || `${nom} Entreprise`).trim();
    const entRes = await client.query(
      `INSERT INTO entreprises (nom, pays, devise)
       VALUES ($1, $2, 'FCFA') RETURNING id, nom`,
      [nomEnt, pays || "Côte d'Ivoire"]
    );
    const entreprise = entRes.rows[0];

    await client.query(
      'INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role) VALUES ($1, $2, $3)',
      [user.id, entreprise.id, 'proprietaire']
    );

    // Utiliser le helper partagé (plus de duplication)
    await creerCategoriesDefaut(entreprise.id, client);

    await client.query('COMMIT');

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ success: true, data: { user, token, entreprise_id: entreprise.id } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur register:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;

    const result = await pool.query(
      'SELECT id, nom, email, mot_de_passe, telephone FROM utilisateurs WHERE email = $1 AND actif = true',
      [email]
    );

    // Message générique pour ne pas révéler si l'email existe
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { mot_de_passe: _, ...userSafe } = user;
    res.json({ success: true, data: { user: userSafe, token } });
  } catch (err) {
    console.error('Erreur login:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom, email, telephone, created_at FROM utilisateurs WHERE id = $1 AND actif = true',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur me:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/auth/demo — crée/réinitialise le compte démo automatiquement
const loginDemo = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const DEMO_EMAIL = 'demo@comptawest.ci';
    const DEMO_NOM   = 'Compte Démo';
    const DEMO_MDP   = 'demo1234';
    const hash = await require('bcryptjs').hash(DEMO_MDP, 10);

    // Upsert : crée ou remet à jour le mot de passe du compte démo
    const uRes = await client.query(`
      INSERT INTO utilisateurs (nom, email, mot_de_passe)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET mot_de_passe = $3, nom = $1
      RETURNING id, nom, email
    `, [DEMO_NOM, DEMO_EMAIL, hash]);

    const user = uRes.rows[0];

    // Créer une entreprise démo si l'utilisateur n'en a pas
    const entRes = await client.query(`
      SELECT e.id FROM entreprises e
      JOIN membres_entreprise m ON m.entreprise_id = e.id
      WHERE m.utilisateur_id = $1 LIMIT 1
    `, [user.id]);

    if (entRes.rows.length === 0) {
      const newEnt = await client.query(`
        INSERT INTO entreprises (nom, forme_juridique, pays, devise, regime_fiscal)
        VALUES ('Ouattara & Associés SARL', 'SARL', 'Côte d''Ivoire', 'FCFA', 'Réel Normal')
        RETURNING id
      `);
      const eid = newEnt.rows[0].id;
      await client.query(
        `INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role) VALUES ($1, $2, 'proprietaire')`,
        [user.id, eid]
      );
      await creerCategoriesDefaut(client, eid);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Compte démo prêt' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur loginDemo:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};
module.exports = { register, login, me, loginDemo, registerRules, loginRules };
