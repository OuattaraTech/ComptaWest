const pool = require('../../config/database');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const round3 = (n) => Math.round((parseFloat(n) || 0) * 1000) / 1000;

const produitRules = [
  body('code').trim().notEmpty().withMessage('Code requis').isLength({ max: 40 }),
  body('libelle').trim().notEmpty().withMessage('Libellé requis').isLength({ max: 200 }),
  body('type').optional().isIn(['produit', 'service']),
  body('prix_vente_ht').optional().isFloat({ min: 0 }),
];

// ─── CATÉGORIES ────────────────────────────────────────────────────────────
const getCategories = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM categories_produits WHERE entreprise_id = $1 ORDER BY ordre, libelle`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Erreur getCategories produits:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

const createCategorie = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const b = req.body;
    if (!b.code || !b.libelle) {
      return res.status(400).json({ success: false, message: 'Code et libellé requis' });
    }
    const r = await pool.query(
      `INSERT INTO categories_produits (entreprise_id, code, libelle, type,
         compte_vente, compte_achat, compte_stock, taux_tva, ordre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [eid, b.code, b.libelle, b.type || 'produit',
       b.compte_vente || null, b.compte_achat || null, b.compte_stock || null,
       b.taux_tva ?? 18, b.ordre || 100]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Code déjà utilisé' });
    }
    console.error('Erreur createCategorie produits:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── PRODUITS ──────────────────────────────────────────────────────────────

const generateCodeProduit = async (entrepriseId, prefix = 'P') => {
  const r = await pool.query(
    `SELECT COUNT(*) FROM produits WHERE entreprise_id = $1`,
    [entrepriseId]
  );
  const seq = String(parseInt(r.rows[0].count) + 1).padStart(4, '0');
  return `${prefix}-${seq}`;
};

const getProduits = async (req, res) => {
  try {
    const { search, type, categorie_id, alerte, page = 1, limit = 100 } = req.query;
    const eid = req.entrepriseId;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let query = `
      SELECT p.*, c.libelle AS categorie_libelle
      FROM produits p
      LEFT JOIN categories_produits c ON c.id = p.categorie_id
      WHERE p.entreprise_id = $1 AND p.archived_at IS NULL AND p.actif = TRUE
    `;
    const params = [eid];

    if (type)         { params.push(type);         query += ` AND p.type = $${params.length}`; }
    if (categorie_id) { params.push(categorie_id); query += ` AND p.categorie_id = $${params.length}`; }
    if (alerte === 'true') {
      query += ` AND p.seuil_alerte IS NOT NULL AND p.stock_actuel <= p.seuil_alerte AND p.type = 'produit'`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (p.libelle ILIKE $${params.length} OR p.code ILIKE $${params.length}
                  OR p.reference_externe ILIKE $${params.length})`;
    }

    const countQuery = query.replace(/SELECT.*?FROM produits/s, 'SELECT COUNT(*) FROM produits');
    const countRes = await pool.query(countQuery, params);

    params.push(parseInt(limit), offset);
    query += ` ORDER BY p.libelle LIMIT $${params.length - 1} OFFSET $${params.length}`;

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
    console.error('Erreur getProduits:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

const getProduitById = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `SELECT p.*, c.libelle AS categorie_libelle
       FROM produits p
       LEFT JOIN categories_produits c ON c.id = p.categorie_id
       WHERE p.id = $1 AND p.entreprise_id = $2`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Produit introuvable' });

    // Derniers mouvements de stock
    const mvts = await pool.query(
      `SELECT * FROM mouvements_stock WHERE produit_id = $1 ORDER BY date_mouvement DESC, created_at DESC LIMIT 50`,
      [id]
    );
    res.json({ success: true, data: { ...r.rows[0], mouvements: mvts.rows } });
  } catch (err) {
    console.error('Erreur getProduitById:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

const createProduit = async (req, res) => {
  const client = await pool.connect();
  try {
    const eid = req.entrepriseId;
    const b = req.body;

    // Hérite des comptes/TVA depuis la catégorie
    let cat = null;
    if (b.categorie_id) {
      const cr = await pool.query(
        `SELECT * FROM categories_produits WHERE id = $1 AND entreprise_id = $2`,
        [b.categorie_id, eid]
      );
      cat = cr.rows[0];
    }

    const type = b.type || cat?.type || 'produit';
    const code = b.code || await generateCodeProduit(eid, type === 'service' ? 'SRV' : 'P');
    const stockInitial = type === 'produit' ? round3(b.stock_initial || 0) : 0;
    const prixAchat = round2(b.prix_achat_ht || 0);

    await client.query('BEGIN');

    const r = await client.query(
      `INSERT INTO produits (
        entreprise_id, code, libelle, description, type, categorie_id,
        prix_vente_ht, prix_achat_ht, taux_tva, unite,
        stock_initial, stock_actuel, seuil_alerte, cmp, valeur_stock,
        methode_valorisation, compte_vente, compte_achat, compte_stock,
        reference_externe, fournisseur_principal, notes, cree_par
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [
        eid, code, b.libelle, b.description || null, type, b.categorie_id || null,
        round2(b.prix_vente_ht || 0), prixAchat,
        b.taux_tva ?? cat?.taux_tva ?? 18, b.unite || 'unité',
        stockInitial, stockInitial, b.seuil_alerte ? round3(b.seuil_alerte) : null,
        prixAchat, round2(stockInitial * prixAchat),
        b.methode_valorisation || 'CMP',
        b.compte_vente || cat?.compte_vente || null,
        b.compte_achat || cat?.compte_achat || null,
        b.compte_stock || cat?.compte_stock || null,
        b.reference_externe || null, b.fournisseur_principal || null,
        b.notes || null, req.user?.id,
      ]
    );

    // Si stock initial > 0, crée un mouvement d'entrée d'origine
    if (stockInitial > 0 && type === 'produit') {
      await client.query(
        `INSERT INTO mouvements_stock (
          entreprise_id, produit_id, date_mouvement, sens, quantite, prix_unitaire,
          valeur_totale, stock_apres, cmp_apres, source_type, libelle, cree_par
        ) VALUES ($1,$2,CURRENT_DATE,'entree',$3,$4,$5,$3,$4,'initial','Stock initial',$6)`,
        [eid, r.rows[0].id, stockInitial, prixAchat,
         round2(stockInitial * prixAchat), req.user?.id]
      );
    }

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'produits', r.rows[0].id, { code, libelle: b.libelle });
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Code déjà utilisé' });
    }
    console.error('Erreur createProduit:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création produit' });
  } finally {
    client.release();
  }
};

const updateProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const b = req.body;
    // On ne modifie pas stock_actuel/cmp via update direct (uniquement via mouvements)
    const r = await pool.query(
      `UPDATE produits SET
        libelle = COALESCE($1, libelle),
        description = $2,
        categorie_id = COALESCE($3, categorie_id),
        prix_vente_ht = COALESCE($4, prix_vente_ht),
        prix_achat_ht = COALESCE($5, prix_achat_ht),
        taux_tva = COALESCE($6, taux_tva),
        unite = COALESCE($7, unite),
        seuil_alerte = $8,
        methode_valorisation = COALESCE($9, methode_valorisation),
        compte_vente = $10, compte_achat = $11, compte_stock = $12,
        reference_externe = $13, fournisseur_principal = $14,
        notes = $15, actif = COALESCE($16, actif),
        updated_at = NOW()
       WHERE id = $17 AND entreprise_id = $18 RETURNING *`,
      [b.libelle, b.description || null, b.categorie_id || null,
       b.prix_vente_ht !== undefined ? round2(b.prix_vente_ht) : null,
       b.prix_achat_ht !== undefined ? round2(b.prix_achat_ht) : null,
       b.taux_tva, b.unite,
       b.seuil_alerte !== undefined ? (b.seuil_alerte ? round3(b.seuil_alerte) : null) : null,
       b.methode_valorisation,
       b.compte_vente || null, b.compte_achat || null, b.compte_stock || null,
       b.reference_externe || null, b.fournisseur_principal || null,
       b.notes || null, b.actif,
       id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Introuvable' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur updateProduit:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

const archiveProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `UPDATE produits SET archived_at = NOW(), actif = FALSE
       WHERE id = $1 AND entreprise_id = $2 RETURNING id`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Introuvable' });
    logAudit(req, 'DELETE', 'produits', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur archiveProduit:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── MOUVEMENTS DE STOCK ───────────────────────────────────────────────────

/**
 * Helper interne : applique un mouvement à un produit, recalcule CMP/stock,
 * et insère la ligne dans mouvements_stock. Tourne dans une transaction donnée.
 *
 *   sens     : 'entree' | 'sortie' | 'ajustement'
 *   quantite : > 0 ; pour 'ajustement', signe libre via valeurAjustement
 *   prix     : prix unitaire (pour entrées : coût d'achat ; pour sorties : ignoré → CMP courant)
 *
 * Recalcul CMP (norme SYSCOHADA) :
 *   nouveau_cmp = (stock × cmp + quantite_entree × prix_entree) / (stock + quantite_entree)
 */
const appliquerMouvement = async (client, {
  entrepriseId, produitId, sens, quantite, prix = null, sourceType = 'manuel',
  sourceId = null, libelle = '', reference = null, date = null, creePar = null,
}) => {
  // Lock + récupération du produit
  const prodRes = await client.query(
    `SELECT * FROM produits WHERE id = $1 AND entreprise_id = $2 FOR UPDATE`,
    [produitId, entrepriseId]
  );
  if (!prodRes.rows[0]) throw new Error('Produit introuvable');
  const p = prodRes.rows[0];
  if (p.type !== 'produit') throw new Error('Pas de stock pour un service');

  const qte = round3(Math.abs(quantite));
  const stockAvant = parseFloat(p.stock_actuel) || 0;
  const cmpAvant = parseFloat(p.cmp) || 0;

  let stockApres, cmpApres, prixUnit, valeurTotale;

  if (sens === 'entree') {
    prixUnit = prix !== null ? round2(prix) : (parseFloat(p.prix_achat_ht) || 0);
    stockApres = round3(stockAvant + qte);
    // CMP pondéré
    const valeurAvant = stockAvant * cmpAvant;
    const valeurAjout = qte * prixUnit;
    cmpApres = stockApres > 0 ? Math.round(((valeurAvant + valeurAjout) / stockApres) * 10000) / 10000 : 0;
    valeurTotale = round2(valeurAjout);
  } else if (sens === 'sortie') {
    if (qte > stockAvant + 0.001) {
      throw new Error(`Stock insuffisant pour ${p.libelle} : ${stockAvant} disponible, ${qte} demandé`);
    }
    prixUnit = round2(cmpAvant);
    stockApres = round3(stockAvant - qte);
    cmpApres = cmpAvant;  // CMP inchangé lors d'une sortie
    valeurTotale = round2(qte * cmpAvant);
  } else {
    // Ajustement : 'quantite' peut être négatif si on saisit la valeur signée
    const signedQte = parseFloat(quantite);  // garde le signe original
    stockApres = round3(stockAvant + signedQte);
    if (stockApres < -0.001) throw new Error('Ajustement créerait un stock négatif');
    prixUnit = prix !== null ? round2(prix) : cmpAvant;
    cmpApres = cmpAvant;
    valeurTotale = round2(Math.abs(signedQte) * prixUnit);
  }

  // Insertion du mouvement
  const mvtRes = await client.query(
    `INSERT INTO mouvements_stock (
      entreprise_id, produit_id, date_mouvement, sens, quantite,
      prix_unitaire, valeur_totale, stock_apres, cmp_apres,
      source_type, source_id, libelle, reference, cree_par
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [entrepriseId, produitId, date || new Date(), sens, qte, prixUnit, valeurTotale,
     stockApres, cmpApres, sourceType, sourceId, libelle || `${sens === 'entree' ? 'Entrée' : sens === 'sortie' ? 'Sortie' : 'Ajustement'} stock`,
     reference, creePar]
  );

  // Mise à jour du produit (stock + CMP + valeur)
  await client.query(
    `UPDATE produits SET stock_actuel = $1, cmp = $2, valeur_stock = $3, updated_at = NOW()
     WHERE id = $4`,
    [stockApres, cmpApres, round2(stockApres * cmpApres), produitId]
  );

  return mvtRes.rows[0];
};

// POST /api/produits/:id/mouvement (saisie manuelle)
const creerMouvement = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const { sens, quantite, prix_unitaire, date_mouvement, libelle, reference } = req.body;

    if (!sens || !['entree', 'sortie', 'ajustement'].includes(sens)) {
      return res.status(400).json({ success: false, message: 'Sens invalide' });
    }
    if (!quantite || (sens !== 'ajustement' && parseFloat(quantite) <= 0)) {
      return res.status(400).json({ success: false, message: 'Quantité requise' });
    }

    await client.query('BEGIN');
    const mvt = await appliquerMouvement(client, {
      entrepriseId: eid,
      produitId: id,
      sens,
      quantite,
      prix: prix_unitaire,
      sourceType: 'manuel',
      libelle, reference,
      date: date_mouvement,
      creePar: req.user?.id,
    });
    await client.query('COMMIT');

    logAudit(req, 'STOCK_MOVE', 'produits', id, { sens, quantite });
    res.status(201).json({ success: true, data: mvt });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur creerMouvement:', err.message);
    res.status(400).json({ success: false, message: err.message || 'Erreur' });
  } finally {
    client.release();
  }
};

// GET /api/produits/:id/mouvements
const getMouvementsProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const check = await pool.query(
      `SELECT id FROM produits WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!check.rows[0]) return res.status(404).json({ success: false, message: 'Produit introuvable' });

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM mouvements_stock WHERE produit_id = $1`,
      [id]
    );
    const r = await pool.query(
      `SELECT * FROM mouvements_stock WHERE produit_id = $1
       ORDER BY date_mouvement DESC, created_at DESC LIMIT $2 OFFSET $3`,
      [id, parseInt(limit), offset]
    );
    res.json({
      success: true, data: r.rows,
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page), limit: parseInt(limit),
        pages: Math.ceil(countRes.rows[0].count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Erreur getMouvementsProduit:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// GET /api/produits/stocks/mouvements (journal global)
const getJournalMouvements = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const { sens, produit_id, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let query = `
      SELECT m.*, p.code AS produit_code, p.libelle AS produit_libelle, p.unite
      FROM mouvements_stock m
      JOIN produits p ON p.id = m.produit_id
      WHERE m.entreprise_id = $1
    `;
    const params = [eid];
    if (sens)        { params.push(sens);        query += ` AND m.sens = $${params.length}`; }
    if (produit_id)  { params.push(produit_id);  query += ` AND m.produit_id = $${params.length}`; }

    const countQuery = query.replace(/SELECT.*?FROM/s, 'SELECT COUNT(*) FROM');
    const countRes = await pool.query(countQuery, params);

    params.push(parseInt(limit), offset);
    query += ` ORDER BY m.date_mouvement DESC, m.created_at DESC
               LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const r = await pool.query(query, params);
    res.json({
      success: true, data: r.rows,
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page), limit: parseInt(limit),
        pages: Math.ceil(countRes.rows[0].count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Erreur getJournalMouvements:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── INVENTAIRES PHYSIQUES ─────────────────────────────────────────────────

// POST /api/produits/inventaires (crée un inventaire vide avec snapshot du stock)
const creerInventaire = async (req, res) => {
  const client = await pool.connect();
  try {
    const eid = req.entrepriseId;
    const { date_inventaire, libelle } = req.body;
    const date = date_inventaire || new Date().toISOString().split('T')[0];

    await client.query('BEGIN');

    // Numéro auto
    const countRes = await client.query(
      `SELECT COUNT(*) FROM inventaires WHERE entreprise_id = $1 AND EXTRACT(YEAR FROM date_inventaire) = $2`,
      [eid, new Date(date).getFullYear()]
    );
    const numero = `INV-${new Date(date).getFullYear()}-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;

    const invRes = await client.query(
      `INSERT INTO inventaires (entreprise_id, numero, date_inventaire, libelle, statut, cree_par)
       VALUES ($1,$2,$3,$4,'brouillon',$5) RETURNING *`,
      [eid, numero, date, libelle || `Inventaire ${date}`, req.user?.id]
    );

    // Snapshot du stock théorique (produits actifs uniquement)
    const prodRes = await client.query(
      `SELECT * FROM produits WHERE entreprise_id = $1 AND archived_at IS NULL
        AND actif = TRUE AND type = 'produit' ORDER BY libelle`,
      [eid]
    );

    for (let i = 0; i < prodRes.rows.length; i++) {
      const p = prodRes.rows[i];
      const stock = parseFloat(p.stock_actuel) || 0;
      const cmp = parseFloat(p.cmp) || 0;
      const valeur = round2(stock * cmp);
      await client.query(
        `INSERT INTO lignes_inventaire
          (inventaire_id, produit_id, stock_theorique, stock_physique, ecart,
           cmp, valeur_theorique, valeur_physique, valeur_ecart, ordre)
         VALUES ($1,$2,$3,$3,0,$4,$5,$5,0,$6)`,
        [invRes.rows[0].id, p.id, stock, cmp, valeur, i]
      );
    }

    await client.query(
      `UPDATE inventaires SET nb_articles = $1, valeur_theorique = $2, valeur_physique = $2
       WHERE id = $3`,
      [prodRes.rows.length,
       prodRes.rows.reduce((s, p) => s + parseFloat(p.stock_actuel) * parseFloat(p.cmp), 0),
       invRes.rows[0].id]
    );

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'inventaires', invRes.rows[0].id, { numero, nb_lignes: prodRes.rows.length });
    res.status(201).json({ success: true, data: { ...invRes.rows[0], nb_lignes: prodRes.rows.length } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur creerInventaire:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création inventaire' });
  } finally {
    client.release();
  }
};

const getInventaires = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM inventaires WHERE entreprise_id = $1
       ORDER BY date_inventaire DESC, created_at DESC`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Erreur getInventaires:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

const getInventaireById = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const invRes = await pool.query(
      `SELECT * FROM inventaires WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!invRes.rows[0]) return res.status(404).json({ success: false, message: 'Inventaire introuvable' });

    const lignes = await pool.query(
      `SELECT li.*, p.code AS produit_code, p.libelle AS produit_libelle, p.unite, p.compte_stock
       FROM lignes_inventaire li
       JOIN produits p ON p.id = li.produit_id
       WHERE li.inventaire_id = $1 ORDER BY li.ordre`,
      [id]
    );
    res.json({ success: true, data: { ...invRes.rows[0], lignes: lignes.rows } });
  } catch (err) {
    console.error('Erreur getInventaireById:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// PUT /api/produits/inventaires/:id/lignes  (saisie en masse des stocks physiques)
const majLignesInventaire = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const { lignes } = req.body;
    if (!Array.isArray(lignes)) {
      return res.status(400).json({ success: false, message: 'lignes[] requis' });
    }

    const invRes = await pool.query(
      `SELECT statut FROM inventaires WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!invRes.rows[0]) return res.status(404).json({ success: false, message: 'Inventaire introuvable' });
    if (invRes.rows[0].statut !== 'brouillon') {
      return res.status(400).json({ success: false, message: 'Inventaire non modifiable' });
    }

    await client.query('BEGIN');
    let totalTheorique = 0, totalPhysique = 0;

    for (const l of lignes) {
      if (!l.id) continue;
      const physique = round3(l.stock_physique || 0);
      // Récupère le théorique + cmp
      const cur = await client.query(
        `SELECT stock_theorique, cmp FROM lignes_inventaire WHERE id = $1 AND inventaire_id = $2`,
        [l.id, id]
      );
      if (!cur.rows[0]) continue;
      const theorique = parseFloat(cur.rows[0].stock_theorique) || 0;
      const cmp = parseFloat(cur.rows[0].cmp) || 0;
      const ecart = round3(physique - theorique);
      const valTheo = round2(theorique * cmp);
      const valPhy = round2(physique * cmp);
      const valEcart = round2(ecart * cmp);

      await client.query(
        `UPDATE lignes_inventaire SET stock_physique = $1, ecart = $2,
           valeur_physique = $3, valeur_ecart = $4, notes = $5
         WHERE id = $6`,
        [physique, ecart, valPhy, valEcart, l.notes || null, l.id]
      );
      totalTheorique += valTheo;
      totalPhysique += valPhy;
    }

    await client.query(
      `UPDATE inventaires SET valeur_theorique = $1, valeur_physique = $2,
         ecart_total = $3, updated_at = NOW() WHERE id = $4`,
      [round2(totalTheorique), round2(totalPhysique),
       round2(totalPhysique - totalTheorique), id]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur majLignesInventaire:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  } finally {
    client.release();
  }
};

// POST /api/produits/inventaires/:id/valider
const validerInventaire = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    await client.query('BEGIN');

    const invRes = await client.query(
      `SELECT * FROM inventaires WHERE id = $1 AND entreprise_id = $2 FOR UPDATE`,
      [id, eid]
    );
    if (!invRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Introuvable' });
    }
    if (invRes.rows[0].statut !== 'brouillon') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Déjà validé' });
    }
    const inv = invRes.rows[0];

    // Pour chaque ligne avec écart : créer un mouvement d'ajustement
    const lignesRes = await client.query(
      `SELECT li.*, p.libelle AS produit_libelle
       FROM lignes_inventaire li
       JOIN produits p ON p.id = li.produit_id
       WHERE li.inventaire_id = $1 AND li.ecart != 0`,
      [id]
    );

    for (const l of lignesRes.rows) {
      const ecart = parseFloat(l.ecart);
      await appliquerMouvement(client, {
        entrepriseId: eid,
        produitId: l.produit_id,
        sens: 'ajustement',
        quantite: ecart,           // signé : + ou −
        prix: parseFloat(l.cmp),
        sourceType: 'inventaire',
        sourceId: id,
        libelle: `Inventaire ${inv.numero} - écart ${ecart > 0 ? '+' : ''}${ecart}`,
        date: inv.date_inventaire,
        creePar: req.user?.id,
      });
    }

    await client.query(
      `UPDATE inventaires SET statut = 'valide', date_validation = NOW(), valide_par = $1
       WHERE id = $2`,
      [req.user?.id, id]
    );
    await client.query('COMMIT');
    logAudit(req, 'VALIDATE', 'inventaires', id,
      { numero: inv.numero, nb_ecarts: lignesRes.rows.length });
    res.json({ success: true, data: { id, nb_ajustements: lignesRes.rows.length } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur validerInventaire:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Erreur' });
  } finally {
    client.release();
  }
};

const supprimerInventaire = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `DELETE FROM inventaires WHERE id = $1 AND entreprise_id = $2 AND statut = 'brouillon' RETURNING id`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(400).json({ success: false, message: 'Non supprimable (validé ou inexistant)' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur supprimerInventaire:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── STATS ────────────────────────────────────────────────────────────────
const getStatsProduits = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const annee = parseInt(req.query.annee) || new Date().getFullYear();

    const synth = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE type = 'produit')                 AS nb_produits,
        COUNT(*) FILTER (WHERE type = 'service')                 AS nb_services,
        COALESCE(SUM(valeur_stock), 0)                           AS valeur_stock_totale,
        COUNT(*) FILTER (WHERE type = 'produit' AND seuil_alerte IS NOT NULL
                          AND stock_actuel <= seuil_alerte)      AS nb_alertes,
        COUNT(*) FILTER (WHERE type = 'produit' AND stock_actuel <= 0) AS nb_ruptures
       FROM produits WHERE entreprise_id = $1 AND archived_at IS NULL AND actif = TRUE`,
      [eid]
    );

    const topVentes = await pool.query(
      `SELECT p.id, p.code, p.libelle, p.unite,
        COALESCE(SUM(m.quantite), 0)        AS qte_vendue,
        COALESCE(SUM(m.valeur_totale), 0)   AS valeur_vendue
       FROM produits p
       LEFT JOIN mouvements_stock m
         ON m.produit_id = p.id AND m.sens = 'sortie' AND m.source_type = 'vente'
         AND EXTRACT(YEAR FROM m.date_mouvement) = $2
       WHERE p.entreprise_id = $1 AND p.archived_at IS NULL
       GROUP BY p.id ORDER BY qte_vendue DESC LIMIT 10`,
      [eid, annee]
    );

    res.json({
      success: true,
      data: { ...synth.rows[0], top_ventes: topVentes.rows, annee },
    });
  } catch (err) {
    console.error('Erreur getStatsProduits:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

module.exports = {
  produitRules,
  // Catégories
  getCategories, createCategorie,
  // Produits
  getProduits, getProduitById, createProduit, updateProduit, archiveProduit,
  // Mouvements
  creerMouvement, getMouvementsProduit, getJournalMouvements,
  appliquerMouvement,  // export pour réutilisation par facturesController
  // Inventaires
  creerInventaire, getInventaires, getInventaireById,
  majLignesInventaire, validerInventaire, supprimerInventaire,
  // Stats
  getStatsProduits,
};
