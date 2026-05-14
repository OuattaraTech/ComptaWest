const pool = require('../../config/database');
const path = require('path');
const pdfmake = require('pdfmake');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { calculerBulletin, calculerParts, PARAMS_CI } = require('../utils/paie-ci');
const { controlerSoldeAvantSortie, SoldeInsuffisantError } = require('./tresorerieController');

// ─── Init pdfmake (réutilise les fontes Roboto déjà embarquées) ───────────
const pdfmakeDir = path.dirname(require.resolve('pdfmake/package.json'));
pdfmake.addFonts({
  Roboto: {
    normal:      path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Regular.ttf'),
    bold:        path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Medium.ttf'),
    italics:     path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Italic.ttf'),
    bolditalics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-MediumItalic.ttf'),
  },
});

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const fmtMontant = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ─── Validations ──────────────────────────────────────────────────────────
const employeRules = [
  body('nom').trim().notEmpty().withMessage('Nom requis').isLength({ max: 120 }),
  body('matricule').trim().notEmpty().withMessage('Matricule requis').isLength({ max: 30 }),
  body('date_embauche').isISO8601().withMessage('Date d\'embauche invalide'),
  body('salaire_base').isFloat({ min: 0 }).withMessage('Salaire de base invalide'),
  body('type_contrat').optional().isIn(['CDI', 'CDD', 'stage', 'prestation', 'apprentissage']),
];

const rubriqueRules = [
  body('code').trim().notEmpty().withMessage('Code requis').isLength({ max: 20 }).withMessage('Code trop long'),
  body('libelle').trim().notEmpty().withMessage('Libellé requis').isLength({ max: 120 }).withMessage('Libellé trop long'),
  body('type').isIn(['gain', 'retenue', 'cotisation_salariale', 'cotisation_patronale', 'info']).withMessage('Type de rubrique invalide'),
  body('nature').optional().isIn(['fixe', 'variable', 'pourcentage', 'formule']).withMessage('Nature invalide'),
  body('valeur_defaut').optional({ nullable: true, checkFalsy: true }).isFloat().withMessage('Valeur par défaut invalide'),
];

const bulletinRules = [
  body('employe_id').isUUID().withMessage('Employé invalide'),
  body('annee').isInt({ min: 2000, max: 2100 }).withMessage('Année invalide'),
  body('mois').isInt({ min: 1, max: 12 }).withMessage('Mois invalide'),
  body('jours_travailles').optional().isFloat({ min: 0, max: 31 }).withMessage('Jours travaillés invalides'),
];

// ─── EMPLOYÉS ─────────────────────────────────────────────────────────────

// GET /api/paie/employes
const getEmployes = async (req, res) => {
  try {
    const { search, actif = 'true', page = 1, limit = 30 } = req.query;
    const eid = req.entrepriseId;
    const actifBool = actif !== 'false';
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let query = `
      SELECT e.*, ct.nom AS compte_tresorerie_nom
      FROM employes e
      LEFT JOIN comptes_tresorerie ct ON ct.id = e.compte_tresorerie_id
      WHERE e.entreprise_id = $1 AND e.archived_at IS NULL AND e.actif = $2
    `;
    const params = [eid, actifBool];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (e.nom ILIKE $${params.length} OR e.prenoms ILIKE $${params.length} OR e.matricule ILIKE $${params.length} OR e.poste ILIKE $${params.length})`;
    }

    const countParams = [eid, actifBool];
    let countQuery = `SELECT COUNT(*) FROM employes WHERE entreprise_id = $1 AND archived_at IS NULL AND actif = $2`;
    if (search && search.trim()) {
      countParams.push(`%${search.trim()}%`);
      countQuery += ` AND (nom ILIKE $${countParams.length} OR prenoms ILIKE $${countParams.length} OR matricule ILIKE $${countParams.length} OR poste ILIKE $${countParams.length})`;
    }
    const countRes = await pool.query(countQuery, countParams);

    query += ` ORDER BY e.nom, e.prenoms LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page), limit: parseInt(limit),
        pages: Math.ceil(countRes.rows[0].count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Erreur getEmployes:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/paie/employes/:id
const getEmployeById = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const emp = await pool.query(
      `SELECT e.*, ct.nom AS compte_tresorerie_nom
       FROM employes e
       LEFT JOIN comptes_tresorerie ct ON ct.id = e.compte_tresorerie_id
       WHERE e.id = $1 AND e.entreprise_id = $2`,
      [id, eid]
    );
    if (!emp.rows[0]) return res.status(404).json({ success: false, message: 'Employé introuvable' });

    // Derniers bulletins
    const bulletins = await pool.query(
      `SELECT id, annee, mois, brut_total, net_a_payer, statut, date_paiement
       FROM bulletins_paie WHERE employe_id = $1 ORDER BY annee DESC, mois DESC LIMIT 12`,
      [id]
    );

    res.json({
      success: true,
      data: { ...emp.rows[0], bulletins: bulletins.rows },
    });
  } catch (err) {
    console.error('Erreur getEmployeById:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/paie/employes
const createEmploye = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const b = req.body;

    // Vérifier unicité du matricule
    const dup = await pool.query(
      `SELECT id FROM employes WHERE entreprise_id = $1 AND matricule = $2`,
      [eid, b.matricule]
    );
    if (dup.rows[0]) {
      return res.status(400).json({ success: false, message: 'Matricule déjà utilisé' });
    }

    const result = await pool.query(
      `INSERT INTO employes (
        entreprise_id, matricule, civilite, nom, prenoms, date_naissance, lieu_naissance,
        sexe, nationalite, situation_matrimoniale, nb_conjoints, nb_enfants_charge, cni,
        adresse, telephone, email, poste, departement, date_embauche, type_contrat,
        date_fin_contrat, convention_collective, categorie_professionnelle,
        salaire_base, mode_paiement, compte_tresorerie_id, banque, rib, numero_mobile_money,
        numero_cnps, numero_cmu, taux_at_personnel, cree_par
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
      RETURNING *`,
      [
        eid, b.matricule, b.civilite || null, b.nom, b.prenoms || null,
        b.date_naissance || null, b.lieu_naissance || null, b.sexe || null,
        b.nationalite || 'Ivoirienne', b.situation_matrimoniale || 'celibataire',
        parseInt(b.nb_conjoints) || 0, parseInt(b.nb_enfants_charge) || 0, b.cni || null,
        b.adresse || null, b.telephone || null, b.email || null,
        b.poste || null, b.departement || null, b.date_embauche, b.type_contrat || 'CDI',
        b.date_fin_contrat || null, b.convention_collective || null, b.categorie_professionnelle || null,
        round2(b.salaire_base), b.mode_paiement || 'virement', b.compte_tresorerie_id || null,
        b.banque || null, b.rib || null, b.numero_mobile_money || null,
        b.numero_cnps || null, b.numero_cmu || null,
        b.taux_at_personnel ? round2(b.taux_at_personnel) : null,
        req.user?.id,
      ]
    );

    logAudit(req, 'CREATE', 'employes', result.rows[0].id, { matricule: b.matricule, nom: b.nom });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur createEmploye:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création employé' });
  }
};

// PUT /api/paie/employes/:id
const updateEmploye = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const b = req.body;

    const existing = await pool.query(
      `SELECT * FROM employes WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'Employé introuvable' });

    const r = await pool.query(
      `UPDATE employes SET
        civilite = COALESCE($1, civilite),
        nom = COALESCE($2, nom),
        prenoms = COALESCE($3, prenoms),
        date_naissance = COALESCE($4, date_naissance),
        lieu_naissance = COALESCE($5, lieu_naissance),
        sexe = COALESCE($6, sexe),
        nationalite = COALESCE($7, nationalite),
        situation_matrimoniale = COALESCE($8, situation_matrimoniale),
        nb_conjoints = COALESCE($9, nb_conjoints),
        nb_enfants_charge = COALESCE($10, nb_enfants_charge),
        cni = COALESCE($11, cni),
        adresse = COALESCE($12, adresse),
        telephone = COALESCE($13, telephone),
        email = COALESCE($14, email),
        poste = COALESCE($15, poste),
        departement = COALESCE($16, departement),
        type_contrat = COALESCE($17, type_contrat),
        date_fin_contrat = $18,
        categorie_professionnelle = COALESCE($19, categorie_professionnelle),
        salaire_base = COALESCE($20, salaire_base),
        mode_paiement = COALESCE($21, mode_paiement),
        compte_tresorerie_id = $22,
        banque = COALESCE($23, banque),
        rib = COALESCE($24, rib),
        numero_mobile_money = COALESCE($25, numero_mobile_money),
        numero_cnps = COALESCE($26, numero_cnps),
        numero_cmu = COALESCE($27, numero_cmu),
        taux_at_personnel = COALESCE($28, taux_at_personnel),
        actif = COALESCE($29, actif),
        date_depart = $30,
        motif_depart = COALESCE($31, motif_depart),
        updated_at = NOW()
       WHERE id = $32 AND entreprise_id = $33 RETURNING *`,
      [
        b.civilite, b.nom, b.prenoms, b.date_naissance, b.lieu_naissance,
        b.sexe, b.nationalite, b.situation_matrimoniale,
        b.nb_conjoints !== undefined ? parseInt(b.nb_conjoints) : null,
        b.nb_enfants_charge !== undefined ? parseInt(b.nb_enfants_charge) : null,
        b.cni, b.adresse, b.telephone, b.email,
        b.poste, b.departement, b.type_contrat, b.date_fin_contrat || null,
        b.categorie_professionnelle,
        b.salaire_base !== undefined ? round2(b.salaire_base) : null,
        b.mode_paiement, b.compte_tresorerie_id || null, b.banque, b.rib,
        b.numero_mobile_money, b.numero_cnps, b.numero_cmu,
        b.taux_at_personnel !== undefined ? round2(b.taux_at_personnel) : null,
        b.actif, b.date_depart || null, b.motif_depart,
        id, eid,
      ]
    );

    logAudit(req, 'UPDATE', 'employes', id, { nom: r.rows[0].nom });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur updateEmploye:', err.message);
    res.status(500).json({ success: false, message: 'Erreur mise à jour' });
  }
};

// DELETE /api/paie/employes/:id  (archivage)
const archiveEmploye = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `UPDATE employes SET archived_at = NOW(), actif = FALSE
       WHERE id = $1 AND entreprise_id = $2 RETURNING id`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Employé introuvable' });
    logAudit(req, 'DELETE', 'employes', id);
    res.json({ success: true, message: 'Employé archivé' });
  } catch (err) {
    console.error('Erreur archiveEmploye:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── RUBRIQUES ────────────────────────────────────────────────────────────

const getRubriques = async (req, res) => {
  try {
    const { actif = 'true' } = req.query;
    const eid = req.entrepriseId;
    const result = await pool.query(
      `SELECT * FROM rubriques_paie WHERE entreprise_id = $1
       ${actif !== 'false' ? 'AND actif = TRUE' : ''}
       ORDER BY ordre, libelle`,
      [eid]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getRubriques:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const createRubrique = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const b = req.body;
    if (!b.code || !b.libelle || !b.type) {
      return res.status(400).json({ success: false, message: 'Code, libellé et type requis' });
    }

    const r = await pool.query(
      `INSERT INTO rubriques_paie
        (entreprise_id, code, libelle, type, imposable_its, cotisable_cnps, nature,
         valeur_defaut, base_calcul, compte_pc_numero, ordre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [eid, b.code, b.libelle, b.type,
       b.imposable_its !== false, b.cotisable_cnps !== false,
       b.nature || 'fixe', round2(b.valeur_defaut || 0),
       b.base_calcul || null, b.compte_pc_numero || null, b.ordre || 100]
    );

    logAudit(req, 'CREATE', 'rubriques_paie', r.rows[0].id, { code: b.code });
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Code déjà utilisé' });
    }
    console.error('Erreur createRubrique:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création' });
  }
};

const updateRubrique = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const b = req.body;
    const r = await pool.query(
      `UPDATE rubriques_paie SET
        libelle = COALESCE($1, libelle),
        imposable_its = COALESCE($2, imposable_its),
        cotisable_cnps = COALESCE($3, cotisable_cnps),
        nature = COALESCE($4, nature),
        valeur_defaut = COALESCE($5, valeur_defaut),
        base_calcul = $6,
        compte_pc_numero = $7,
        ordre = COALESCE($8, ordre),
        actif = COALESCE($9, actif)
       WHERE id = $10 AND entreprise_id = $11 RETURNING *`,
      [b.libelle, b.imposable_its, b.cotisable_cnps, b.nature,
       b.valeur_defaut !== undefined ? round2(b.valeur_defaut) : null,
       b.base_calcul || null, b.compte_pc_numero || null,
       b.ordre, b.actif, id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Rubrique introuvable' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur updateRubrique:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

const deleteRubrique = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    // Ne pas supprimer les rubriques système
    const r = await pool.query(
      `DELETE FROM rubriques_paie
       WHERE id = $1 AND entreprise_id = $2 AND systeme = FALSE RETURNING id`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Rubrique introuvable ou système (non supprimable)' });
    res.json({ success: true, message: 'Supprimée' });
  } catch (err) {
    console.error('Erreur deleteRubrique:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── BULLETINS ────────────────────────────────────────────────────────────

// GET /api/paie/bulletins
const getBulletins = async (req, res) => {
  try {
    const { annee, mois, employe_id, statut, page = 1, limit = 30 } = req.query;
    const eid = req.entrepriseId;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let query = `
      SELECT b.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule
      FROM bulletins_paie b
      LEFT JOIN employes e ON e.id = b.employe_id
      WHERE b.entreprise_id = $1
    `;
    const params = [eid];
    if (annee)      { params.push(parseInt(annee));    query += ` AND b.annee = $${params.length}`; }
    if (mois)       { params.push(parseInt(mois));     query += ` AND b.mois = $${params.length}`; }
    if (employe_id) { params.push(employe_id);          query += ` AND b.employe_id = $${params.length}`; }
    if (statut)     { params.push(statut);              query += ` AND b.statut = $${params.length}`; }

    const countQuery = query.replace(/SELECT.*?FROM/s, 'SELECT COUNT(*) FROM');
    const countRes = await pool.query(countQuery, params);

    params.push(parseInt(limit), offset);
    query += ` ORDER BY b.annee DESC, b.mois DESC, e.nom
               LIMIT $${params.length - 1} OFFSET $${params.length}`;

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
    console.error('Erreur getBulletins:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/paie/bulletins/:id
const getBulletinById = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const bul = await pool.query(
      `SELECT b.*, e.matricule, e.nom AS e_nom, e.prenoms, e.poste, e.numero_cnps,
              e.date_embauche, e.salaire_base AS e_salaire_base, e.nb_enfants_charge,
              e.situation_matrimoniale, e.nb_conjoints
       FROM bulletins_paie b
       JOIN employes e ON e.id = b.employe_id
       WHERE b.id = $1 AND b.entreprise_id = $2`,
      [id, eid]
    );
    if (!bul.rows[0]) return res.status(404).json({ success: false, message: 'Bulletin introuvable' });

    const lignes = await pool.query(
      `SELECT * FROM lignes_bulletin WHERE bulletin_id = $1 ORDER BY ordre`,
      [id]
    );

    res.json({ success: true, data: { ...bul.rows[0], lignes: lignes.rows } });
  } catch (err) {
    console.error('Erreur getBulletinById:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Helper : enregistre les lignes d'un bulletin (delete + re-insert)
 */
const enregistrerLignes = async (client, bulletinId, lignes) => {
  await client.query(`DELETE FROM lignes_bulletin WHERE bulletin_id = $1`, [bulletinId]);
  for (const l of lignes) {
    await client.query(
      `INSERT INTO lignes_bulletin
        (bulletin_id, code, libelle, type, base, taux, montant, est_patronale, ordre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [bulletinId, l.code, l.libelle, l.type, l.base, l.taux, l.montant, l.est_patronale, l.ordre]
    );
  }
};

// POST /api/paie/bulletins  (création ou mise à jour brouillon)
// Body : { employe_id, annee, mois, rubriques: [{code, montant}] }
const creerOuMajBulletin = async (req, res) => {
  const client = await pool.connect();
  try {
    const eid = req.entrepriseId;
    const { employe_id, annee, mois, rubriques = [], notes, jours_travailles = 30 } = req.body;

    if (!employe_id || !annee || !mois) {
      return res.status(400).json({ success: false, message: 'employe_id, annee, mois requis' });
    }

    await client.query('BEGIN');

    // Charge l'employé
    const empRes = await client.query(
      `SELECT * FROM employes WHERE id = $1 AND entreprise_id = $2`,
      [employe_id, eid]
    );
    if (!empRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Employé introuvable' });
    }
    const employe = empRes.rows[0];

    // Charge le catalogue de rubriques pour enrichir les données
    const rubRes = await client.query(
      `SELECT * FROM rubriques_paie WHERE entreprise_id = $1`,
      [eid]
    );
    const catalogue = Object.fromEntries(rubRes.rows.map(r => [r.code, r]));

    // Prépare la liste de rubriques pour le moteur de calcul
    const rubriquesPourCalcul = rubriques
      .filter(r => r.code !== 'SALAIRE_BASE')  // le salaire de base vient de l'employé
      .map(r => {
        const def = catalogue[r.code];
        if (!def) return null;
        return {
          code: r.code,
          libelle: def.libelle,
          type: def.type,
          imposable_its: def.imposable_its,
          cotisable_cnps: def.cotisable_cnps,
          montant: round2(r.montant),
          ordre: def.ordre,
        };
      })
      .filter(Boolean);

    // Calcul
    const calc = calculerBulletin({
      employe: {
        salaire_base: employe.salaire_base,
        situation_matrimoniale: employe.situation_matrimoniale,
        nb_conjoints: employe.nb_conjoints,
        nb_enfants_charge: employe.nb_enfants_charge,
        taux_at_personnel: employe.taux_at_personnel,
      },
      rubriques: rubriquesPourCalcul,
      parametres_entreprise: {},
    });

    // Vérifie si un bulletin existe déjà pour ce mois → mise à jour
    const existant = await client.query(
      `SELECT id, statut FROM bulletins_paie
       WHERE entreprise_id = $1 AND employe_id = $2 AND annee = $3 AND mois = $4`,
      [eid, employe_id, annee, mois]
    );

    if (existant.rows[0] && existant.rows[0].statut !== 'brouillon') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Le bulletin de ${employe.nom} pour ${mois}/${annee} est déjà ${existant.rows[0].statut}`,
      });
    }

    const periodeDebut = `${annee}-${String(mois).padStart(2,'0')}-01`;
    // dernier jour du mois
    const dernierJour = new Date(annee, mois, 0).getDate();
    const periodeFin = `${annee}-${String(mois).padStart(2,'0')}-${dernierJour}`;

    let bulletinId;
    if (existant.rows[0]) {
      bulletinId = existant.rows[0].id;
      await client.query(
        `UPDATE bulletins_paie SET
          periode_debut=$1, periode_fin=$2, jours_travailles=$3,
          matricule=$4, nom_complet=$5, poste=$6, salaire_base=$7, nb_parts=$8,
          brut_total=$9, total_cotisations_salariales=$10, salaire_imposable=$11,
          total_impots=$12, total_retenues=$13, total_gains=$14, net_a_payer=$15,
          total_cotisations_patronales=$16, cout_total_employeur=$17,
          notes=$18, updated_at=NOW()
         WHERE id=$19`,
        [periodeDebut, periodeFin, jours_travailles,
         employe.matricule, `${employe.nom} ${employe.prenoms || ''}`.trim(), employe.poste,
         employe.salaire_base, calc.nb_parts,
         calc.brut_total, calc.total_cotisations_salariales, calc.salaire_imposable,
         calc.total_impots, calc.total_retenues, calc.total_gains, calc.net_a_payer,
         calc.total_cotisations_patronales, calc.cout_total_employeur,
         notes || null, bulletinId]
      );
    } else {
      const newRes = await client.query(
        `INSERT INTO bulletins_paie (
          entreprise_id, employe_id, annee, mois, periode_debut, periode_fin, jours_travailles,
          matricule, nom_complet, poste, salaire_base, nb_parts,
          brut_total, total_cotisations_salariales, salaire_imposable,
          total_impots, total_retenues, total_gains, net_a_payer,
          total_cotisations_patronales, cout_total_employeur,
          notes, statut, cree_par
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'brouillon',$23) RETURNING id`,
        [eid, employe_id, annee, mois, periodeDebut, periodeFin, jours_travailles,
         employe.matricule, `${employe.nom} ${employe.prenoms || ''}`.trim(), employe.poste,
         employe.salaire_base, calc.nb_parts,
         calc.brut_total, calc.total_cotisations_salariales, calc.salaire_imposable,
         calc.total_impots, calc.total_retenues, calc.total_gains, calc.net_a_payer,
         calc.total_cotisations_patronales, calc.cout_total_employeur,
         notes || null, req.user?.id]
      );
      bulletinId = newRes.rows[0].id;
    }

    // Enregistre les lignes (mapping rubrique_id depuis catalogue)
    const lignesPourBdd = calc.lignes.map(l => ({
      ...l,
      rubrique_id: catalogue[l.code]?.id || null,
    }));
    await enregistrerLignes(client, bulletinId, lignesPourBdd);

    await client.query('COMMIT');

    logAudit(req, existant.rows[0] ? 'UPDATE' : 'CREATE', 'bulletins_paie', bulletinId,
      { employe: employe.matricule, annee, mois, net: calc.net_a_payer });

    res.status(existant.rows[0] ? 200 : 201).json({
      success: true,
      data: { id: bulletinId, ...calc },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur creerOuMajBulletin:', err.message);
    res.status(500).json({ success: false, message: 'Erreur enregistrement bulletin' });
  } finally {
    client.release();
  }
};

// POST /api/paie/bulletins/generer-mois  (génération en masse)
const genererMois = async (req, res) => {
  const client = await pool.connect();
  try {
    const eid = req.entrepriseId;
    const { annee, mois } = req.body;
    if (!annee || !mois) {
      return res.status(400).json({ success: false, message: 'annee et mois requis' });
    }

    // Tous les employés actifs
    const emps = await pool.query(
      `SELECT * FROM employes WHERE entreprise_id = $1 AND actif = TRUE AND archived_at IS NULL
       AND (date_fin_contrat IS NULL OR date_fin_contrat >= $2)`,
      [eid, `${annee}-${String(mois).padStart(2,'0')}-01`]
    );

    // Catalogue
    const rubRes = await pool.query(`SELECT * FROM rubriques_paie WHERE entreprise_id = $1`, [eid]);
    const catalogue = Object.fromEntries(rubRes.rows.map(r => [r.code, r]));

    let crees = 0, mis_a_jour = 0, ignores = 0;
    const erreurs = [];

    await client.query('BEGIN');

    for (const employe of emps.rows) {
      try {
        // Bulletin déjà payé ou validé → on saute
        const existant = await client.query(
          `SELECT id, statut FROM bulletins_paie
           WHERE entreprise_id = $1 AND employe_id = $2 AND annee = $3 AND mois = $4`,
          [eid, employe.id, annee, mois]
        );
        if (existant.rows[0] && existant.rows[0].statut !== 'brouillon') {
          ignores++;
          continue;
        }

        const calc = calculerBulletin({
          employe: {
            salaire_base: employe.salaire_base,
            situation_matrimoniale: employe.situation_matrimoniale,
            nb_conjoints: employe.nb_conjoints,
            nb_enfants_charge: employe.nb_enfants_charge,
            taux_at_personnel: employe.taux_at_personnel,
          },
          rubriques: [],  // génération en masse = sans primes, brouillon ajustable ensuite
        });

        const periodeDebut = `${annee}-${String(mois).padStart(2,'0')}-01`;
        const dernierJour = new Date(annee, mois, 0).getDate();
        const periodeFin = `${annee}-${String(mois).padStart(2,'0')}-${dernierJour}`;

        let bulletinId;
        if (existant.rows[0]) {
          bulletinId = existant.rows[0].id;
          await client.query(
            `UPDATE bulletins_paie SET
              periode_debut=$1, periode_fin=$2,
              matricule=$3, nom_complet=$4, poste=$5, salaire_base=$6, nb_parts=$7,
              brut_total=$8, total_cotisations_salariales=$9, salaire_imposable=$10,
              total_impots=$11, total_retenues=$12, total_gains=$13, net_a_payer=$14,
              total_cotisations_patronales=$15, cout_total_employeur=$16,
              updated_at=NOW()
             WHERE id=$17`,
            [periodeDebut, periodeFin,
             employe.matricule, `${employe.nom} ${employe.prenoms || ''}`.trim(), employe.poste,
             employe.salaire_base, calc.nb_parts,
             calc.brut_total, calc.total_cotisations_salariales, calc.salaire_imposable,
             calc.total_impots, calc.total_retenues, calc.total_gains, calc.net_a_payer,
             calc.total_cotisations_patronales, calc.cout_total_employeur, bulletinId]
          );
          mis_a_jour++;
        } else {
          const newRes = await client.query(
            `INSERT INTO bulletins_paie (
              entreprise_id, employe_id, annee, mois, periode_debut, periode_fin, jours_travailles,
              matricule, nom_complet, poste, salaire_base, nb_parts,
              brut_total, total_cotisations_salariales, salaire_imposable,
              total_impots, total_retenues, total_gains, net_a_payer,
              total_cotisations_patronales, cout_total_employeur,
              statut, cree_par
            ) VALUES ($1,$2,$3,$4,$5,$6,30,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'brouillon',$21) RETURNING id`,
            [eid, employe.id, annee, mois, periodeDebut, periodeFin,
             employe.matricule, `${employe.nom} ${employe.prenoms || ''}`.trim(), employe.poste,
             employe.salaire_base, calc.nb_parts,
             calc.brut_total, calc.total_cotisations_salariales, calc.salaire_imposable,
             calc.total_impots, calc.total_retenues, calc.total_gains, calc.net_a_payer,
             calc.total_cotisations_patronales, calc.cout_total_employeur, req.user?.id]
          );
          bulletinId = newRes.rows[0].id;
          crees++;
        }

        const lignesPourBdd = calc.lignes.map(l => ({ ...l, rubrique_id: catalogue[l.code]?.id || null }));
        await enregistrerLignes(client, bulletinId, lignesPourBdd);
      } catch (err) {
        erreurs.push({ employe: employe.matricule, erreur: err.message });
      }
    }

    await client.query('COMMIT');
    logAudit(req, 'BULK_CREATE', 'bulletins_paie', null,
      { annee, mois, crees, mis_a_jour, ignores, erreurs: erreurs.length });

    res.json({
      success: true,
      data: { crees, mis_a_jour, ignores, total_employes: emps.rows.length, erreurs },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur genererMois:', err.message);
    res.status(500).json({ success: false, message: 'Erreur génération' });
  } finally {
    client.release();
  }
};

// POST /api/paie/bulletins/:id/valider
const validerBulletin = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `UPDATE bulletins_paie SET statut='valide', date_validation=NOW(), valide_par=$1
       WHERE id=$2 AND entreprise_id=$3 AND statut='brouillon' RETURNING *`,
      [req.user?.id, id, eid]
    );
    if (!r.rows[0]) return res.status(400).json({ success: false, message: 'Bulletin non modifiable' });
    logAudit(req, 'VALIDATE', 'bulletins_paie', id);
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur validerBulletin:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// POST /api/paie/bulletins/:id/payer
const payerBulletin = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const { date_paiement, compte_tresorerie_id } = req.body;

    await client.query('BEGIN');

    const bulRes = await client.query(
      `SELECT * FROM bulletins_paie WHERE id = $1 AND entreprise_id = $2 FOR UPDATE`,
      [id, eid]
    );
    if (!bulRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Bulletin introuvable' });
    }
    const bul = bulRes.rows[0];
    if (bul.statut === 'paye') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Bulletin déjà payé' });
    }
    if (bul.statut !== 'valide') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Validez le bulletin d\'abord' });
    }

    // Résolution du compte de trésorerie
    let compteId = compte_tresorerie_id;
    if (!compteId) {
      // Tente le compte de l'employé, sinon le compte par défaut bancaire
      const empRes = await client.query(`SELECT compte_tresorerie_id, mode_paiement FROM employes WHERE id = $1`, [bul.employe_id]);
      compteId = empRes.rows[0]?.compte_tresorerie_id || null;
      if (!compteId) {
        const ct = await client.query(
          `SELECT id FROM comptes_tresorerie
           WHERE entreprise_id = $1 AND par_defaut = TRUE AND archived_at IS NULL
           ORDER BY (type='banque') DESC LIMIT 1`,
          [eid]
        );
        compteId = ct.rows[0]?.id;
      }
    }
    if (!compteId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Aucun compte de trésorerie disponible' });
    }

    const dateP = date_paiement || new Date().toISOString().split('T')[0];

    // Contrôle du solde du compte de trésorerie avant le décaissement
    await controlerSoldeAvantSortie(client, compteId, bul.net_a_payer);

    // Création du mouvement de trésorerie
    const mvtRes = await client.query(
      `INSERT INTO mouvements_tresorerie
        (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, source_id, cree_par)
       VALUES ($1,$2,$3,'sortie',$4,$5,$6,'paiement_salaire',$7,$8) RETURNING id`,
      [eid, compteId, dateP, bul.net_a_payer,
       `Salaire ${bul.nom_complet} - ${bul.mois}/${bul.annee}`,
       `BULL-${bul.matricule}-${bul.annee}${String(bul.mois).padStart(2,'0')}`,
       id, req.user?.id]
    );

    await client.query(
      `UPDATE bulletins_paie SET
        statut='paye', date_paiement=$1, compte_tresorerie_id=$2, mouvement_tresorerie_id=$3
       WHERE id=$4`,
      [dateP, compteId, mvtRes.rows[0].id, id]
    );

    await client.query('COMMIT');
    logAudit(req, 'PAY', 'bulletins_paie', id, { net: bul.net_a_payer, compte_tresorerie_id: compteId });
    res.json({ success: true, data: { id, statut: 'paye', mouvement_id: mvtRes.rows[0].id } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof SoldeInsuffisantError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code, details: err.details });
    }
    console.error('Erreur payerBulletin:', err.message);
    res.status(500).json({ success: false, message: 'Erreur paiement bulletin' });
  } finally {
    client.release();
  }
};

// DELETE /api/paie/bulletins/:id  (brouillons uniquement)
const supprimerBulletin = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `DELETE FROM bulletins_paie WHERE id = $1 AND entreprise_id = $2 AND statut = 'brouillon' RETURNING id`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(400).json({ success: false, message: 'Bulletin non supprimable (validé ou payé)' });
    logAudit(req, 'DELETE', 'bulletins_paie', id);
    res.json({ success: true, message: 'Supprimé' });
  } catch (err) {
    console.error('Erreur supprimerBulletin:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// GET /api/paie/bulletins/:id/pdf
const getBulletinPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const bulRes = await pool.query(
      `SELECT b.*, e.matricule, e.nom AS e_nom, e.prenoms AS e_prenoms, e.poste, e.numero_cnps,
              e.date_embauche, e.situation_matrimoniale, e.nb_enfants_charge, e.categorie_professionnelle
       FROM bulletins_paie b
       JOIN employes e ON e.id = b.employe_id
       WHERE b.id = $1 AND b.entreprise_id = $2`,
      [id, eid]
    );
    if (!bulRes.rows[0]) return res.status(404).json({ success: false, message: 'Bulletin introuvable' });
    const b = bulRes.rows[0];

    const entRes = await pool.query(`SELECT * FROM entreprises WHERE id=$1`, [eid]);
    const ent = entRes.rows[0] || {};

    const lignesRes = await pool.query(
      `SELECT * FROM lignes_bulletin WHERE bulletin_id = $1 ORDER BY ordre`,
      [id]
    );
    const lignes = lignesRes.rows;

    const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc',
                  'Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const periodeLibelle = `${MOIS[11 + b.mois]} ${b.annee}`;

    const gains = lignes.filter(l => l.type === 'gain');
    const cotisationsSal = lignes.filter(l => l.type === 'cotisation_salariale');
    const cotisationsPat = lignes.filter(l => l.type === 'cotisation_patronale');
    const retenues = lignes.filter(l => l.type === 'retenue');

    const VERT = '#00A882';
    const NOIR = '#0B0F1A';
    const GRIS = '#6B7A99';
    const GRIS_CLAIR = '#F5F7FA';
    const BORDURE = '#D1DBE8';
    const ROUGE = '#C01833';

    const cellG  = (txt, opts = {}) => ({ text: txt, fontSize: 9, margin: [4,3,4,3], ...opts });
    const cellR  = (txt) => cellG(txt, { alignment: 'right' });
    const head   = (txt) => cellG(txt, { color: 'white', bold: true });

    // Tableau principal
    const lignesTableau = [
      [head('Rubrique'), head('Base'), head('Taux'), head('Gain'), head('Retenue')],
    ];
    for (const l of gains) {
      lignesTableau.push([
        cellG(l.libelle),
        cellR(l.base ? fmtMontant(l.base) : ''),
        cellR(l.taux ? `${l.taux}%` : ''),
        cellR(fmtMontant(l.montant)),
        cellG(''),
      ]);
    }
    lignesTableau.push([
      cellG('Brut total', { bold: true }), cellG(''), cellG(''),
      cellR(fmtMontant(b.brut_total)).bold = true, cellG('')
    ]);
    lignesTableau[lignesTableau.length - 1][3] = cellR(fmtMontant(b.brut_total)); // recoder proprement
    lignesTableau[lignesTableau.length - 1][3].bold = true;
    lignesTableau[lignesTableau.length - 1][3].fillColor = GRIS_CLAIR;
    lignesTableau[lignesTableau.length - 1][0].fillColor = GRIS_CLAIR;
    lignesTableau[lignesTableau.length - 1][0].bold = true;

    for (const l of cotisationsSal) {
      lignesTableau.push([
        cellG(l.libelle),
        cellR(l.base ? fmtMontant(l.base) : ''),
        cellR(l.taux ? `${l.taux}%` : ''),
        cellG(''),
        cellR(fmtMontant(l.montant)),
      ]);
    }
    for (const l of retenues) {
      lignesTableau.push([
        cellG(l.libelle), cellG(''), cellG(''), cellG(''),
        cellR(fmtMontant(l.montant)),
      ]);
    }
    const totalRetenues = parseFloat(b.total_cotisations_salariales) + parseFloat(b.total_impots) + parseFloat(b.total_retenues);
    const ligneTotalRet = [
      cellG('Total retenues', { bold: true, fillColor: GRIS_CLAIR }),
      cellG(''), cellG(''), cellG(''),
      cellR(fmtMontant(totalRetenues)),
    ];
    ligneTotalRet[4].bold = true; ligneTotalRet[4].fillColor = GRIS_CLAIR;
    lignesTableau.push(ligneTotalRet);

    // Tableau cotisations patronales (informatif)
    const tablePat = [
      [head('Charges patronales (à titre informatif)'), head('Base'), head('Taux'), head('Montant')],
    ];
    for (const l of cotisationsPat) {
      tablePat.push([
        cellG(l.libelle),
        cellR(l.base ? fmtMontant(l.base) : ''),
        cellR(l.taux ? `${l.taux}%` : ''),
        cellR(fmtMontant(l.montant)),
      ]);
    }
    tablePat.push([
      cellG('Total charges patronales', { bold: true, fillColor: GRIS_CLAIR }),
      cellG(''), cellG(''),
      Object.assign(cellR(fmtMontant(b.total_cotisations_patronales)), { bold: true, fillColor: GRIS_CLAIR }),
    ]);

    const docDef = {
      pageSize: 'A4',
      pageMargins: [40, 35, 40, 60],
      content: [
        // En-tête
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: ent.nom || 'Entreprise', fontSize: 13, bold: true, color: NOIR },
                { text: [
                  ent.adresse, ent.ville, ent.pays,
                ].filter(Boolean).join(' · '), fontSize: 8, color: GRIS },
                { text: [
                  ent.rccm ? `RCCM ${ent.rccm}` : null,
                  ent.ninea ? `NINEA ${ent.ninea}` : null,
                ].filter(Boolean).join(' · '), fontSize: 8, color: GRIS },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'BULLETIN DE PAIE', fontSize: 13, bold: true, color: VERT, alignment: 'right' },
                { text: periodeLibelle, fontSize: 10, alignment: 'right', color: NOIR, bold: true },
              ],
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: VERT }], margin: [0, 10, 0, 14] },

        // Bloc identité employé
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                {
                  stack: [
                    { text: 'EMPLOYÉ', fontSize: 8, color: GRIS, bold: true, margin: [0,0,0,4] },
                    { text: `${b.e_nom || ''} ${b.e_prenoms || ''}`.trim(), fontSize: 12, bold: true, color: NOIR },
                    { text: b.poste || '', fontSize: 9, color: GRIS, margin: [0,2,0,0] },
                    { text: `Matricule : ${b.matricule}`, fontSize: 8, color: NOIR, margin: [0,3,0,0] },
                    b.numero_cnps ? { text: `N° CNPS : ${b.numero_cnps}`, fontSize: 8, color: NOIR } : null,
                    b.date_embauche ? { text: `Embauché le : ${String(b.date_embauche).slice(0,10)}`, fontSize: 8, color: GRIS } : null,
                  ].filter(Boolean),
                  margin: [10, 8, 10, 8],
                  fillColor: GRIS_CLAIR,
                },
                {
                  stack: [
                    { text: 'PÉRIODE & STATUT', fontSize: 8, color: GRIS, bold: true, margin: [0,0,0,4] },
                    { text: `Du ${String(b.periode_debut).slice(0,10)} au ${String(b.periode_fin).slice(0,10)}`, fontSize: 9, color: NOIR },
                    { text: `Jours travaillés : ${b.jours_travailles}`, fontSize: 9, color: NOIR },
                    { text: `Parts fiscales : ${b.nb_parts}`, fontSize: 9, color: NOIR },
                    { text: `Statut : ${b.statut.toUpperCase()}`, fontSize: 9, color: b.statut === 'paye' ? VERT : GRIS, bold: true, margin: [0, 2, 0, 0] },
                  ],
                  margin: [10, 8, 10, 8],
                  fillColor: GRIS_CLAIR,
                },
              ],
            ],
          },
          layout: 'noBorders',
        },
        { text: '', margin: [0, 14, 0, 0] },

        // Tableau gains / retenues
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: lignesTableau,
          },
          layout: {
            fillColor: (rowIndex) => rowIndex === 0 ? VERT : null,
            hLineWidth: () => 0.5, vLineWidth: () => 0,
            hLineColor: () => BORDURE,
          },
        },
        { text: '', margin: [0, 10, 0, 0] },

        // Net à payer (encadré)
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'NET À PAYER', fontSize: 11, color: 'white', bold: true, margin: [12, 10, 12, 10] },
                { text: `${fmtMontant(b.net_a_payer)} FCFA`, fontSize: 16, color: 'white', bold: true, alignment: 'right', margin: [12, 10, 12, 10] },
              ],
            ],
          },
          layout: {
            fillColor: () => VERT,
            hLineWidth: () => 0, vLineWidth: () => 0,
          },
        },
        { text: '', margin: [0, 14, 0, 0] },

        // Tableau charges patronales
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: tablePat,
          },
          layout: {
            fillColor: (rowIndex) => rowIndex === 0 ? GRIS : null,
            hLineWidth: () => 0.5, vLineWidth: () => 0,
            hLineColor: () => BORDURE,
          },
        },
        { text: '', margin: [0, 10, 0, 0] },

        // Synthèse coût employeur
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 'auto',
              table: {
                widths: ['auto', 'auto'],
                body: [
                  [{ text: 'Coût total employeur :', fontSize: 9, alignment: 'right', color: GRIS, margin: [0, 2, 8, 2] },
                   { text: `${fmtMontant(b.cout_total_employeur)} FCFA`, fontSize: 11, alignment: 'right', bold: true, color: NOIR }],
                ],
              },
              layout: 'noBorders',
            },
          ],
        },

        { text: '', margin: [0, 16, 0, 0] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.4, lineColor: BORDURE }] },
        { text: 'Bulletin établi conformément à l\'article 31.10 du Code du travail ivoirien. Ce document doit être conservé pendant 5 ans.',
          fontSize: 7, italics: true, color: GRIS, alignment: 'center', margin: [0, 6, 0, 0] },
      ],
      footer: (currentPage, pageCount) => ({
        text: `${ent.nom || ''}  ·  Bulletin ${periodeLibelle}  ·  Page ${currentPage}/${pageCount}`,
        alignment: 'center', fontSize: 7, color: GRIS, italics: true, margin: [0, 16, 0, 0],
      }),
      defaultStyle: { font: 'Roboto', fontSize: 10, color: NOIR },
    };

    const buffer = await pdfmake.createPdf(docDef).getBuffer();
    const slug = `${b.matricule}_${b.annee}${String(b.mois).padStart(2,'0')}`.replace(/[^a-zA-Z0-9_]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Bulletin_${slug}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Erreur getBulletinPDF:', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur génération PDF' });
  }
};

// GET /api/paie/stats?annee=YYYY
const getStatsPaie = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const annee = parseInt(req.query.annee) || new Date().getFullYear();

    const effectif = await pool.query(
      `SELECT COUNT(*) FROM employes WHERE entreprise_id = $1 AND actif = TRUE AND archived_at IS NULL`,
      [eid]
    );

    const masse = await pool.query(
      `SELECT
         COALESCE(SUM(brut_total), 0) AS total_brut,
         COALESCE(SUM(net_a_payer), 0) AS total_net,
         COALESCE(SUM(total_cotisations_salariales), 0) AS total_cot_sal,
         COALESCE(SUM(total_impots), 0) AS total_impots,
         COALESCE(SUM(total_cotisations_patronales), 0) AS total_cot_pat,
         COALESCE(SUM(cout_total_employeur), 0) AS cout_total,
         COUNT(*) AS nb_bulletins
       FROM bulletins_paie WHERE entreprise_id = $1 AND annee = $2 AND statut != 'annule'`,
      [eid, annee]
    );

    const parMois = await pool.query(
      `SELECT mois,
         COALESCE(SUM(brut_total), 0) AS brut,
         COALESCE(SUM(net_a_payer), 0) AS net,
         COALESCE(SUM(cout_total_employeur), 0) AS cout
       FROM bulletins_paie
       WHERE entreprise_id = $1 AND annee = $2 AND statut != 'annule'
       GROUP BY mois ORDER BY mois`,
      [eid, annee]
    );

    res.json({
      success: true,
      data: {
        annee,
        effectif: parseInt(effectif.rows[0].count),
        ...masse.rows[0],
        par_mois: parMois.rows,
      },
    });
  } catch (err) {
    console.error('Erreur getStatsPaie:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// GET /api/paie/parametres
const getParametres = async (req, res) => {
  res.json({ success: true, data: { pays: 'CI', parametres: PARAMS_CI } });
};

module.exports = {
  // Employés
  getEmployes, getEmployeById, createEmploye, updateEmploye, archiveEmploye, employeRules,
  // Rubriques
  getRubriques, createRubrique, updateRubrique, deleteRubrique, rubriqueRules,
  // Bulletins
  getBulletins, getBulletinById, creerOuMajBulletin, genererMois,
  validerBulletin, payerBulletin, supprimerBulletin, getBulletinPDF, bulletinRules,
  // Stats
  getStatsPaie, getParametres,
};
