const pool = require('../../config/database');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

const fournisseurRules = [
  body('nom').trim().notEmpty().withMessage('Nom requis').isLength({ max: 200 }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email invalide').normalizeEmail(),
  body('type').optional().isIn(['entreprise', 'particulier', 'administration']),
];

// Génère un code interne unique
const generateCode = async (entrepriseId) => {
  const r = await pool.query(
    `SELECT COUNT(*) FROM fournisseurs WHERE entreprise_id = $1`,
    [entrepriseId]
  );
  return `F-${String(parseInt(r.rows[0].count) + 1).padStart(4, '0')}`;
};

// Génère le code auxiliaire SYSCOHADA 4011XXX
const generateCodeAux = async (entrepriseId) => {
  const r = await pool.query(
    `SELECT COUNT(*) FROM fournisseurs WHERE entreprise_id = $1 AND code_auxiliaire LIKE '4011%'`,
    [entrepriseId]
  );
  return `4011${String(parseInt(r.rows[0].count) + 1).padStart(3, '0')}`;
};

// GET /api/fournisseurs
const getFournisseurs = async (req, res) => {
  try {
    const { search, actif = 'true', page = 1, limit = 30 } = req.query;
    const eid = req.entrepriseId;
    const actifBool = actif !== 'false';
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    // Encours = balance du compte auxiliaire fournisseur (solde 4011XXX) :
    //   total facturé (dépenses non annulées) − total payé (tous les paiements).
    // On utilise des sous-requêtes scalaires pour éviter l'explosion cartésienne
    // d'un double LEFT JOIN sur dépenses + paiements_fournisseur.
    let query = `
      SELECT f.*,
        (SELECT COUNT(*) FROM depenses
           WHERE fournisseur_id = f.id AND statut != 'annulee') AS nb_depenses,
        (SELECT COALESCE(SUM(montant_ttc), 0) FROM depenses
           WHERE fournisseur_id = f.id AND statut != 'annulee') AS total_facture,
        GREATEST(
          (SELECT COALESCE(SUM(montant_ttc), 0) FROM depenses
             WHERE fournisseur_id = f.id AND statut != 'annulee')
          - (SELECT COALESCE(SUM(montant), 0) FROM paiements_fournisseur
               WHERE fournisseur_id = f.id),
          0
        ) AS encours
      FROM fournisseurs f
      WHERE f.entreprise_id = $1 AND f.archived_at IS NULL AND f.actif = $2
    `;
    const params = [eid, actifBool];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (f.nom ILIKE $${params.length} OR f.code ILIKE $${params.length}
                  OR f.email ILIKE $${params.length} OR f.ninea ILIKE $${params.length})`;
    }

    const countParams = [eid, actifBool];
    let countQuery = `SELECT COUNT(*) FROM fournisseurs WHERE entreprise_id = $1 AND archived_at IS NULL AND actif = $2`;
    if (search && search.trim()) {
      countParams.push(`%${search.trim()}%`);
      countQuery += ` AND (nom ILIKE $${countParams.length} OR code ILIKE $${countParams.length}
                       OR email ILIKE $${countParams.length} OR ninea ILIKE $${countParams.length})`;
    }
    const countRes = await pool.query(countQuery, countParams);

    query += ` ORDER BY f.nom LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    res.json({
      success: true, data: result.rows,
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page), limit: parseInt(limit),
        pages: Math.ceil(countRes.rows[0].count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Erreur getFournisseurs:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// GET /api/fournisseurs/:id
const getFournisseurById = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `SELECT * FROM fournisseurs WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Fournisseur introuvable' });

    // Historique des dépenses (15 dernières)
    const depenses = await pool.query(
      `SELECT id, numero, description, montant_ttc, date_depense, statut
       FROM depenses WHERE fournisseur_id = $1 ORDER BY date_depense DESC LIMIT 15`,
      [id]
    );

    // Commandes d'achat
    const commandes = await pool.query(
      `SELECT id, numero, date_commande, total_ttc, statut
       FROM commandes_achat WHERE fournisseur_id = $1 ORDER BY date_commande DESC LIMIT 10`,
      [id]
    );

    // Solde fournisseur (balance auxiliaire 4011XXX) :
    //   encours = total facturé non annulé − tous les paiements (imputés ou non).
    const solde = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(montant_ttc) FROM depenses
                    WHERE fournisseur_id = $1 AND statut != 'annulee'), 0) AS total_facture,
         GREATEST(
           COALESCE((SELECT SUM(montant_ttc) FROM depenses
                      WHERE fournisseur_id = $1 AND statut != 'annulee'), 0)
           - COALESCE((SELECT SUM(montant) FROM paiements_fournisseur
                        WHERE fournisseur_id = $1), 0),
           0
         ) AS encours`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...r.rows[0],
        depenses: depenses.rows,
        commandes: commandes.rows,
        encours: parseFloat(solde.rows[0].encours),
        total_facture: parseFloat(solde.rows[0].total_facture),
      },
    });
  } catch (err) {
    console.error('Erreur getFournisseurById:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// POST /api/fournisseurs
const createFournisseur = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;
    const b = req.body;
    const code = b.code || await generateCode(eid);
    const codeAux = b.code_auxiliaire || await generateCodeAux(eid);

    const r = await client.query(
      `INSERT INTO fournisseurs (
        entreprise_id, code, code_auxiliaire, nom, type, email, telephone,
        contact_principal, adresse, ville, pays, ninea, rccm,
        delai_paiement_jours, mode_paiement_defaut, banque, rib, numero_mobile_money,
        compte_charge_defaut, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        eid, code, codeAux, b.nom, b.type || 'entreprise',
        b.email || null, b.telephone || null, b.contact_principal || null,
        b.adresse || null, b.ville || null, b.pays || 'Côte d\'Ivoire',
        b.ninea || null, b.rccm || null,
        parseInt(b.delai_paiement_jours) || 30,
        b.mode_paiement_defaut || 'virement',
        b.banque || null, b.rib || null, b.numero_mobile_money || null,
        b.compte_charge_defaut || null, b.notes || null,
      ]
    );

    // Création du compte auxiliaire dans le plan comptable. Sans cette ligne,
    // l'écriture comptable de paiement fournisseur échoue silencieusement avec
    // COMPTE_INCONNU. ON CONFLICT : code aux saisi manuellement et déjà présent.
    await client.query(
      `INSERT INTO plan_comptable (entreprise_id, numero, libelle, classe, nature, parent_numero, est_lettrable)
       VALUES ($1, $2, $3, 4, 'PASSIF', '4011', true)
       ON CONFLICT (entreprise_id, numero) DO NOTHING`,
      [eid, codeAux, `Fournisseur ${b.nom}`.slice(0, 200)]
    );

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'fournisseurs', r.rows[0].id, { code, code_auxiliaire: codeAux, nom: b.nom });
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Code déjà utilisé' });
    }
    console.error('Erreur createFournisseur:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création' });
  } finally {
    client.release();
  }
};

// PUT /api/fournisseurs/:id
const updateFournisseur = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const b = req.body;
    const r = await pool.query(
      `UPDATE fournisseurs SET
        nom = COALESCE($1, nom),
        type = COALESCE($2, type),
        email = $3, telephone = $4, contact_principal = $5,
        adresse = $6, ville = $7, pays = COALESCE($8, pays),
        ninea = $9, rccm = $10,
        delai_paiement_jours = COALESCE($11, delai_paiement_jours),
        mode_paiement_defaut = COALESCE($12, mode_paiement_defaut),
        banque = $13, rib = $14, numero_mobile_money = $15,
        compte_charge_defaut = $16, notes = $17,
        actif = COALESCE($18, actif),
        updated_at = NOW()
       WHERE id = $19 AND entreprise_id = $20 RETURNING *`,
      [b.nom, b.type, b.email || null, b.telephone || null, b.contact_principal || null,
       b.adresse || null, b.ville || null, b.pays,
       b.ninea || null, b.rccm || null,
       b.delai_paiement_jours, b.mode_paiement_defaut,
       b.banque || null, b.rib || null, b.numero_mobile_money || null,
       b.compte_charge_defaut || null, b.notes || null, b.actif,
       id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Introuvable' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur updateFournisseur:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// DELETE /api/fournisseurs/:id
const archiveFournisseur = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `UPDATE fournisseurs SET archived_at = NOW(), actif = FALSE
       WHERE id = $1 AND entreprise_id = $2 RETURNING id`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Introuvable' });
    logAudit(req, 'DELETE', 'fournisseurs', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur archiveFournisseur:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// GET /api/fournisseurs/stats
const getStatsFournisseurs = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const annee = parseInt(req.query.annee) || new Date().getFullYear();

    // Encours total = somme des soldes auxiliaires des fournisseurs actifs.
    // Solde par fournisseur = total facturé − total payé (avec plancher à 0).
    const synth = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM fournisseurs
            WHERE entreprise_id = $1 AND archived_at IS NULL) AS nb_actifs,
         (SELECT COUNT(*) FROM depenses
            WHERE entreprise_id = $1 AND statut = 'en_retard') AS nb_retard,
         COALESCE(SUM(GREATEST(
           (SELECT COALESCE(SUM(montant_ttc), 0) FROM depenses
              WHERE fournisseur_id = f.id AND statut != 'annulee')
           - (SELECT COALESCE(SUM(montant), 0) FROM paiements_fournisseur
                WHERE fournisseur_id = f.id),
           0
         )), 0) AS encours_total
       FROM fournisseurs f
       WHERE f.entreprise_id = $1 AND f.archived_at IS NULL`,
      [eid]
    );

    // Top 10 fournisseurs sur l'année
    const top = await pool.query(
      `SELECT f.id, f.nom, f.code,
        COUNT(d.id) AS nb_depenses,
        COALESCE(SUM(d.montant_ttc), 0) AS total
       FROM fournisseurs f
       LEFT JOIN depenses d ON d.fournisseur_id = f.id
         AND EXTRACT(YEAR FROM d.date_depense) = $2 AND d.statut != 'annulee'
       WHERE f.entreprise_id = $1 AND f.archived_at IS NULL
       GROUP BY f.id ORDER BY total DESC LIMIT 10`,
      [eid, annee]
    );

    // Échéancier : factures non payées avec échéance
    const echeances = await pool.query(
      `SELECT d.id, d.numero, d.description, d.date_depense, d.date_echeance, d.montant_ttc,
              d.statut, f.nom AS fournisseur_nom,
              CASE WHEN d.date_echeance < CURRENT_DATE THEN 'retard'
                   WHEN d.date_echeance <= CURRENT_DATE + INTERVAL '7 days' THEN 'urgent'
                   WHEN d.date_echeance <= CURRENT_DATE + INTERVAL '30 days' THEN 'proche'
                   ELSE 'futur' END AS urgence
       FROM depenses d
       LEFT JOIN fournisseurs f ON f.id = d.fournisseur_id
       WHERE d.entreprise_id = $1 AND d.statut IN ('en_attente','en_retard')
         AND d.date_echeance IS NOT NULL
       ORDER BY d.date_echeance ASC LIMIT 30`,
      [eid]
    );

    res.json({
      success: true,
      data: {
        annee, ...synth.rows[0],
        encours_total: parseFloat(synth.rows[0].encours_total),
        top_fournisseurs: top.rows,
        echeancier: echeances.rows,
      },
    });
  } catch (err) {
    console.error('Erreur getStatsFournisseurs:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

module.exports = {
  fournisseurRules,
  getFournisseurs, getFournisseurById,
  createFournisseur, updateFournisseur, archiveFournisseur,
  getStatsFournisseurs,
};
