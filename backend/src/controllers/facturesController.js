const pool = require('../../config/database');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { ecritureFacture, ecriturePaiementFacture } = require('../utils/comptabilite-auto');
const { ComptaError } = require('../utils/comptabilite');
const { appliquerMouvement } = require('./produitsController');

const factureRules = [
  body('client_id').notEmpty().withMessage('Client requis').isUUID().withMessage('Client invalide'),
  body('type').optional().isIn(['facture','devis','avoir','proforma']).withMessage('Type invalide'),
  body('taux_tva').optional().isFloat({ min: 0, max: 100 }).withMessage('TVA invalide'),
  body('valider_immediatement').optional().isBoolean().withMessage('valider_immediatement doit être un booléen'),
  body('facture_origine_id').optional({ nullable: true, checkFalsy: true }).isUUID().withMessage('Référence facture origine invalide'),
  body('lignes').isArray({ min: 1 }).withMessage('Au moins une ligne requise'),
  body('lignes.*.description').notEmpty().withMessage('Description ligne requise'),
  body('lignes.*.prix_unitaire').isFloat({ min: 0 }).withMessage('Prix unitaire invalide'),
  body('lignes.*.quantite').optional().isFloat({ min: 0.001 }).withMessage('Quantité invalide'),
  body('lignes.*.remise').optional().isFloat({ min: 0, max: 100 }).withMessage('Remise invalide (0-100)'),
];

const paiementRules = [
  body('montant').isFloat({ min: 0.01 }).withMessage('Montant invalide'),
  body('mode_paiement').optional().isIn(['cash','virement','cheque','mobile_money','carte']),
  body('compte_tresorerie_id').optional({ nullable: true, checkFalsy: true }).isUUID().withMessage('Compte trésorerie invalide'),
];

// GET /api/factures
const getFactures = async (req, res) => {
  try {
    const { statut, client_id, search, type, page = 1, limit = 20, date_debut, date_fin } = req.query;
    const eid = req.entrepriseId;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const offset   = (pageNum - 1) * limitNum;

    await pool.query(
      `UPDATE factures SET statut='retard', updated_at=NOW()
       WHERE entreprise_id=$1 AND statut='en_attente' AND date_echeance < CURRENT_DATE`,
      [eid]
    );

    const conditions = ['f.entreprise_id = $1'];
    const params     = [eid];

    if (statut)    { params.push(statut);    conditions.push(`f.statut = $${params.length}`); }
    if (type)      { params.push(type);      conditions.push(`f.type = $${params.length}`); }
    if (client_id) { params.push(client_id); conditions.push(`f.client_id = $${params.length}`); }
    if (date_debut){ params.push(date_debut);conditions.push(`f.date_emission >= $${params.length}`); }
    if (date_fin)  { params.push(date_fin);  conditions.push(`f.date_emission <= $${params.length}`); }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(f.numero ILIKE $${params.length} OR c.nom ILIKE $${params.length})`);
    }

    const where = conditions.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM factures f
       LEFT JOIN clients c ON c.id = f.client_id
       WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT f.*, c.nom AS client_nom, c.code AS client_code, c.email AS client_email
       FROM factures f
       LEFT JOIN clients c ON c.id = f.client_id
       WHERE ${where}
       ORDER BY f.date_emission DESC, f.created_at DESC
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
    console.error('Erreur getFactures:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/factures/:id
const getFactureById = async (req, res) => {
  try {
    const { id } = req.params;
    const factureRes = await pool.query(
      `SELECT f.*,
        c.nom AS client_nom, c.email AS client_email, c.telephone AS client_telephone,
        c.adresse AS client_adresse, c.ville AS client_ville, c.ninea AS client_ninea,
        e.nom AS entreprise_nom, e.adresse AS entreprise_adresse, e.ville AS entreprise_ville,
        e.telephone AS entreprise_tel, e.ninea AS entreprise_ninea, e.rccm AS entreprise_rccm
       FROM factures f
       LEFT JOIN clients c ON c.id = f.client_id
       LEFT JOIN entreprises e ON e.id = f.entreprise_id
       WHERE f.id=$1 AND f.entreprise_id=$2`,
      [id, req.entrepriseId]
    );
    if (factureRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    const lignes = await pool.query('SELECT * FROM lignes_facture WHERE facture_id=$1 ORDER BY ordre', [id]);
    const paiements = await pool.query('SELECT * FROM paiements WHERE facture_id=$1 ORDER BY date_paiement DESC', [id]);
    res.json({ success: true, data: { ...factureRes.rows[0], lignes: lignes.rows, paiements: paiements.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/factures
const createFacture = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;
    const {
      client_id, type = 'facture', date_emission, date_echeance,
      lignes = [], taux_tva = 18, notes, conditions_paiement,
      valider_immediatement = false, facture_origine_id = null,
    } = req.body;

    // Avoir : la référence à la facture d'origine est obligatoire (SYSCOHADA)
    if (type === 'avoir' && !facture_origine_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "Un avoir doit obligatoirement référencer la facture d'origine",
      });
    }
    // Vérifier que facture_origine_id, s'il est fourni, appartient à cette entreprise
    // et est bien une facture (pas un devis/avoir). Sans cela, un utilisateur peut
    // lier son avoir à une facture d'un autre tenant et exposer son numéro.
    if (facture_origine_id) {
      const orig = await client.query(
        `SELECT id FROM factures WHERE id = $1 AND entreprise_id = $2 AND type = 'facture'`,
        [facture_origine_id, eid]
      );
      if (!orig.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: "Facture d'origine introuvable" });
      }
    }

    // Devis et proforma ne sont jamais comptabilisés : statut bloqué à 'brouillon'
    const peutValider = type === 'facture' || type === 'avoir';
    const statutInitial = (valider_immediatement && peutValider) ? 'envoyee' : 'brouillon';

    // Vérifier que le client appartient à cette entreprise
    const clientCheck = await client.query(
      'SELECT id FROM clients WHERE id=$1 AND entreprise_id=$2 AND actif=true',
      [client_id, eid]
    );
    if (clientCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Client introuvable ou inactif' });
    }

    // Numéro auto — LOCK TABLE pour éviter les doublons concurrents (pas de FOR UPDATE sur COUNT)
    // Le préfixe d'année reflète la date d'émission (date_emission), pas la date système,
    // pour qu'une facture datée 2027 reçoive bien F-2027-001 (cas après clôture de N).
    await client.query('LOCK TABLE factures IN SHARE ROW EXCLUSIVE MODE');
    const year = new Date(date_emission || new Date()).getFullYear();
    const countRes = await client.query(
      `SELECT COUNT(*) FROM factures WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_emission)=$2`,
      [eid, year]
    );
    const prefix = type === 'devis' ? 'D' : type === 'avoir' ? 'AV' : type === 'proforma' ? 'PRO' : 'F';
    const numero = `${prefix}-${year}-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;

    // Calcul totaux
    let sous_total = 0;
    for (const l of lignes) {
      const remise = Math.min(100, Math.max(0, parseFloat(l.remise) || 0));
      sous_total += (parseFloat(l.quantite) || 1) * (parseFloat(l.prix_unitaire) || 0) * (1 - remise / 100);
    }
    const tvaNorm = Math.min(100, Math.max(0, parseFloat(taux_tva)));
    const montant_tva = sous_total * (tvaNorm / 100);
    const total_ttc = sous_total + montant_tva;

    // Devis et proforma démarrent leur cycle de vie commercial à "en_attente"
    const devisStatut = (type === 'devis' || type === 'proforma') ? 'en_attente' : null;

    const factureRes = await client.query(
      `INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
        date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc, notes, conditions_paiement, facture_origine_id, devis_statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        eid, client_id, req.user.id, numero, type, statutInitial,
        date_emission || new Date().toISOString().split('T')[0],
        date_echeance || null,
        Math.round(sous_total * 100) / 100, tvaNorm,
        Math.round(montant_tva * 100) / 100,
        Math.round(total_ttc * 100) / 100,
        notes || null, conditions_paiement || 'Paiement à 30 jours',
        facture_origine_id || null,
        devisStatut,
      ]
    );
    const facture = factureRes.rows[0];

    const lignesAvecProduit = [];
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      const remise = Math.min(100, Math.max(0, parseFloat(l.remise) || 0));
      const qte = parseFloat(l.quantite) || 1;
      const pu = parseFloat(l.prix_unitaire) || 0;
      const total = Math.round(qte * pu * (1 - remise / 100) * 100) / 100;
      await client.query(
        `INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre, produit_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [facture.id, l.description.trim(), qte, l.unite || 'unité', pu, remise, total, i, l.produit_id || null]
      );
      if (l.produit_id) lignesAvecProduit.push({ produit_id: l.produit_id, quantite: qte, total });
    }

    // Validation immédiate : écriture comptable + sortie de stock pour les lignes produits
    if (statutInitial === 'envoyee') {
      await ecritureFacture(client, {
        entrepriseId: eid,
        utilisateurId: req.user.id,
        facture,
      });
      // Avoirs : on inverse le sens (retour en stock)
      const sensStock = facture.type === 'avoir' ? 'entree' : 'sortie';
      for (const lp of lignesAvecProduit) {
        try {
          await appliquerMouvement(client, {
            entrepriseId: eid,
            produitId: lp.produit_id,
            sens: sensStock,
            quantite: lp.quantite,
            sourceType: facture.type === 'avoir' ? 'retour' : 'vente',
            sourceId: facture.id,
            libelle: `${facture.type === 'avoir' ? 'Retour' : 'Vente'} - ${facture.numero}`,
            reference: facture.numero,
            date: facture.date_emission,
            creePar: req.user?.id,
          });
        } catch (err) {
          console.warn('[stock] mouvement facture échoué:', err.message);
        }
      }
    }

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'factures', facture.id, {
      numero: facture.numero, type: facture.type, total_ttc: facture.total_ttc, client_id,
      statut: facture.statut,
    });
    res.status(201).json({ success: true, data: facture });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur createFacture:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// PUT /api/factures/:id — modification d'une facture EN BROUILLON uniquement.
// Une facture validée (envoyée/payée/etc.) est déjà comptabilisée et ne peut
// pas être modifiée : il faut alors émettre un avoir (SYSCOHADA).
const updateFacture = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const eid = req.entrepriseId;
    const {
      client_id, type = 'facture', date_emission, date_echeance,
      lignes = [], taux_tva = 18, notes, conditions_paiement,
      facture_origine_id = null,
    } = req.body;

    const factureRes = await client.query(
      'SELECT * FROM factures WHERE id=$1 AND entreprise_id=$2 FOR UPDATE',
      [id, eid]
    );
    if (factureRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    const ancienne = factureRes.rows[0];

    if (ancienne.statut !== 'brouillon') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "Seules les factures en brouillon peuvent être modifiées. Émettez un avoir pour corriger une facture validée.",
      });
    }

    if (type === 'avoir' && !facture_origine_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: "Un avoir doit obligatoirement référencer la facture d'origine",
      });
    }
    if (facture_origine_id) {
      const orig = await client.query(
        `SELECT id FROM factures WHERE id = $1 AND entreprise_id = $2 AND type = 'facture'`,
        [facture_origine_id, eid]
      );
      if (!orig.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: "Facture d'origine introuvable" });
      }
    }

    const clientCheck = await client.query(
      'SELECT id FROM clients WHERE id=$1 AND entreprise_id=$2 AND actif=true',
      [client_id, eid]
    );
    if (clientCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Client introuvable ou inactif' });
    }

    let sous_total = 0;
    for (const l of lignes) {
      const remise = Math.min(100, Math.max(0, parseFloat(l.remise) || 0));
      sous_total += (parseFloat(l.quantite) || 1) * (parseFloat(l.prix_unitaire) || 0) * (1 - remise / 100);
    }
    const tvaNorm = Math.min(100, Math.max(0, parseFloat(taux_tva)));
    const montant_tva = sous_total * (tvaNorm / 100);
    const total_ttc = sous_total + montant_tva;

    // Régénérer le numéro si le type ou l'année d'émission changent.
    // Sans cela, un brouillon F-2026-005 basculé en avoir reste F- (non SYSCOHADA),
    // ou redaté en 2027 garde son préfixe 2026 (collision possible sur la séquence
    // de l'ancienne année car cette facture ne contribue plus au COUNT).
    let nouveauNumero = ancienne.numero;
    const nouvelleDateEmission = date_emission || ancienne.date_emission;
    const ancienneAnnee = new Date(ancienne.date_emission).getFullYear();
    const nouvelleAnnee = new Date(nouvelleDateEmission).getFullYear();
    const typeChange = type !== ancienne.type;
    const anneeChange = ancienneAnnee !== nouvelleAnnee;
    if (typeChange || anneeChange) {
      await client.query('LOCK TABLE factures IN SHARE ROW EXCLUSIVE MODE');
      const countRes = await client.query(
        `SELECT COUNT(*) FROM factures
          WHERE entreprise_id = $1
            AND EXTRACT(YEAR FROM date_emission) = $2
            AND id <> $3`,
        [eid, nouvelleAnnee, id]
      );
      const prefix = type === 'devis' ? 'D' : type === 'avoir' ? 'AV' : type === 'proforma' ? 'PRO' : 'F';
      nouveauNumero = `${prefix}-${nouvelleAnnee}-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;
    }

    const updateRes = await client.query(
      `UPDATE factures
         SET client_id=$1, type=$2, numero=$3, date_emission=$4, date_echeance=$5,
             sous_total=$6, taux_tva=$7, montant_tva=$8, total_ttc=$9,
             notes=$10, conditions_paiement=$11, facture_origine_id=$12,
             updated_at=NOW()
       WHERE id=$13 AND entreprise_id=$14
       RETURNING *`,
      [
        client_id, type, nouveauNumero,
        nouvelleDateEmission,
        date_echeance || null,
        Math.round(sous_total * 100) / 100, tvaNorm,
        Math.round(montant_tva * 100) / 100,
        Math.round(total_ttc * 100) / 100,
        notes || null, conditions_paiement || 'Paiement à 30 jours',
        facture_origine_id || null,
        id, eid,
      ]
    );
    const facture = updateRes.rows[0];

    // Brouillon = pas d'écriture comptable ni de mouvement de stock à annuler :
    // on remplace simplement les lignes.
    await client.query('DELETE FROM lignes_facture WHERE facture_id=$1', [id]);
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      const remise = Math.min(100, Math.max(0, parseFloat(l.remise) || 0));
      const qte = parseFloat(l.quantite) || 1;
      const pu = parseFloat(l.prix_unitaire) || 0;
      const total = Math.round(qte * pu * (1 - remise / 100) * 100) / 100;
      await client.query(
        `INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre, produit_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, l.description.trim(), qte, l.unite || 'unité', pu, remise, total, i, l.produit_id || null]
      );
    }

    await client.query('COMMIT');
    logAudit(req, 'UPDATE', 'factures', id, {
      numero: facture.numero, type: facture.type, total_ttc: facture.total_ttc, client_id,
    });
    res.json({ success: true, data: facture });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur updateFacture:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// PUT /api/factures/:id/statut
const updateStatut = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { statut } = req.body;
    const valid = ['brouillon', 'envoyee', 'payee', 'en_attente', 'retard', 'annulee'];
    if (!valid.includes(statut)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    }

    // On a besoin du statut précédent pour décider s'il faut générer l'écriture
    const avant = await client.query(
      'SELECT statut FROM factures WHERE id=$1 AND entreprise_id=$2',
      [id, req.entrepriseId]
    );
    if (avant.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    const ancienStatut = avant.rows[0].statut;

    const result = await client.query(
      'UPDATE factures SET statut=$1, updated_at=NOW() WHERE id=$2 AND entreprise_id=$3 RETURNING *',
      [statut, id, req.entrepriseId]
    );
    const facture = result.rows[0];

    // Génération auto de l'écriture comptable à la première sortie de "brouillon"
    if (ancienStatut === 'brouillon' && statut !== 'brouillon' && statut !== 'annulee') {
      await ecritureFacture(client, {
        entrepriseId: req.entrepriseId,
        utilisateurId: req.user.id,
        facture,
      });

      // Sortie de stock pour les lignes liées à un produit du catalogue
      const lignesProd = await client.query(
        `SELECT produit_id, quantite FROM lignes_facture
         WHERE facture_id = $1 AND produit_id IS NOT NULL`,
        [id]
      );
      const sensStock = facture.type === 'avoir' ? 'entree' : 'sortie';
      for (const lp of lignesProd.rows) {
        try {
          await appliquerMouvement(client, {
            entrepriseId: req.entrepriseId,
            produitId: lp.produit_id,
            sens: sensStock,
            quantite: parseFloat(lp.quantite),
            sourceType: facture.type === 'avoir' ? 'retour' : 'vente',
            sourceId: facture.id,
            libelle: `${facture.type === 'avoir' ? 'Retour' : 'Vente'} - ${facture.numero}`,
            reference: facture.numero,
            date: facture.date_emission,
            creePar: req.user?.id,
          });
        } catch (err) {
          console.warn('[stock] mouvement updateStatut échoué:', err.message);
        }
      }
    }

    await client.query('COMMIT');
    logAudit(req, 'UPDATE', 'factures', id, { champ: 'statut', ancien: ancienStatut, nouveau: statut, numero: facture.numero });
    res.json({ success: true, data: facture });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur updateStatut:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// POST /api/factures/:id/paiement
const addPaiement = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const {
      montant, date_paiement, mode_paiement = 'virement', reference, notes,
      compte_tresorerie_id,
    } = req.body;

    const factureRes = await client.query(
      'SELECT * FROM factures WHERE id=$1 AND entreprise_id=$2 FOR UPDATE',
      [id, req.entrepriseId]
    );
    if (factureRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }
    const facture = factureRes.rows[0];

    if (facture.statut === 'annulee') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Impossible de payer une facture annulée' });
    }

    const montantNum = Math.round(parseFloat(montant) * 100) / 100;
    const nouveauPaye = Math.round((parseFloat(facture.montant_paye) + montantNum) * 100) / 100;
    const ttc = parseFloat(facture.total_ttc);

    if (nouveauPaye > ttc + 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Montant dépasse le total TTC (${ttc} FCFA)`,
      });
    }

    // Résolution du compte de trésorerie : explicite, sinon défaut selon mode
    let compteId = compte_tresorerie_id || null;
    if (!compteId) {
      const typeAttendu = mode_paiement === 'cash' ? 'caisse'
        : mode_paiement === 'mobile_money' ? 'mobile_money'
        : 'banque';
      const r = await client.query(
        `SELECT id FROM comptes_tresorerie
         WHERE entreprise_id = $1 AND par_defaut = TRUE AND archived_at IS NULL
           AND (type = $2 OR type = 'banque')
         ORDER BY (type = $2) DESC LIMIT 1`,
        [req.entrepriseId, typeAttendu]
      );
      compteId = r.rows[0]?.id || null;
    } else {
      // Validation que le compte existe et appartient bien à l'entreprise
      const r = await client.query(
        `SELECT id FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2 AND archived_at IS NULL`,
        [compteId, req.entrepriseId]
      );
      if (!r.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Compte de trésorerie invalide' });
      }
    }

    const paiementRes = await client.query(
      `INSERT INTO paiements (facture_id, montant, date_paiement, mode_paiement, reference, notes, compte_tresorerie_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, montantNum, date_paiement || new Date().toISOString().split('T')[0],
       mode_paiement, reference || null, notes || null, compteId]
    );
    const paiement = paiementRes.rows[0];

    const nouveauStatut = nouveauPaye >= ttc - 0.01 ? 'payee' : 'en_attente';
    await client.query(
      'UPDATE factures SET montant_paye=$1, statut=$2, updated_at=NOW() WHERE id=$3',
      [nouveauPaye, nouveauStatut, id]
    );

    // Génération auto du mouvement de trésorerie (encaissement)
    if (compteId) {
      await client.query(
        `INSERT INTO mouvements_tresorerie
          (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, source_id, cree_par)
         VALUES ($1,$2,$3,'entree',$4,$5,$6,'paiement_facture',$7,$8)`,
        [req.entrepriseId, compteId, paiement.date_paiement, montantNum,
         `Encaissement facture ${facture.numero}`, reference || facture.numero, paiement.id, req.user?.id]
      );
    }

    // Génération auto de l'écriture comptable d'encaissement
    await ecriturePaiementFacture(client, {
      entrepriseId: req.entrepriseId,
      utilisateurId: req.user.id,
      facture, paiement,
    });

    await client.query('COMMIT');
    logAudit(req, 'PAY', 'factures', id, {
      numero: facture.numero, montant: montantNum, mode_paiement,
      total_paye: nouveauPaye, statut: nouveauStatut, compte_tresorerie_id: compteId,
    });
    res.json({ success: true, statut: nouveauStatut, montant_paye: nouveauPaye });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur addPaiement:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// DELETE /api/factures/:id
const deleteFacture = async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM factures WHERE id=$1 AND entreprise_id=$2 AND statut='brouillon' RETURNING id`,
      [req.params.id, req.entrepriseId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture introuvable ou non supprimable (brouillons uniquement)',
      });
    }
    logAudit(req, 'DELETE', 'factures', req.params.id);
    res.json({ success: true, message: 'Facture supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { getFactures, getFactureById, createFacture, updateFacture, updateStatut, addPaiement, deleteFacture, factureRules, paiementRules };