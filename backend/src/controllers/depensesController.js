const pool = require('../../config/database');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { ecritureDepense } = require('../utils/comptabilite-auto');
const { ComptaError } = require('../utils/comptabilite');
const { controlerSoldeAvantSortie, SoldeInsuffisantError } = require('./tresorerieController');

// ── Règles de validation ──────────────────────────────────────────────────
const depenseRules = [
  body('description').trim().notEmpty().withMessage('Description requise').isLength({ max: 500 }).withMessage('Description trop longue'),
  body('montant_ht').isFloat({ min: 0 }).withMessage('Montant HT invalide'),
  body('taux_tva').optional().isFloat({ min: 0, max: 100 }).withMessage('Taux de TVA invalide'),
  body('categorie_id').optional({ nullable: true, checkFalsy: true }).isUUID().withMessage('Catégorie invalide'),
  body('compte_tresorerie_id').optional({ nullable: true, checkFalsy: true }).isUUID().withMessage('Compte de trésorerie invalide'),
  body('date_depense').optional({ checkFalsy: true }).isISO8601().withMessage('Date de dépense invalide'),
  body('date_echeance').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage("Date d'échéance invalide"),
  body('statut').optional().isIn(['payee', 'en_attente', 'annulee']).withMessage('Statut invalide'),
  body('mode_paiement').optional().isIn(['cash', 'virement', 'cheque', 'mobile_money', 'carte']).withMessage('Mode de paiement invalide'),
  body('fournisseur').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 200 }).withMessage('Nom de fournisseur trop long'),
];

const categorieDepenseRules = [
  body('nom').trim().notEmpty().withMessage('Nom requis').isLength({ max: 80 }).withMessage('Nom trop long'),
  body('code').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 10 }).withMessage('Code trop long'),
];

// GET /api/depenses — liste avec filtres
const getDepenses = async (req, res) => {
  try {
    const { categorie_id, statut, search, date_debut, date_fin, page = 1, limit = 20 } = req.query;
    const eid = req.entrepriseId;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const offset   = (pageNum - 1) * limitNum;

    // Construire les conditions WHERE séparément pour réutilisation dans le COUNT
    const conditions = ['d.entreprise_id = $1'];
    const params     = [eid];

    if (statut && statut.trim()) {
      params.push(statut.trim());
      conditions.push(`d.statut = $${params.length}`);
    }
    if (categorie_id && categorie_id.trim()) {
      params.push(categorie_id.trim());
      conditions.push(`d.categorie_id = $${params.length}`);
    }
    if (date_debut && date_debut.trim()) {
      params.push(date_debut.trim());
      conditions.push(`d.date_depense >= $${params.length}`);
    }
    if (date_fin && date_fin.trim()) {
      params.push(date_fin.trim());
      conditions.push(`d.date_depense <= $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(d.description ILIKE $${params.length} OR d.fournisseur ILIKE $${params.length} OR d.numero ILIKE $${params.length})`);
    }

    const where = conditions.join(' AND ');

    // COUNT séparé — propre, sans replace() fragile
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM depenses d WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    // Requête principale
    const dataRes = await pool.query(
      `SELECT d.*, c.nom AS categorie_nom, c.couleur AS categorie_couleur, c.code AS categorie_code,
              u.nom AS cree_par_nom
       FROM depenses d
       LEFT JOIN categories_depenses c ON c.id = d.categorie_id
       LEFT JOIN utilisateurs u ON u.id = d.cree_par
       WHERE ${where}
       ORDER BY d.date_depense DESC, d.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page:  pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error('Erreur getDepenses:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/depenses/stats — totaux par catégorie et par mois
const getStatsDepenses = async (req, res) => {
  try {
    const { annee = new Date().getFullYear() } = req.query;
    const eid = req.entrepriseId;

    const parCatRes = await pool.query(`
      SELECT c.nom, c.couleur, c.code,
             COALESCE(SUM(d.montant_ttc), 0) AS total,
             COUNT(d.id) AS nb
      FROM categories_depenses c
      LEFT JOIN depenses d ON d.categorie_id = c.id
        AND EXTRACT(YEAR FROM d.date_depense) = $2
        AND d.statut = 'payee'
      WHERE c.entreprise_id = $1
      GROUP BY c.id, c.nom, c.couleur, c.code
      ORDER BY total DESC
    `, [eid, annee]);

    const parMoisRes = await pool.query(`
      SELECT EXTRACT(MONTH FROM date_depense) AS mois,
             COALESCE(SUM(montant_ttc), 0) AS total,
             COALESCE(SUM(montant_ht),  0) AS total_ht,
             COALESCE(SUM(montant_tva), 0) AS total_tva
      FROM depenses
      WHERE entreprise_id = $1
        AND EXTRACT(YEAR FROM date_depense) = $2
        AND statut = 'payee'
      GROUP BY EXTRACT(MONTH FROM date_depense)
      ORDER BY mois
    `, [eid, annee]);

    const moisNoms = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const mensuel  = moisNoms.map((nom, i) => {
      const r = parMoisRes.rows.find(x => parseInt(x.mois) === i + 1);
      return {
        mois:      nom,
        total:     parseFloat(r?.total    || 0),
        total_ht:  parseFloat(r?.total_ht || 0),
        total_tva: parseFloat(r?.total_tva|| 0),
      };
    });

    const totalAnnee = mensuel.reduce((s, r) => s + r.total, 0);

    res.json({
      success: true,
      data: {
        total_annee: totalAnnee,
        par_categorie: parCatRes.rows.map(r => ({
          ...r,
          total:       parseFloat(r.total),
          pourcentage: totalAnnee > 0 ? ((r.total / totalAnnee) * 100).toFixed(1) : 0,
        })),
        par_mois: mensuel,
      },
    });
  } catch (err) {
    console.error('Erreur getStatsDepenses:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/depenses
const createDepense = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;
    const {
      categorie_id, description, fournisseur, fournisseur_id, montant_ht, taux_tva = 0,
      date_depense, date_echeance, statut = 'payee', mode_paiement = 'virement',
      reference, notes, est_recurrente, periodicite,
      compte_tresorerie_id,
    } = req.body;

    if (!description || !montant_ht) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Description et montant requis' });
    }

    const montantHT  = parseFloat(montant_ht);
    const tauxTVA    = Math.min(100, Math.max(0, parseFloat(taux_tva) || 0));
    const montantTVA = Math.round(montantHT * (tauxTVA / 100) * 100) / 100;
    const montantTTC = Math.round((montantHT + montantTVA) * 100) / 100;

    const year     = new Date().getFullYear();
    const countRes = await client.query(
      `SELECT COUNT(*) FROM depenses WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_depense)=$2`,
      [eid, year]
    );
    const numero = `D-${year}-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;

    // Résolution du compte de trésorerie pour les dépenses payées
    let compteId = compte_tresorerie_id || null;
    if (statut === 'payee') {
      if (!compteId) {
        const typeAttendu = mode_paiement === 'cash' ? 'caisse'
          : mode_paiement === 'mobile_money' ? 'mobile_money'
          : 'banque';
        const r = await client.query(
          `SELECT id FROM comptes_tresorerie
           WHERE entreprise_id = $1 AND par_defaut = TRUE AND archived_at IS NULL
             AND (type = $2 OR type = 'banque')
           ORDER BY (type = $2) DESC LIMIT 1`,
          [eid, typeAttendu]
        );
        compteId = r.rows[0]?.id || null;
      } else {
        const r = await client.query(
          `SELECT id FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2 AND archived_at IS NULL`,
          [compteId, eid]
        );
        if (!r.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Compte de trésorerie invalide' });
        }
      }
    } else {
      compteId = null;
    }

    // Si fournisseur_id fourni, vérifier qu'il appartient bien à l'entreprise
    // (sinon contrainte FK rejetterait, mais on veut un message clair).
    let fournisseurIdValide = null;
    if (fournisseur_id) {
      const fv = await client.query(
        `SELECT 1 FROM fournisseurs WHERE id = $1 AND entreprise_id = $2 LIMIT 1`,
        [fournisseur_id, eid]
      );
      if (fv.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Fournisseur invalide' });
      }
      fournisseurIdValide = fournisseur_id;
    }

    const result = await client.query(
      `INSERT INTO depenses
         (entreprise_id, categorie_id, cree_par, numero, description, fournisseur, fournisseur_id,
          montant_ht, taux_tva, montant_tva, montant_ttc, date_depense, date_echeance,
          statut, mode_paiement, reference, notes, est_recurrente, periodicite,
          compte_tresorerie_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        eid, categorie_id || null, req.user.id, numero, description, fournisseur || null, fournisseurIdValide,
        montantHT, tauxTVA, montantTVA, montantTTC,
        date_depense || new Date().toISOString().split('T')[0], date_echeance || null,
        statut, mode_paiement, reference || null, notes || null,
        est_recurrente || false, periodicite || null, compteId,
      ]
    );
    const depense = result.rows[0];

    // Récupérer le code SYSCOHADA de la catégorie pour mapper vers le bon compte
    let codeCategorie = null;
    if (depense.categorie_id) {
      const cat = await client.query('SELECT code FROM categories_depenses WHERE id=$1', [depense.categorie_id]);
      codeCategorie = cat.rows[0]?.code || null;
    }

    // Génération auto du mouvement de trésorerie (sortie) si dépense payée
    if (statut === 'payee' && compteId) {
      // Contrôle du solde du compte avant le décaissement
      await controlerSoldeAvantSortie(client, compteId, montantTTC);
      await client.query(
        `INSERT INTO mouvements_tresorerie
          (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, source_id, cree_par)
         VALUES ($1,$2,$3,'sortie',$4,$5,$6,'depense',$7,$8)`,
        [eid, compteId, depense.date_depense, montantTTC,
         `${fournisseur || description} - ${numero}`.slice(0, 250), reference || numero, depense.id, req.user.id]
      );
    }

    // Génération auto (sauf si statut annulee)
    await ecritureDepense(client, {
      entrepriseId: eid,
      utilisateurId: req.user.id,
      depense: { ...depense, categorie_code: codeCategorie },
    });

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'depenses', depense.id, {
      numero, description, fournisseur, montant_ttc: montantTTC,
    });
    res.status(201).json({ success: true, data: depense });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof SoldeInsuffisantError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code, details: err.details });
    }
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur createDepense:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// PUT /api/depenses/:id
// Refus si une écriture comptable est déjà liée : la modification d'une
// dépense comptabilisée désynchroniserait métier et compta. L'utilisateur
// doit alors annuler la dépense (statut=annulee) puis en créer une nouvelle,
// ou passer une OD manuelle de régularisation. Les champs purement
// descriptifs (notes, reference) restent autorisés.
const CHAMPS_DESCRIPTIFS = new Set(['notes', 'reference']);
const updateDepense = async (req, res) => {
  try {
    const { id }  = req.params;
    const eid     = req.entrepriseId;
    const body = req.body;

    if (!body.description || body.montant_ht === undefined) {
      return res.status(400).json({ success: false, message: 'Description et montant requis' });
    }

    // Vérifie si une écriture comptable existe pour cette dépense
    const ecRes = await pool.query(
      `SELECT 1 FROM ecritures
       WHERE entreprise_id = $1 AND origine = 'AUTO_DEPENSE' AND origine_id = $2 LIMIT 1`,
      [eid, id]
    );
    const aEcriture = ecRes.rows.length > 0;

    if (aEcriture) {
      // Détecte si la requête modifie autre chose que les champs descriptifs
      const champsModifies = Object.keys(body).filter(k => !CHAMPS_DESCRIPTIFS.has(k));
      if (champsModifies.length > 0) {
        return res.status(400).json({
          success: false,
          code: 'DEPENSE_COMPTABILISEE',
          message: 'Cette dépense est déjà comptabilisée. Annulez-la et créez-en une nouvelle, ou passez une OD de régularisation.',
        });
      }
    }

    const montantHT  = parseFloat(body.montant_ht);
    const tauxTVA    = Math.min(100, Math.max(0, parseFloat(body.taux_tva) || 0));
    const montantTVA = Math.round(montantHT * (tauxTVA / 100) * 100) / 100;
    const montantTTC = Math.round((montantHT + montantTVA) * 100) / 100;

    const result = await pool.query(
      `UPDATE depenses SET
         categorie_id=$1, description=$2, fournisseur=$3,
         montant_ht=$4, taux_tva=$5, montant_tva=$6, montant_ttc=$7,
         date_depense=$8, statut=$9, mode_paiement=$10,
         reference=$11, notes=$12, updated_at=NOW()
       WHERE id=$13 AND entreprise_id=$14 RETURNING *`,
      [
        body.categorie_id || null, body.description, body.fournisseur || null,
        montantHT, tauxTVA, montantTVA, montantTTC,
        body.date_depense, body.statut, body.mode_paiement,
        body.reference || null, body.notes || null, id, eid,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Dépense introuvable' });
    }
    logAudit(req, 'UPDATE', 'depenses', id, {
      description: body.description, montant_ttc: montantTTC,
      statut: body.statut, mode_paiement: body.mode_paiement,
    });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateDepense:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// DELETE /api/depenses/:id
// Refus si une écriture comptable est liée : on ne supprime pas une dépense
// déjà passée en compta, sous peine de laisser une écriture orpheline.
const deleteDepense = async (req, res) => {
  try {
    const ecRes = await pool.query(
      `SELECT 1 FROM ecritures
       WHERE entreprise_id = $1 AND origine = 'AUTO_DEPENSE' AND origine_id = $2 LIMIT 1`,
      [req.entrepriseId, req.params.id]
    );
    if (ecRes.rows.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'DEPENSE_COMPTABILISEE',
        message: 'Cette dépense est déjà comptabilisée. Annulez-la (statut=annulee) plutôt que la supprimer.',
      });
    }

    const result = await pool.query(
      'DELETE FROM depenses WHERE id=$1 AND entreprise_id=$2 RETURNING id',
      [req.params.id, req.entrepriseId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Dépense introuvable' });
    }
    logAudit(req, 'DELETE', 'depenses', req.params.id);
    res.json({ success: true, message: 'Dépense supprimée' });
  } catch (err) {
    console.error('Erreur deleteDepense:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/depenses/categories
const getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories_depenses WHERE entreprise_id=$1 ORDER BY est_systeme DESC, nom ASC',
      [req.entrepriseId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/depenses/categories
const createCategorie = async (req, res) => {
  try {
    const { nom, code, couleur } = req.body;
    if (!nom) return res.status(400).json({ success: false, message: 'Nom requis' });
    const result = await pool.query(
      'INSERT INTO categories_depenses (entreprise_id, nom, code, couleur) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.entrepriseId, nom, code || null, couleur || '#6B7A99']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  getDepenses, getStatsDepenses, createDepense, updateDepense,
  deleteDepense, getCategories, createCategorie,
  depenseRules, categorieDepenseRules,
};