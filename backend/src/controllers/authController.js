const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const pool = require('../../config/database');
const { PERMISSIONS, VISIBILITY, ALL_ROLES } = require('../utils/permissions');
const {
  creerCategoriesDefaut, creerPlanComptableSyscohada,
  creerJournauxDefaut, creerExerciceCourant,
  creerRubriquesPaieDefaut,
} = require('../utils/helpers');
const { ecritureFacture, ecriturePaiementFacture, ecritureDepense } = require('../utils/comptabilite-auto');
const { logAudit } = require('../utils/audit');

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

    // Comptabilité SYSCOHADA : plan de comptes, journaux, exercice en cours
    await creerPlanComptableSyscohada(entreprise.id, client);
    await creerJournauxDefaut(entreprise.id, client);
    await creerExerciceCourant(entreprise.id, client);
    // Rubriques de paie par défaut (CGI CI à jour) — toute entreprise
    // créée après l'application de la migration 005 a besoin d'un
    // catalogue initial pour que le module Paie soit utilisable.
    await creerRubriquesPaieDefaut(entreprise.id, client);

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
      logAudit(req, 'LOGIN_FAIL', 'auth', null, { email, raison: 'utilisateur_inconnu' });
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!valid) {
      // Injecter user dans req pour que logAudit capture l'utilisateur_id
      req.user = { id: user.id, email: user.email };
      logAudit(req, 'LOGIN_FAIL', 'auth', user.id, { email, raison: 'mauvais_mot_de_passe' });
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    req.user = { id: user.id, email: user.email };
    logAudit(req, 'LOGIN_OK', 'auth', user.id);

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
    // SELECT enrichi avec is_demo + demo_expires_at (migration 028) pour
    // afficher le bandeau « Compte démo · expire dans Xh » côté UI.
    // Fallback rétrocompat si la migration n'est pas appliquée.
    // is_super_admin ajouté en migration 029 (programme partenariat
    // cabinets) → fallback rétrocompat si migration non appliquée.
    const buildSql = (avecDemo, avecAdmin) => `
      SELECT id, nom, email, telephone, langue, created_at
             ${avecDemo ? ', is_demo, demo_expires_at' : ''}
             ${avecAdmin ? ', is_super_admin' : ''}
        FROM utilisateurs WHERE id = $1 AND actif = true`;
    let result;
    try {
      result = await pool.query(buildSql(true, true), [req.user.id]);
    } catch (err) {
      if (err.code === '42703') {
        try {
          result = await pool.query(buildSql(true, false), [req.user.id]);
        } catch (err2) {
          if (err2.code === '42703') result = await pool.query(buildSql(false, false), [req.user.id]);
          else throw err2;
        }
      } else throw err;
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur me:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /api/auth/me/langue — préférence de langue de l'utilisateur connecté
const LANGUES_SUPPORTEES = ['fr', 'en'];
const updateLangue = async (req, res) => {
  try {
    const { langue } = req.body;
    if (!LANGUES_SUPPORTEES.includes(langue)) {
      return res.status(400).json({
        success: false,
        message: `Langue invalide. Valeurs acceptées : ${LANGUES_SUPPORTEES.join(', ')}`,
      });
    }
    await pool.query(
      'UPDATE utilisateurs SET langue = $1, updated_at = NOW() WHERE id = $2',
      [langue, req.user.id]
    );
    res.json({ success: true, data: { langue } });
  } catch (err) {
    console.error('Erreur updateLangue:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/auth/demo — crée un compte démo ISOLÉ pour chaque visiteur.
//
// Migration 028 (mai 2026) : avant, un unique compte demo@comptawest.ci
// était partagé entre tous les visiteurs → risque RGPD et expérience
// cassée. Désormais, chaque clic crée un compte temporaire dédié avec :
//   - email unique demo-<random>@apex.local
//   - flag is_demo = TRUE + demo_expires_at = NOW() + 24h
//   - entreprise dédiée avec données pré-remplies (clients, factures…)
//   - JWT retourné directement → pas besoin de second appel /auth/login
//
// Fallback rétrocompat : si la migration 028 n'a pas encore été appliquée
// (colonne is_demo absente), on retombe sur le comportement legacy avec
// le compte partagé — l'app ne casse pas.
const crypto = require('crypto');

const loginDemo = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Email aléatoire (8 hex = 64 bits, suffisant pour éviter les collisions
    // dans une fenêtre de 24 h même avec un trafic élevé).
    const randomId = crypto.randomBytes(4).toString('hex');
    const demoEmail = `demo-${randomId}@apex.local`;
    const demoNom = `Démo ${randomId.toUpperCase()}`;
    const motDePasse = crypto.randomBytes(16).toString('hex'); // jamais affiché
    const hash = await bcrypt.hash(motDePasse, 10);

    // Tentative avec colonnes démo (migration 028) ; fallback rétrocompat
    // sur l'ancien compte partagé si la migration n'est pas appliquée.
    let user;
    let migration028Active = true;
    try {
      const uRes = await client.query(`
        INSERT INTO utilisateurs (nom, email, mot_de_passe, is_demo, demo_expires_at)
        VALUES ($1, $2, $3, TRUE, NOW() + INTERVAL '24 hours')
        RETURNING id, nom, email, is_demo, demo_expires_at
      `, [demoNom, demoEmail, hash]);
      user = uRes.rows[0];
    } catch (err) {
      if (err.code === '42703') {
        // Migration 028 non appliquée : retour au compte partagé legacy
        migration028Active = false;
        const legacyRes = await client.query(`
          INSERT INTO utilisateurs (nom, email, mot_de_passe)
          VALUES ('Compte Démo', 'demo@comptawest.ci', $1)
          ON CONFLICT (email) DO UPDATE SET mot_de_passe = $1
          RETURNING id, nom, email
        `, [hash]);
        user = legacyRes.rows[0];
      } else {
        throw err;
      }
    }

    // Création de l'entreprise dédiée (toujours, pour comptes isolés)
    let eid;
    if (migration028Active) {
      const newEnt = await client.query(`
        INSERT INTO entreprises (nom, forme_juridique, pays, devise, regime_fiscal, is_demo)
        VALUES ($1, 'SARL', 'Côte d''Ivoire', 'FCFA', 'RNI', TRUE)
        RETURNING id
      `, [`${demoNom} & Associés SARL`]);
      eid = newEnt.rows[0].id;
      await client.query(
        `INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role) VALUES ($1, $2, 'proprietaire')`,
        [user.id, eid]
      );
      await creerCategoriesDefaut(eid, client);
      await creerPlanComptableSyscohada(eid, client);
      await creerJournauxDefaut(eid, client);
      await creerExerciceCourant(eid, client);
      await creerRubriquesPaieDefaut(eid, client);
      await seederDonneesDemo(client, eid, user.id);
    } else {
      // Mode legacy : crée l'entreprise UNIQUEMENT si elle n'existe pas
      const entRes = await client.query(`
        SELECT e.id FROM entreprises e
        JOIN membres_entreprise m ON m.entreprise_id = e.id
        WHERE m.utilisateur_id = $1 LIMIT 1
      `, [user.id]);
      if (entRes.rows.length === 0) {
        const newEnt = await client.query(`
          INSERT INTO entreprises (nom, forme_juridique, pays, devise, regime_fiscal)
          VALUES ('Ouattara & Associés SARL', 'SARL', 'Côte d''Ivoire', 'FCFA', 'RNI')
          RETURNING id
        `);
        eid = newEnt.rows[0].id;
        await client.query(
          `INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role) VALUES ($1, $2, 'proprietaire')`,
          [user.id, eid]
        );
        await creerCategoriesDefaut(eid, client);
        await creerPlanComptableSyscohada(eid, client);
        await creerJournauxDefaut(eid, client);
        await creerExerciceCourant(eid, client);
        await creerRubriquesPaieDefaut(eid, client);
      }
    }

    await client.query('COMMIT');

    // JWT direct → le frontend bascule sur le dashboard sans login séparé
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }   // borné à la durée de vie du compte démo
    );

    res.json({
      success: true,
      message: 'Compte démo créé',
      data: {
        token,
        user: {
          id: user.id,
          nom: user.nom,
          email: user.email,
          is_demo: !!user.is_demo,
          demo_expires_at: user.demo_expires_at || null,
        },
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur loginDemo:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// Pré-remplissage des données démo : enrichi mai 2026 pour qu'un visiteur
// arrivant sur la démo trouve immédiatement du contenu réaliste dans
// chaque module (dashboard, clients, factures, dépenses, trésorerie,
// produits, employés, immobilisations, fournisseurs). Toutes les INSERT
// sont enveloppées d'un try/catch pour skip silencieusement les modules
// dont la migration n'est pas appliquée (ex : fournisseurs sans migration 008).
async function seederDonneesDemo(client, entrepriseId, userId) {
  // ─── ABONNEMENT CABINET (palier le plus haut, débloque tous les modules)
  try {
    await client.query(`
      INSERT INTO abonnements (entreprise_id, palier, statut, periodicite, date_debut, date_fin, prix_mensuel_fcfa, notes_commerciales)
      VALUES ($1, 'cabinet', 'actif', 'annuel', CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days', 60000, 'Compte démo — palier Cabinet débloqué pour explorer tous les modules')
    `, [entrepriseId]);
  } catch (err) { if (err.code !== '42P01' && err.code !== '23505') throw err; }

  // ─── 5 CLIENTS REPRÉSENTATIFS
  const clientsRes = await client.query(`
    INSERT INTO clients (entreprise_id, nom, email, telephone, ville, pays, code, actif)
    VALUES
      ($1, 'Banque Atlantique CI',  'contact@bact.ci',     '+225 27 20 24 16 00', 'Abidjan',  'Côte d''Ivoire', 'CLI-001', true),
      ($1, 'GIE Femmes du Sahel',   'gie@example.ci',      '+225 01 66 77 88',    'Korhogo',  'Côte d''Ivoire', 'CLI-002', true),
      ($1, 'SARL Logitrans',        'contact@logi.ci',     '+225 07 12 34 56 78', 'San-Pedro','Côte d''Ivoire', 'CLI-003', true),
      ($1, 'NSIA Assurances',       'compta@nsia.ci',      '+225 27 20 31 10 00', 'Abidjan',  'Côte d''Ivoire', 'CLI-004', true),
      ($1, 'Coopérative Cacao Sud', 'cacao@coop-sud.ci',   '+225 07 88 99 10 11', 'Daloa',    'Côte d''Ivoire', 'CLI-005', true)
    RETURNING id
  `, [entrepriseId]);
  const cliIds = clientsRes.rows.map(r => r.id);

  // ─── 8 FACTURES + DEVIS + AVOIR : couvre tout le cycle de vie commercial
  const j = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const factDefs = [
    { type: 'facture', cli: cliIds[0], statut: 'payee',     date: j(-60), desc: 'Audit comptable Q1 2026',            qte: 1, pu: 1200000 },
    { type: 'facture', cli: cliIds[1], statut: 'payee',     date: j(-45), desc: 'Formation SYSCOHADA 2 jours',         qte: 2, pu: 350000  },
    { type: 'facture', cli: cliIds[3], statut: 'envoyee',   date: j(-15), desc: 'Mission conseil fiscal annuel',       qte: 1, pu: 1800000 },
    { type: 'facture', cli: cliIds[2], statut: 'retard',    date: j(-8),  desc: 'Honoraires conseil mensuel',          qte: 1, pu: 450000  },
    { type: 'facture', cli: cliIds[4], statut: 'envoyee',   date: j(-3),  desc: 'Diagnostic comptable + recommandations', qte: 1, pu: 950000 },
    { type: 'facture', cli: cliIds[0], statut: 'brouillon', date: j(0),   desc: 'Mission Q2 2026 (proposition)',       qte: 1, pu: 850000  },
    { type: 'devis',   cli: cliIds[1], statut: 'brouillon', date: j(-2),  desc: 'Refonte plan comptable SYSCOHADA',    qte: 1, pu: 1500000 },
    { type: 'devis',   cli: cliIds[2], statut: 'brouillon', date: j(-1),  desc: 'Audit immobilisations',               qte: 1, pu: 680000  },
  ];
  const cptr = { facture: 0, devis: 0 };
  for (const f of factDefs) {
    cptr[f.type]++;
    const ht = f.qte * f.pu;
    const tva = ht * 0.18;
    const ttc = ht + tva;
    const year = new Date(f.date).getFullYear();
    const prefix = f.type === 'devis' ? 'D' : 'F';
    const numero = `${prefix}-${year}-${String(cptr[f.type]).padStart(3, '0')}`;
    const factRes = await client.query(`
      INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
        date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, montant_paye, conditions_paiement)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 18, $10, $11, $12, 'Paiement à 30 jours')
      RETURNING *
    `, [entrepriseId, f.cli, userId, numero, f.type, f.statut, f.date,
        new Date(new Date(f.date).getTime() + 30 * 86400000).toISOString().slice(0, 10),
        ht, tva, ttc, f.statut === 'payee' ? ttc : 0]);
    const factureRow = factRes.rows[0];
    await client.query(`
      INSERT INTO lignes_facture (facture_id, description, quantite, prix_unitaire, total)
      VALUES ($1, $2, $3, $4, $5)
    `, [factureRow.id, f.desc, f.qte, f.pu, ht]);

    // Auto-comptabilisation : toute facture/avoir validé (≠ devis/brouillon)
    // génère son écriture comptable (Débit 411 Clients / Crédit 70x + 4431 TVA)
    // exactement comme via l'UI standard. Sans ça, les factures sont en BDD
    // mais invisibles dans Grand Livre / Bilan.
    if (f.type === 'facture' && ['envoyee','retard','payee'].includes(f.statut)) {
      try {
        await ecritureFacture(client, { entrepriseId, utilisateurId: userId, facture: factureRow });
      } catch (err) {
        if (err.code !== '42P01') throw err;
      }
    }

    // Pour les factures payées : enregistrement du paiement + écriture
    // d'encaissement (Débit 521 Banque / Crédit 411 Clients) qui solde
    // la créance comptablement.
    if (f.statut === 'payee') {
      try {
        const paiementRes = await client.query(`
          INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference)
          VALUES ($1, $2, $3, 'virement', $4)
          RETURNING *
        `, [factureRow.id, ttc, f.date, `VIR-${numero}`]);
        try {
          await ecriturePaiementFacture(client, {
            entrepriseId, utilisateurId: userId,
            facture: factureRow, paiement: paiementRes.rows[0],
          });
        } catch (err) {
          if (err.code !== '42P01') throw err;
        }
      } catch (err) { if (err.code !== '42P01') throw err; }
    }
  }

  // ─── 6 DÉPENSES VARIÉES sur les 60 derniers jours
  const catRes = await client.query(
    `SELECT id, nom FROM categories_depenses WHERE entreprise_id = $1`,
    [entrepriseId]
  );
  const catMap = Object.fromEntries(catRes.rows.map(c => [c.nom, c.id]));
  const findCat = (...names) => names.map(n => catMap[n]).find(Boolean) || Object.values(catMap)[0];
  const depDefs = [
    { desc: 'Loyer bureau Cocody (Mai)',  cat: findCat('Loyers et charges', 'Charges externes'), ht: 250000, date: j(-25) },
    { desc: 'Facture CIE — Avril',         cat: findCat('Services extérieurs', 'Charges externes'), ht: 45000,  date: j(-20) },
    { desc: 'Carburant véhicule société',  cat: findCat('Carburants', 'Charges externes'),       ht: 35000,  date: j(-12) },
    { desc: 'Abonnement internet ORANGE',  cat: findCat('Services extérieurs', 'Charges externes'), ht: 50000, date: j(-10) },
    { desc: 'Fournitures bureau',          cat: findCat('Achats fournitures', 'Achats marchandises'), ht: 75000, date: j(-7) },
    { desc: 'Mission Yamoussoukro',        cat: findCat('Frais de déplacement', 'Charges externes'), ht: 120000, date: j(-3) },
  ];
  for (const d of depDefs) {
    if (!d.cat) continue;
    const depRes = await client.query(`
      INSERT INTO depenses (entreprise_id, categorie_id, description, montant_ht, taux_tva,
        montant_tva, montant_ttc, date_depense, mode_paiement, statut, cree_par)
      VALUES ($1, $2, $3, $4, 18, $5, $6, $7, 'virement', 'payee', $8)
      RETURNING *
    `, [entrepriseId, d.cat, d.desc, d.ht, d.ht * 0.18, d.ht * 1.18, d.date, userId]);
    // Auto-comptabilisation dépense : Débit 60x/61x Charges + 4452 TVA déductible /
    // Crédit 401 Fournisseurs (puis Débit 401 / Crédit 521 si statut=payee).
    try {
      await ecritureDepense(client, { entrepriseId, utilisateurId: userId, depense: depRes.rows[0] });
    } catch (err) {
      if (err.code !== '42P01') throw err;
    }
  }

  // ─── 3 FOURNISSEURS (si migration 008 appliquée)
  try {
    await client.query(`
      INSERT INTO fournisseurs (entreprise_id, nom, email, telephone, ville, code, actif)
      VALUES
        ($1, 'SCB Côte d''Ivoire',        'compta@scb.ci',       '+225 27 20 30 00 00', 'Abidjan',     'FOU-001', true),
        ($1, 'Imprimerie Plateau',         'contact@imp.ci',      '+225 07 11 22 33 44', 'Abidjan',     'FOU-002', true),
        ($1, 'PETRO IVOIRE Yopougon',     'station@petro.ci',    '+225 27 21 50 00 00', 'Abidjan',     'FOU-003', true)
    `, [entrepriseId]);
  } catch (err) { if (err.code !== '42P01' && err.code !== '23505') throw err; }

  // ─── 4 PRODUITS / SERVICES (si migration 007 appliquée)
  try {
    await client.query(`
      INSERT INTO produits (entreprise_id, code, libelle, description, type, prix_vente_ht, prix_achat_ht, taux_tva, unite, stock_actuel, seuil_alerte, actif)
      VALUES
        ($1, 'SRV-001', 'Mission d''audit comptable',  'Audit annuel des comptes selon SYSCOHADA',                  'service', 1500000, 0,      18, 'forfait', 0,   0, true),
        ($1, 'SRV-002', 'Formation SYSCOHADA',          'Formation 2 jours pour équipes comptables',                 'service', 350000,  0,      18, 'jour',    0,   0, true),
        ($1, 'PRD-001', 'Plan comptable papier',        'Recueil imprimé du plan comptable SYSCOHADA',               'produit', 12000,   7500,   18, 'unité',   25,  5, true),
        ($1, 'PRD-002', 'Logiciel de paie (licence)',  'Licence annuelle module paie standalone',                   'produit', 240000,  150000, 18, 'licence', 8,   2, true)
    `, [entrepriseId]);
  } catch (err) { if (err.code !== '42P01' && err.code !== '23505') throw err; }

  // ─── 3 EMPLOYÉS pour le module paie (si migration 005 appliquée)
  try {
    await client.query(`
      INSERT INTO employes (entreprise_id, matricule, nom, prenoms, sexe, date_naissance, situation_matrimoniale, nb_enfants_charge, telephone, email, poste, departement, date_embauche, type_contrat, salaire_base, mode_paiement)
      VALUES
        ($1, 'EMP-001', 'KOUADIO', 'Marc',     'M', '1985-03-15', 'marie',      2, '+225 07 11 22 33 44', 'marc.k@apex.local',   'Comptable senior',  'Comptabilité', CURRENT_DATE - INTERVAL '3 years',  'CDI', 450000, 'virement'),
        ($1, 'EMP-002', 'YAO',     'Sandrine', 'F', '1990-07-22', 'celibataire',1, '+225 05 66 77 88 99', 'sandrine.y@apex.local','Assistante RH',     'Admin',        CURRENT_DATE - INTERVAL '18 months','CDI', 280000, 'virement'),
        ($1, 'EMP-003', 'TRAORE',  'Issouf',   'M', '1988-11-09', 'marie',      3, '+225 01 22 33 44 55', 'issouf.t@apex.local', 'Coursier',          'Logistique',   CURRENT_DATE - INTERVAL '8 months', 'CDD', 180000, 'cash')
    `, [entrepriseId]);
  } catch (err) { if (err.code !== '42P01' && err.code !== '23505') throw err; }

  // ─── 2 IMMOBILISATIONS (si migration 006 appliquée)
  try {
    await client.query(`
      INSERT INTO immobilisations (entreprise_id, numero_inventaire, libelle, description, date_acquisition, date_mise_en_service, valeur_acquisition, amortissable, duree_annees, methode, statut, compte_actif, compte_amortissement, compte_dotation, cree_par)
      VALUES
        ($1, 'IMM-2024-001', 'Véhicule Toyota Hilux',    'Pick-up pour missions terrain',  CURRENT_DATE - INTERVAL '14 months', CURRENT_DATE - INTERVAL '14 months', 18500000, true, 5, 'lineaire', 'en_service', '244500', '284500', '681120', $2),
        ($1, 'IMM-2025-001', 'Parc informatique (5 PC)', 'Renouvellement matériel équipe', CURRENT_DATE - INTERVAL '4 months',  CURRENT_DATE - INTERVAL '4 months',  3200000,  true, 3, 'lineaire', 'en_service', '244200', '284200', '681120', $2)
    `, [entrepriseId, userId]);
  } catch (err) { if (err.code !== '42P01' && err.code !== '23505') throw err; }

  // ─── 3 COMPTES DE TRÉSORERIE (si migration 004 appliquée)
  try {
    await client.query(`
      INSERT INTO comptes_tresorerie (entreprise_id, nom, type, operateur, numero_compte, titulaire, solde_initial, devise, compte_pc_numero, par_defaut, actif)
      VALUES
        ($1, 'Banque Atlantique - Compte courant',  'banque',       'Banque Atlantique CI', 'CI008 01001 00000 000001', 'SARL Démo', 8500000, 'XOF', '521100', true,  true),
        ($1, 'Wave Business',                       'mobile_money', 'Wave',                 '+225 01 02 03 04 05',      'SARL Démo', 450000,  'XOF', '521300', false, true),
        ($1, 'Caisse principale',                   'caisse',       NULL,                   NULL,                       NULL,        250000,  'XOF', '571000', false, true)
    `, [entrepriseId]);
  } catch (err) { if (err.code !== '42P01' && err.code !== '23505') throw err; }
}

// Nettoyage des comptes démo expirés. Appelé toutes les heures par le
// cron applicatif (utils/cronJobs.js). Supprime d'abord les entreprises
// liées (CASCADE descend sur clients/factures/employés), puis les
// utilisateurs eux-mêmes. Compteur retourné pour les logs.
async function nettoyerComptesDemoExpires() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Liste des utilisateurs démo expirés (test si la migration 028 existe)
    let expiredIds;
    try {
      const r = await client.query(
        `SELECT id FROM utilisateurs WHERE is_demo = TRUE AND demo_expires_at < NOW()`
      );
      expiredIds = r.rows.map(x => x.id);
    } catch (err) {
      if (err.code === '42703') return { skipped: true, raison: 'migration_028_non_appliquee' };
      throw err;
    }
    if (expiredIds.length === 0) {
      await client.query('COMMIT');
      return { supprimes: 0 };
    }
    // Suppression dans l'ordre dicté par les FK non-CASCADE :
    //   1. lignes_ecriture → leurs compte_id pointent vers plan_comptable qui
    //      sera supprimé par CASCADE depuis entreprises
    //   2. ecritures → CASCADE depuis entreprises possible, mais on les
    //      supprime explicitement pour libérer les lignes_ecriture
    //   3. entreprises → CASCADE descend sur clients, factures, employés,
    //      plan_comptable, journaux, exercices, abonnements…
    //   4. utilisateurs (à la fin, après que les FK cree_par soient
    //      orphelinées par les cascades précédentes)
    const eidsRes = await client.query(
      `SELECT entreprise_id FROM membres_entreprise WHERE utilisateur_id = ANY($1)`,
      [expiredIds]
    );
    const entrepriseIds = eidsRes.rows.map(r => r.entreprise_id);
    if (entrepriseIds.length > 0) {
      await client.query(
        `DELETE FROM lignes_ecriture WHERE ecriture_id IN (
           SELECT id FROM ecritures WHERE entreprise_id = ANY($1)
         )`,
        [entrepriseIds]
      ).catch(err => { if (err.code !== '42P01') throw err; });
      await client.query(
        `DELETE FROM ecritures WHERE entreprise_id = ANY($1)`,
        [entrepriseIds]
      ).catch(err => { if (err.code !== '42P01') throw err; });
      await client.query(`DELETE FROM entreprises WHERE id = ANY($1)`, [entrepriseIds]);
    }
    const delUsers = await client.query(
      `DELETE FROM utilisateurs WHERE id = ANY($1) RETURNING id`,
      [expiredIds]
    );
    await client.query('COMMIT');
    return { supprimes: delUsers.rowCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── INVITATIONS ───────────────────────────────────────────────────────────

// GET /api/auth/invitation/:token — infos publiques d'une invitation
// Permet à la page d'activation d'afficher « Vous êtes invité chez X en tant que Y »
const getInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.nom, u.email, u.invitation_expire_at,
              e.nom AS entreprise_nom, me.role
       FROM utilisateurs u
       JOIN membres_entreprise me ON me.utilisateur_id = u.id AND me.actif = true
       JOIN entreprises e ON e.id = me.entreprise_id
       WHERE u.invitation_token = $1 AND u.actif = false
       ORDER BY me.created_at DESC
       LIMIT 1`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lien d\'invitation invalide ou déjà utilisé' });
    }
    const inv = result.rows[0];
    if (inv.invitation_expire_at && new Date(inv.invitation_expire_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'Lien d\'invitation expiré. Demandez une nouvelle invitation.' });
    }
    res.json({
      success: true,
      data: {
        nom: inv.nom, email: inv.email,
        entreprise_nom: inv.entreprise_nom, role: inv.role,
      },
    });
  } catch (err) {
    console.error('Erreur getInvitation:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/auth/invitation/:token — l'invité définit son mot de passe
// Active le compte, consomme le token, et connecte automatiquement l'utilisateur.
const accepterInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const { nom, mot_de_passe } = req.body;

    if (!mot_de_passe || mot_de_passe.length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe : 8 caractères minimum' });
    }

    const result = await pool.query(
      `SELECT id, email, invitation_expire_at FROM utilisateurs
       WHERE invitation_token = $1 AND actif = false`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lien d\'invitation invalide ou déjà utilisé' });
    }
    const user = result.rows[0];
    if (user.invitation_expire_at && new Date(user.invitation_expire_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'Lien d\'invitation expiré' });
    }

    const hash = await bcrypt.hash(mot_de_passe, 12);
    await pool.query(
      `UPDATE utilisateurs
       SET mot_de_passe = $1, actif = true, nom = COALESCE(NULLIF($2, ''), nom),
           invitation_token = NULL, invitation_expire_at = NULL, updated_at = NOW()
       WHERE id = $3`,
      [hash, nom || '', user.id]
    );

    // Connexion automatique
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    req.user = { id: user.id, email: user.email };
    logAudit(req, 'INVITATION_ACCEPTED', 'auth', user.id, { email: user.email });

    const userRes = await pool.query(
      'SELECT id, nom, email, telephone FROM utilisateurs WHERE id = $1', [user.id]
    );
    res.json({ success: true, data: { user: userRes.rows[0], token: jwtToken } });
  } catch (err) {
    console.error('Erreur accepterInvitation:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/auth/me/permissions
// Renvoie le rôle de l'utilisateur sur l'entreprise courante + la liste des
// actions autorisées par module + les champs masqués (matrice projetée pour
// CE rôle). Le frontend l'appelle après login et à chaque changement
// d'entreprise pour adapter la nav et l'UI.
//
// Requiert le middleware entrepriseAccess() en amont (req.roleEntreprise).
const getMesPermissions = async (req, res) => {
  try {
    const role = req.roleEntreprise;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Rôle entreprise non résolu' });
    }
    // Si le membre a un override personnalisé (réglé par le Propriétaire
    // depuis Paramètres → Membres), on l'utilise tel quel. Sinon on
    // projette la matrice statique pour son rôle. Le front a `is_custom`
    // pour afficher un indicateur « permissions personnalisées ».
    const override = req.permissionsOverride;
    const can = override
      ? { ...override }
      : (() => {
          const out = {};
          for (const [module, actions] of Object.entries(PERMISSIONS)) {
            const autorisees = [];
            for (const [action, roles] of Object.entries(actions)) {
              if (Array.isArray(roles) && roles.includes(role)) autorisees.push(action);
            }
            if (autorisees.length > 0) out[module] = autorisees;
          }
          return out;
        })();

    // Champs sensibles que l'utilisateur PEUT voir (inverse du masquage)
    const voitChamps = {};
    for (const [module, fields] of Object.entries(VISIBILITY)) {
      const visibles = Object.entries(fields)
        .filter(([, roles]) => roles.includes(role))
        .map(([champ]) => champ);
      voitChamps[module] = visibles;
    }
    res.json({
      success: true,
      data: {
        role, can, voitChamps,
        entreprise_id: req.entrepriseId,
        is_custom: !!override,
        via_cabinet: !!req.viaCabinet,
      },
    });
  } catch (err) {
    console.error('Erreur getMesPermissions:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  register, login, me, updateLangue, loginDemo, getInvitation, accepterInvitation,
  getMesPermissions,
  registerRules, loginRules,
  nettoyerComptesDemoExpires,
};
