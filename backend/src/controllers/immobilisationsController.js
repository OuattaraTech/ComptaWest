const pool = require('../../config/database');
const path = require('path');
const pdfmake = require('pdfmake');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { planAmortissement, dotationPourAnnee, coefficientDegressifStandard } = require('../utils/amortissements');
const { creerEcriture, round2: round2Compta, ComptaError } = require('../utils/comptabilite');

// ─── PDF (réutilise les fontes Roboto) ─────────────────────────────────────
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

const immobilisationRules = [
  body('libelle').trim().notEmpty().withMessage('Libellé requis').isLength({ max: 200 }),
  body('date_acquisition').isISO8601().withMessage('Date d\'acquisition invalide'),
  body('valeur_acquisition').isFloat({ min: 0 }).withMessage('Valeur d\'acquisition invalide'),
];

// ─── CATÉGORIES ────────────────────────────────────────────────────────────
const getCategories = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const r = await pool.query(
      `SELECT * FROM categories_immobilisation WHERE entreprise_id = $1 ORDER BY ordre, libelle`,
      [eid]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Erreur getCategories immo:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── IMMOBILISATIONS ───────────────────────────────────────────────────────

const generateNumeroInventaire = async (entrepriseId, categorieCode) => {
  const year = new Date().getFullYear();
  const prefix = (categorieCode || 'IMMO').substring(0, 6).toUpperCase();
  const r = await pool.query(
    `SELECT COUNT(*) FROM immobilisations WHERE entreprise_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
    [entrepriseId, year]
  );
  const seq = String(parseInt(r.rows[0].count) + 1).padStart(3, '0');
  return `${prefix}-${year}-${seq}`;
};

// GET /api/immobilisations
const getImmobilisations = async (req, res) => {
  try {
    const { search, statut = 'en_service', categorie_id, page = 1, limit = 30 } = req.query;
    const eid = req.entrepriseId;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let query = `
      SELECT i.*,
        ci.libelle AS categorie_libelle,
        COALESCE((SELECT SUM(dotation) FROM dotations_amortissement WHERE immobilisation_id = i.id), 0) AS cumul_amortissements,
        i.valeur_acquisition -
          COALESCE((SELECT SUM(dotation) FROM dotations_amortissement WHERE immobilisation_id = i.id), 0) AS vnc_actuelle,
        (SELECT MAX(annee) FROM dotations_amortissement WHERE immobilisation_id = i.id) AS derniere_dotation_annee
      FROM immobilisations i
      LEFT JOIN categories_immobilisation ci ON ci.id = i.categorie_id
      WHERE i.entreprise_id = $1
    `;
    const params = [eid];

    if (statut && statut !== 'tous') {
      params.push(statut);
      query += ` AND i.statut = $${params.length}`;
    }
    if (categorie_id) {
      params.push(categorie_id);
      query += ` AND i.categorie_id = $${params.length}`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (i.libelle ILIKE $${params.length} OR i.numero_inventaire ILIKE $${params.length} OR i.fournisseur ILIKE $${params.length})`;
    }

    const countQuery = query.replace(/SELECT.*?FROM immobilisations/s, 'SELECT COUNT(*) FROM immobilisations');
    const countRes = await pool.query(countQuery, params);

    params.push(parseInt(limit), offset);
    query += ` ORDER BY i.date_acquisition DESC, i.numero_inventaire DESC
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
    console.error('Erreur getImmobilisations:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// GET /api/immobilisations/:id
const getImmobilisationById = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const immRes = await pool.query(
      `SELECT i.*, ci.libelle AS categorie_libelle
       FROM immobilisations i
       LEFT JOIN categories_immobilisation ci ON ci.id = i.categorie_id
       WHERE i.id = $1 AND i.entreprise_id = $2`,
      [id, eid]
    );
    if (!immRes.rows[0]) return res.status(404).json({ success: false, message: 'Immobilisation introuvable' });
    const immo = immRes.rows[0];

    const dotations = await pool.query(
      `SELECT * FROM dotations_amortissement WHERE immobilisation_id = $1 ORDER BY annee`,
      [id]
    );

    // Plan théorique complet
    const planTheorique = immo.amortissable
      ? planAmortissement(immo)
      : [];

    res.json({
      success: true,
      data: { ...immo, dotations: dotations.rows, plan_theorique: planTheorique },
    });
  } catch (err) {
    console.error('Erreur getImmobilisationById:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// POST /api/immobilisations
// Body optionnel pour la comptabilisation de l'acquisition :
//   - comptabiliser  : boolean, défaut true (false = immo historique déjà
//                      comptabilisée dans un autre logiciel)
//   - mode_acquisition : 'credit' (défaut) | 'comptant'
//                      crédit  → contrepartie 4011 (fournisseur à payer)
//                      comptant → contrepartie compte_tresorerie_id (5xx)
//   - compte_tresorerie_id : si mode_acquisition='comptant'
//
// L'écriture d'acquisition n'est PAS générée si :
//   - comptabiliser=false
//   - source_type='depense' (la dépense a déjà passé l'écriture d'achat)
//   - source_type='facture' (idem)
const createImmobilisation = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;
    const b = req.body;

    // Charge la catégorie si fournie (héritage des comptes)
    let cat = null;
    if (b.categorie_id) {
      const r = await client.query(
        `SELECT * FROM categories_immobilisation WHERE id = $1 AND entreprise_id = $2`,
        [b.categorie_id, eid]
      );
      cat = r.rows[0];
    }

    const numero = b.numero_inventaire || await generateNumeroInventaire(eid, cat?.code);
    const compteActif = b.compte_actif || cat?.compte_actif;
    if (!compteActif) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Compte SYSCOHADA d\'actif requis (via catégorie ou explicite)' });
    }
    const compteAmort = b.compte_amortissement || cat?.compte_amortissement;
    const compteDot = b.compte_dotation || cat?.compte_dotation;
    const dureeAns = parseFloat(b.duree_annees ?? cat?.duree_annees) || null;
    const methode = b.methode || cat?.methode || 'lineaire';
    const amortissable = b.amortissable !== undefined ? !!b.amortissable
      : (cat?.amortissable !== undefined ? cat.amortissable : true);
    const coeffDeg = parseFloat(b.coefficient_degressif)
      || (methode === 'degressif' && dureeAns ? coefficientDegressifStandard(dureeAns) : null);
    const sourceType = b.source_type || 'manuel';

    const result = await client.query(
      `INSERT INTO immobilisations (
        entreprise_id, numero_inventaire, libelle, description, categorie_id,
        compte_actif, compte_amortissement, compte_dotation,
        date_acquisition, date_mise_en_service, valeur_acquisition, valeur_residuelle,
        amortissable, duree_annees, methode, coefficient_degressif,
        source_type, source_id, fournisseur, reference_facture,
        emplacement, affecte_a, numero_serie, cree_par
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *`,
      [
        eid, numero, b.libelle, b.description || null, b.categorie_id || null,
        compteActif, compteAmort, compteDot,
        b.date_acquisition, b.date_mise_en_service || b.date_acquisition,
        round2(b.valeur_acquisition), round2(b.valeur_residuelle || 0),
        amortissable, amortissable ? dureeAns : null,
        methode, coeffDeg,
        sourceType, b.source_id || null,
        b.fournisseur || null, b.reference_facture || null,
        b.emplacement || null, b.affecte_a || null, b.numero_serie || null,
        req.user?.id,
      ]
    );
    const immo = result.rows[0];

    // Écriture d'acquisition (si non héritée d'une dépense/facture déjà comptabilisée)
    const valAcq = round2(b.valeur_acquisition);
    const skipCompta = b.comptabiliser === false
                    || sourceType === 'depense'
                    || sourceType === 'facture'
                    || valAcq <= 0;
    let ecPiece = null;
    if (!skipCompta) {
      const modeAcq = b.mode_acquisition || 'credit';
      let contrepartie = '4011';
      let journal = 'ACH';
      if (modeAcq === 'comptant' && b.compte_tresorerie_id) {
        const ct = await client.query(
          `SELECT type, compte_pc_numero FROM comptes_tresorerie
           WHERE id = $1 AND entreprise_id = $2 AND archived_at IS NULL`,
          [b.compte_tresorerie_id, eid]
        );
        if (ct.rows[0]?.compte_pc_numero) {
          contrepartie = ct.rows[0].compte_pc_numero;
          journal = ct.rows[0].type === 'caisse' ? 'CAI'
                  : ct.rows[0].type === 'mobile_money' ? 'MM'
                  : 'BNK';
        }
      }
      try {
        const ec = await creerEcriture(client, {
          entrepriseId: eid,
          utilisateurId: req.user?.id,
          journalCode: journal,
          date: b.date_acquisition,
          libelle: `Acquisition ${immo.libelle} (${numero})`.slice(0, 250),
          reference: b.reference_facture || numero,
          origine: 'AUTO_IMMO_ACQUISITION',
          origineId: immo.id,
          lignes: [
            { compte: compteActif, debit: valAcq, libelle: `Entrée actif ${numero}` },
            { compte: contrepartie, credit: valAcq, libelle: b.fournisseur || `Acquisition ${numero}` },
          ],
        });
        ecPiece = ec.numero_piece;
      } catch (err) {
        // Exercice clos / journal manquant / compte inexistant : on annule la
        // création (incohérence inacceptable entre actif et compta). Pour les
        // autres erreurs (libellé trop long, etc.), on aurait pu tolérer, mais
        // ici on préfère échouer bruyamment côté création.
        await client.query('ROLLBACK');
        if (err instanceof ComptaError) {
          return res.status(400).json({
            success: false, message: `Acquisition non comptabilisable : ${err.message}`, code: err.code,
          });
        }
        throw err;
      }
    }

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'immobilisations', immo.id,
      { numero, libelle: b.libelle, valeur: b.valeur_acquisition, ecriture: ecPiece });
    res.status(201).json({ success: true, data: immo });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Numéro d\'inventaire déjà utilisé' });
    }
    console.error('Erreur createImmobilisation:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création immobilisation' });
  } finally {
    client.release();
  }
};

// PUT /api/immobilisations/:id
const updateImmobilisation = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const b = req.body;

    // Empêche la modification si des dotations existent (sauf champs descriptifs)
    const dotRes = await pool.query(
      `SELECT COUNT(*) FROM dotations_amortissement WHERE immobilisation_id = $1`,
      [id]
    );
    const aDotations = parseInt(dotRes.rows[0].count) > 0;

    const fieldsCritiques = ['valeur_acquisition', 'valeur_residuelle', 'duree_annees',
      'methode', 'date_acquisition', 'date_mise_en_service'];
    const modifie = fieldsCritiques.some(f => b[f] !== undefined);
    if (aDotations && modifie) {
      return res.status(400).json({
        success: false,
        message: 'Cette immobilisation a des dotations enregistrées. Supprimez-les pour modifier valeur ou durée.',
      });
    }

    const r = await pool.query(
      `UPDATE immobilisations SET
        libelle = COALESCE($1, libelle),
        description = $2,
        valeur_acquisition = COALESCE($3, valeur_acquisition),
        valeur_residuelle = COALESCE($4, valeur_residuelle),
        date_acquisition = COALESCE($5, date_acquisition),
        date_mise_en_service = COALESCE($6, date_mise_en_service),
        duree_annees = COALESCE($7, duree_annees),
        methode = COALESCE($8, methode),
        coefficient_degressif = $9,
        fournisseur = $10, reference_facture = $11,
        emplacement = $12, affecte_a = $13, numero_serie = $14,
        updated_at = NOW()
       WHERE id = $15 AND entreprise_id = $16 RETURNING *`,
      [b.libelle, b.description || null,
       b.valeur_acquisition !== undefined ? round2(b.valeur_acquisition) : null,
       b.valeur_residuelle !== undefined ? round2(b.valeur_residuelle) : null,
       b.date_acquisition || null, b.date_mise_en_service || null,
       b.duree_annees !== undefined ? parseFloat(b.duree_annees) : null,
       b.methode || null,
       b.coefficient_degressif !== undefined ? parseFloat(b.coefficient_degressif) : null,
       b.fournisseur || null, b.reference_facture || null,
       b.emplacement || null, b.affecte_a || null, b.numero_serie || null,
       id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Introuvable' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur updateImmobilisation:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// DELETE /api/immobilisations/:id
const deleteImmobilisation = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const dotRes = await pool.query(
      `SELECT COUNT(*) FROM dotations_amortissement WHERE immobilisation_id = $1`,
      [id]
    );
    if (parseInt(dotRes.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cette immobilisation a des dotations comptables. Utilisez plutôt « Cession » ou « Mise au rebut ».',
      });
    }
    const r = await pool.query(
      `DELETE FROM immobilisations WHERE id = $1 AND entreprise_id = $2 RETURNING id`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Introuvable' });
    logAudit(req, 'DELETE', 'immobilisations', id);
    res.json({ success: true, message: 'Immobilisation supprimée' });
  } catch (err) {
    console.error('Erreur deleteImmobilisation:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── DOTATIONS AUX AMORTISSEMENTS ──────────────────────────────────────────

// POST /api/immobilisations/dotations/generer
// Body : { annee }
const genererDotationsAnnee = async (req, res) => {
  const client = await pool.connect();
  try {
    const eid = req.entrepriseId;
    const annee = parseInt(req.body.annee);
    if (!annee || annee < 2000 || annee > 2100) {
      return res.status(400).json({ success: false, message: 'Année invalide' });
    }

    // Toutes les immo en service ou amorties à compléter sur cette année
    const immos = await pool.query(
      `SELECT * FROM immobilisations
       WHERE entreprise_id = $1
         AND amortissable = TRUE
         AND statut IN ('en_service', 'cede', 'rebut', 'amorti')
         AND COALESCE(date_mise_en_service, date_acquisition) <= $2`,
      [eid, `${annee}-12-31`]
    );

    await client.query('BEGIN');

    let crees = 0, ignores = 0;
    const erreurs = [];
    let totalDotation = 0;

    for (const immo of immos.rows) {
      try {
        // Saute si déjà fait
        const exist = await client.query(
          `SELECT id FROM dotations_amortissement WHERE immobilisation_id = $1 AND annee = $2`,
          [immo.id, annee]
        );
        if (exist.rows[0]) { ignores++; continue; }

        // Calcule la dotation pour cette année
        const dotation = dotationPourAnnee(immo, annee);
        if (!dotation || dotation.dotation <= 0) { ignores++; continue; }

        // Cumul des dotations passées (pour le cumul_amortissements)
        const cumulRes = await client.query(
          `SELECT COALESCE(SUM(dotation), 0) AS cumul FROM dotations_amortissement
           WHERE immobilisation_id = $1 AND annee < $2`,
          [immo.id, annee]
        );
        const cumulAnterieur = parseFloat(cumulRes.rows[0].cumul);
        const cumulApres = round2(cumulAnterieur + parseFloat(dotation.dotation));

        const insertRes = await client.query(
          `INSERT INTO dotations_amortissement (
            entreprise_id, immobilisation_id, annee, date_dotation, nb_jours_amortis,
            base_amortissable, taux_amortissement, vnc_debut, dotation,
            cumul_amortissements, vnc_fin, cree_par
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [eid, immo.id, annee, `${annee}-12-31`, dotation.jours_amortis,
           dotation.base_amortissable, dotation.taux_amortissement,
           round2(parseFloat(immo.valeur_acquisition) - cumulAnterieur),
           dotation.dotation, cumulApres,
           round2(parseFloat(immo.valeur_acquisition) - cumulApres),
           req.user?.id]
        );

        // Si l'immo est entièrement amortie, on bascule son statut
        const vncFinale = round2(parseFloat(immo.valeur_acquisition) - cumulApres);
        if (vncFinale <= parseFloat(immo.valeur_residuelle) + 0.01) {
          await client.query(
            `UPDATE immobilisations SET statut = 'amorti' WHERE id = $1 AND statut = 'en_service'`,
            [immo.id]
          );
        }

        crees++;
        totalDotation += parseFloat(dotation.dotation);
      } catch (err) {
        erreurs.push({ immo: immo.numero_inventaire, message: err.message });
      }
    }

    // Génère 1 écriture comptable globale OD pour toutes les dotations de l'année
    if (crees > 0) {
      try {
        // Regroupement par couple (compte_dotation, compte_amortissement)
        const lignes = await client.query(
          `SELECT i.compte_dotation, i.compte_amortissement, SUM(d.dotation) AS total
           FROM dotations_amortissement d
           JOIN immobilisations i ON i.id = d.immobilisation_id
           WHERE d.entreprise_id = $1 AND d.annee = $2 AND d.ecriture_id IS NULL
           GROUP BY i.compte_dotation, i.compte_amortissement`,
          [eid, annee]
        );

        const ecritureLignes = [];
        for (const l of lignes.rows) {
          const total = round2Compta(l.total);
          if (!l.compte_dotation || !l.compte_amortissement || total <= 0) continue;
          ecritureLignes.push({ compte: l.compte_dotation, debit: total, libelle: `Dotation aux amortissements ${annee}` });
          ecritureLignes.push({ compte: l.compte_amortissement, credit: total, libelle: `Amortissements cumulés ${annee}` });
        }

        if (ecritureLignes.length > 0) {
          const ecriture = await creerEcriture(client, {
            entrepriseId: eid,
            utilisateurId: req.user?.id,
            journalCode: 'OD',
            date: `${annee}-12-31`,
            libelle: `Dotations aux amortissements - exercice ${annee}`,
            reference: `DOT-${annee}`,
            origine: 'AUTO_DOTATIONS',
            origineId: null,
            lignes: ecritureLignes,
          });

          // Liaison des dotations à l'écriture
          await client.query(
            `UPDATE dotations_amortissement SET ecriture_id = $1
             WHERE entreprise_id = $2 AND annee = $3 AND ecriture_id IS NULL`,
            [ecriture.id, eid, annee]
          );
        }
      } catch (err) {
        // Un exercice clos est une vraie contrainte métier : on ne peut pas générer
        // des dotations sans leur pendant comptable. On annule donc l'opération.
        // Les autres erreurs comptables (compte manquant, etc.) sont tolérées :
        // les dotations restent calculées, l'écriture pourra être passée en OD manuel.
        if (err instanceof ComptaError && err.code === 'EXERCICE_FERME') {
          throw err;
        }
        erreurs.push({ etape: 'ecriture_comptable', message: err.message });
      }
    }

    await client.query('COMMIT');
    logAudit(req, 'BULK_CREATE', 'dotations_amortissement', null,
      { annee, crees, ignores, total: totalDotation, erreurs: erreurs.length });

    res.json({
      success: true,
      data: { annee, crees, ignores, total_dotation: round2(totalDotation), total_immobilisations: immos.rows.length, erreurs },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur genererDotationsAnnee:', err.message);
    res.status(500).json({ success: false, message: 'Erreur génération dotations' });
  } finally {
    client.release();
  }
};

// DELETE /api/immobilisations/dotations/:id
// Refus si l'écriture comptable liée est partagée avec d'autres dotations
// (cas standard : genererDotationsAnnee regroupe toutes les dotations de
// l'année dans une seule écriture OD). Supprimer une dotation isolée
// laisserait l'écriture comptable en surévaluation.
//
// Pour les dotations sans écriture (calculées mais non encore comptabilisées),
// la suppression unitaire reste possible.
const supprimerDotation = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `SELECT ecriture_id FROM dotations_amortissement WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Dotation introuvable' });

    if (r.rows[0].ecriture_id) {
      // Compte combien de dotations partagent la même écriture
      const partage = await pool.query(
        `SELECT COUNT(*)::int AS n FROM dotations_amortissement
          WHERE ecriture_id = $1`,
        [r.rows[0].ecriture_id]
      );
      const nbPartagees = partage.rows[0].n;
      return res.status(400).json({
        success: false,
        code: 'DOTATION_COMPTABILISEE',
        message: nbPartagees > 1
          ? `Cette dotation est regroupée en compta avec ${nbPartagees - 1} autre(s). Passez une OD de régularisation.`
          : `Cette dotation est déjà comptabilisée (pièce liée). Passez une OD de régularisation ou contre-passez l'écriture d'abord.`,
      });
    }

    await pool.query(`DELETE FROM dotations_amortissement WHERE id = $1`, [id]);
    logAudit(req, 'DELETE', 'dotations_amortissement', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur supprimerDotation:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── CESSIONS / SORTIES ────────────────────────────────────────────────────

// POST /api/immobilisations/:id/cession
// Body : { date_sortie, valeur_cession, motif?, statut: 'cede' | 'rebut' | 'vole_perdu' }
const cederImmobilisation = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const { date_sortie, valeur_cession = 0, motif = '', statut = 'cede' } = req.body;

    if (!['cede', 'rebut', 'vole_perdu'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    }
    if (!date_sortie) {
      return res.status(400).json({ success: false, message: 'Date de sortie requise' });
    }

    await client.query('BEGIN');

    const immRes = await client.query(
      `SELECT * FROM immobilisations WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!immRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Introuvable' });
    }
    const immo = immRes.rows[0];

    if (['cede', 'rebut', 'vole_perdu'].includes(immo.statut)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cette immobilisation est déjà sortie' });
    }

    // Cumul amortissements à la date de sortie
    const cumulRes = await client.query(
      `SELECT COALESCE(SUM(dotation), 0) AS cumul FROM dotations_amortissement WHERE immobilisation_id = $1`,
      [id]
    );
    const cumulAmort = round2(parseFloat(cumulRes.rows[0].cumul));
    const valeurAcq = parseFloat(immo.valeur_acquisition);
    const vnc = round2(valeurAcq - cumulAmort);
    const valCession = round2(valeur_cession);
    const plusOuMoinsValue = round2(valCession - vnc);

    // Mise à jour de l'immobilisation
    await client.query(
      `UPDATE immobilisations SET
        statut = $1, date_sortie = $2, valeur_cession = $3, motif_sortie = $4, updated_at = NOW()
       WHERE id = $5`,
      [statut, date_sortie, valCession, motif, id]
    );

    // Écriture comptable de sortie SYSCOHADA :
    //   D 28x Amortissements cumulés        (sortie de l'amortissement)
    //   D 812 Valeur comptable des cessions (VNC en charge)
    //   D 521/411 Banque ou créance         (prix de cession reçu, si > 0)
    //   C 21x/24x Compte d'actif            (sortie de l'immobilisation)
    //   C 822 Produit des cessions          (prix de cession en produit, si > 0)
    const lignes = [];

    // Sortie de l'actif
    lignes.push({ compte: immo.compte_actif, credit: valeurAcq, libelle: `Sortie immo ${immo.numero_inventaire}` });

    // Reprise des amortissements
    if (cumulAmort > 0 && immo.compte_amortissement) {
      lignes.push({ compte: immo.compte_amortissement, debit: cumulAmort, libelle: `Reprise amort. ${immo.numero_inventaire}` });
    }

    // VNC : si > 0, on la passe en charge (compte 812)
    if (vnc > 0) {
      lignes.push({ compte: '812', debit: vnc, libelle: `VNC sortie ${immo.numero_inventaire}` });
    }

    // Produit de cession (si valCession > 0)
    if (valCession > 0) {
      lignes.push({ compte: '521', debit: valCession, libelle: `Prix cession ${immo.numero_inventaire}` });
      lignes.push({ compte: '822', credit: valCession, libelle: `Produit cession ${immo.numero_inventaire}` });
    }

    // Les erreurs bloquantes (exercice clos, balance déséquilibrée, journal/compte
    // inexistants) doivent annuler la cession : sans écriture comptable correcte,
    // la sortie de l'actif et la reprise des amortissements ne sont pas reflétées
    // en compta et le bilan diverge. Les erreurs non bloquantes (libellé trop
    // long, etc.) sont tolérées et la cession passe avec un log.
    try {
      await creerEcriture(client, {
        entrepriseId: eid,
        utilisateurId: req.user?.id,
        journalCode: 'OD',
        date: date_sortie,
        libelle: `${statut === 'cede' ? 'Cession' : statut === 'rebut' ? 'Mise au rebut' : 'Perte/Vol'} - ${immo.libelle}`,
        reference: immo.numero_inventaire,
        origine: 'AUTO_CESSION',
        origineId: id,
        lignes,
      });
    } catch (err) {
      if (err instanceof ComptaError &&
          ['EXERCICE_FERME', 'DESEQUILIBRE', 'JOURNAL_INCONNU', 'COMPTE_INCONNU'].includes(err.code)) {
        throw err;
      }
      console.warn('Écriture de cession non bloquante échouée:', err.message);
    }

    await client.query('COMMIT');
    logAudit(req, 'CESSION', 'immobilisations', id,
      { statut, valeur_cession: valCession, vnc, plus_value: plusOuMoinsValue });

    res.json({
      success: true,
      data: { statut, vnc, valeur_cession: valCession, plus_ou_moins_value: plusOuMoinsValue },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({
        success: false,
        message: `Cession non comptabilisable : ${err.message}`,
        code: err.code,
      });
    }
    console.error('Erreur cederImmobilisation:', err.message);
    res.status(500).json({ success: false, message: 'Erreur cession' });
  } finally {
    client.release();
  }
};

// ─── STATISTIQUES ──────────────────────────────────────────────────────────

// GET /api/immobilisations/stats
const getStats = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const annee = parseInt(req.query.annee) || new Date().getFullYear();

    const synthese = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE statut = 'en_service') AS nb_en_service,
        COUNT(*) FILTER (WHERE statut = 'amorti')      AS nb_amorties,
        COUNT(*) FILTER (WHERE statut IN ('cede','rebut','vole_perdu')) AS nb_sorties,
        COALESCE(SUM(valeur_acquisition) FILTER (WHERE statut IN ('en_service','amorti')), 0) AS valeur_brute,
        COALESCE((SELECT SUM(dotation) FROM dotations_amortissement
                  WHERE entreprise_id = $1 AND immobilisation_id IN
                    (SELECT id FROM immobilisations WHERE entreprise_id = $1 AND statut IN ('en_service','amorti'))), 0) AS cumul_amortissements,
        COALESCE((SELECT SUM(dotation) FROM dotations_amortissement
                  WHERE entreprise_id = $1 AND annee = $2), 0) AS dotation_annee
      FROM immobilisations WHERE entreprise_id = $1`,
      [eid, annee]
    );
    const s = synthese.rows[0];
    const vncTotale = round2(parseFloat(s.valeur_brute) - parseFloat(s.cumul_amortissements));

    const parCategorie = await pool.query(
      `SELECT ci.libelle AS categorie, COUNT(i.id) AS nb,
              COALESCE(SUM(i.valeur_acquisition), 0) AS valeur
       FROM immobilisations i
       LEFT JOIN categories_immobilisation ci ON ci.id = i.categorie_id
       WHERE i.entreprise_id = $1 AND i.statut IN ('en_service','amorti')
       GROUP BY ci.libelle ORDER BY valeur DESC`,
      [eid]
    );

    res.json({
      success: true,
      data: {
        annee,
        ...s,
        valeur_brute: parseFloat(s.valeur_brute),
        cumul_amortissements: parseFloat(s.cumul_amortissements),
        dotation_annee: parseFloat(s.dotation_annee),
        vnc_totale: vncTotale,
        par_categorie: parCategorie.rows,
      },
    });
  } catch (err) {
    console.error('Erreur getStats immo:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── CONVERSION DÉPENSE → IMMOBILISATION ───────────────────────────────────
// POST /api/immobilisations/depuis-depense/:depenseId
const creerDepuisDepense = async (req, res) => {
  const client = await pool.connect();
  try {
    const { depenseId } = req.params;
    const eid = req.entrepriseId;
    const b = req.body;

    await client.query('BEGIN');

    const depRes = await client.query(
      `SELECT * FROM depenses WHERE id = $1 AND entreprise_id = $2`,
      [depenseId, eid]
    );
    if (!depRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Dépense introuvable' });
    }
    const dep = depRes.rows[0];

    // Vérifier qu'il n'y a pas déjà une immo liée
    const dupRes = await client.query(
      `SELECT id FROM immobilisations WHERE source_type = 'depense' AND source_id = $1`,
      [depenseId]
    );
    if (dupRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cette dépense est déjà liée à une immobilisation' });
    }

    // Catégorie
    let cat = null;
    if (b.categorie_id) {
      const r = await client.query(
        `SELECT * FROM categories_immobilisation WHERE id = $1 AND entreprise_id = $2`,
        [b.categorie_id, eid]
      );
      cat = r.rows[0];
    }

    const numero = b.numero_inventaire || await generateNumeroInventaire(eid, cat?.code);
    const compteActif = b.compte_actif || cat?.compte_actif;
    if (!compteActif) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Compte d\'actif requis' });
    }
    const dureeAns = parseFloat(b.duree_annees ?? cat?.duree_annees) || null;
    const methode = b.methode || cat?.methode || 'lineaire';
    const amortissable = b.amortissable !== undefined ? !!b.amortissable
      : (cat?.amortissable !== undefined ? cat.amortissable : true);

    const result = await client.query(
      `INSERT INTO immobilisations (
        entreprise_id, numero_inventaire, libelle, description, categorie_id,
        compte_actif, compte_amortissement, compte_dotation,
        date_acquisition, date_mise_en_service, valeur_acquisition, valeur_residuelle,
        amortissable, duree_annees, methode, coefficient_degressif,
        source_type, source_id, fournisseur, reference_facture, cree_par
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'depense',$17,$18,$19,$20)
      RETURNING *`,
      [
        eid, numero, b.libelle || dep.description, b.description || null,
        b.categorie_id || null,
        compteActif, b.compte_amortissement || cat?.compte_amortissement,
        b.compte_dotation || cat?.compte_dotation,
        b.date_acquisition || dep.date_depense,
        b.date_mise_en_service || b.date_acquisition || dep.date_depense,
        round2(b.valeur_acquisition || dep.montant_ht || dep.montant_ttc),
        round2(b.valeur_residuelle || 0),
        amortissable, amortissable ? dureeAns : null, methode,
        methode === 'degressif' && dureeAns ? coefficientDegressifStandard(dureeAns) : null,
        depenseId, dep.fournisseur, dep.numero || dep.reference, req.user?.id,
      ]
    );

    // Marque la dépense comme immobilisée (notes)
    await client.query(
      `UPDATE depenses SET notes = COALESCE(notes, '') || ' [Convertie en immo. ${numero}]' WHERE id = $1`,
      [depenseId]
    );

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'immobilisations', result.rows[0].id,
      { numero, source: 'depense', depense_id: depenseId });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur creerDepuisDepense:', err.message);
    res.status(500).json({ success: false, message: 'Erreur conversion' });
  } finally {
    client.release();
  }
};

// ─── EXPORT PDF tableau d'amortissement d'une immo ────────────────────────
const getTableauAmortissementPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const immRes = await pool.query(
      `SELECT i.*, ci.libelle AS categorie_libelle
       FROM immobilisations i
       LEFT JOIN categories_immobilisation ci ON ci.id = i.categorie_id
       WHERE i.id = $1 AND i.entreprise_id = $2`,
      [id, eid]
    );
    if (!immRes.rows[0]) return res.status(404).json({ success: false, message: 'Introuvable' });
    const immo = immRes.rows[0];

    const dotations = await pool.query(
      `SELECT * FROM dotations_amortissement WHERE immobilisation_id = $1 ORDER BY annee`,
      [id]
    );

    const plan = immo.amortissable ? planAmortissement(immo) : [];

    const VERT = '#00A882', GRIS = '#6B7A99', NOIR = '#0B0F1A', BORDURE = '#D1DBE8', GRIS_CLAIR = '#F5F7FA';
    const cell = (txt, opts = {}) => ({ text: txt, fontSize: 9, margin: [4,3,4,3], ...opts });
    const head = (txt) => cell(txt, { color: 'white', bold: true });

    // Construit la liste : pour chaque année du plan, indique si dotation passée
    const dotsByAnnee = Object.fromEntries(dotations.rows.map(d => [d.annee, d]));
    const lignesPlan = plan.map(p => {
      const passee = !!dotsByAnnee[p.annee];
      return [
        cell(String(p.annee), { bold: passee }),
        cell(p.jours_amortis === 365 ? '365' : String(p.jours_amortis), { alignment: 'center' }),
        cell(`${p.taux}%`, { alignment: 'right' }),
        cell(fmtMontant(p.vnc_debut), { alignment: 'right' }),
        cell(fmtMontant(p.dotation), { alignment: 'right', color: passee ? VERT : NOIR, bold: true }),
        cell(fmtMontant(p.cumul_amortissements), { alignment: 'right' }),
        cell(fmtMontant(p.vnc_fin), { alignment: 'right' }),
        cell(passee ? '✓' : '—', { alignment: 'center', color: passee ? VERT : GRIS }),
      ];
    });

    const docDef = {
      pageSize: 'A4',
      pageMargins: [35, 35, 35, 50],
      content: [
        {
          columns: [
            { stack: [
              { text: 'TABLEAU D\'AMORTISSEMENT', fontSize: 14, bold: true, color: NOIR },
              { text: `${immo.libelle}`, fontSize: 11, color: GRIS, margin: [0, 2, 0, 0] },
              { text: `N° inventaire : ${immo.numero_inventaire}`, fontSize: 9, color: NOIR, margin: [0, 4, 0, 0] },
              immo.categorie_libelle ? { text: `Catégorie : ${immo.categorie_libelle}`, fontSize: 9, color: GRIS } : null,
            ].filter(Boolean), width: '*' },
            { stack: [
              { text: `Valeur d'acquisition`, fontSize: 8, color: GRIS, alignment: 'right' },
              { text: `${fmtMontant(immo.valeur_acquisition)} FCFA`, fontSize: 13, bold: true, alignment: 'right', color: VERT },
              { text: `Acquise le ${String(immo.date_acquisition).slice(0,10)}`, fontSize: 8, color: GRIS, alignment: 'right', margin: [0, 4, 0, 0] },
              immo.date_mise_en_service ? { text: `Mise en service ${String(immo.date_mise_en_service).slice(0,10)}`, fontSize: 8, color: GRIS, alignment: 'right' } : null,
            ].filter(Boolean), width: 'auto' },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 525, y2: 0, lineWidth: 0.5, lineColor: VERT }], margin: [0, 8, 0, 10] },

        {
          columns: [
            { width: 'auto', stack: [
              { text: `Méthode`, fontSize: 8, color: GRIS },
              { text: immo.methode === 'degressif' ? `Dégressif × ${immo.coefficient_degressif}` : 'Linéaire', fontSize: 10, bold: true, color: NOIR },
            ], margin: [0, 0, 30, 0] },
            { width: 'auto', stack: [
              { text: `Durée`, fontSize: 8, color: GRIS },
              { text: `${immo.duree_annees} ans`, fontSize: 10, bold: true, color: NOIR },
            ], margin: [0, 0, 30, 0] },
            { width: 'auto', stack: [
              { text: `Compte d'actif`, fontSize: 8, color: GRIS },
              { text: immo.compte_actif, fontSize: 10, bold: true, color: NOIR },
            ], margin: [0, 0, 30, 0] },
            { width: 'auto', stack: [
              { text: `Cumul amorti`, fontSize: 8, color: GRIS },
              { text: `${fmtMontant(dotations.rows.reduce((s,d) => s + parseFloat(d.dotation), 0))} FCFA`, fontSize: 10, bold: true, color: NOIR },
            ] },
          ],
        },
        { text: '', margin: [0, 14, 0, 0] },

        plan.length === 0 ? { text: 'Immobilisation non amortissable.', italics: true, color: GRIS } :
        {
          table: {
            headerRows: 1,
            widths: [45, 35, 40, '*', '*', '*', '*', 30],
            body: [
              [head('Année'), head('Jours'), head('Taux'), head('VNC début'), head('Dotation'), head('Cumul amort.'), head('VNC fin'), head('Passé')],
              ...lignesPlan,
            ],
          },
          layout: {
            fillColor: (rowIndex) => rowIndex === 0 ? VERT : (rowIndex % 2 === 0 ? GRIS_CLAIR : null),
            hLineWidth: () => 0.4, vLineWidth: () => 0,
            hLineColor: () => BORDURE,
          },
        },

        { text: '', margin: [0, 14, 0, 0] },
        { text: 'Document conforme SYSCOHADA — à conserver au dossier des immobilisations.',
          fontSize: 7, italics: true, color: GRIS, alignment: 'center' },
      ],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: NOIR },
    };

    const buffer = await pdfmake.createPdf(docDef).getBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Amortissement_${immo.numero_inventaire}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Erreur PDF tableau amortissement:', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur PDF' });
  }
};

module.exports = {
  immobilisationRules,
  getCategories,
  getImmobilisations, getImmobilisationById, createImmobilisation, updateImmobilisation, deleteImmobilisation,
  genererDotationsAnnee, supprimerDotation,
  cederImmobilisation,
  getStats,
  creerDepuisDepense,
  getTableauAmortissementPDF,
};
