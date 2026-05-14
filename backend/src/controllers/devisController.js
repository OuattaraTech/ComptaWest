const pool = require('../../config/database');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { ecritureFacture } = require('../utils/comptabilite-auto');
const { appliquerMouvement } = require('./produitsController');

// Marque comme "expire" tout devis encore en attente dont la validité est dépassée.
// Appelé au début de chaque lecture pour garder la liste à jour sans tâche cron.
const expirerDevis = async (eid) => {
  await pool.query(
    `UPDATE factures
       SET devis_statut = 'expire', updated_at = NOW()
     WHERE entreprise_id = $1
       AND type IN ('devis','proforma')
       AND devis_statut = 'en_attente'
       AND date_echeance IS NOT NULL
       AND date_echeance < CURRENT_DATE`,
    [eid]
  );
};

// GET /api/devis
const getDevis = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const { devis_statut, client_id, search, type, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const offset   = (pageNum - 1) * limitNum;

    await expirerDevis(eid);

    const conditions = ["f.entreprise_id = $1", "f.type IN ('devis','proforma')"];
    const params     = [eid];

    if (devis_statut) { params.push(devis_statut); conditions.push(`f.devis_statut = $${params.length}`); }
    if (type)         { params.push(type);         conditions.push(`f.type = $${params.length}`); }
    if (client_id)    { params.push(client_id);    conditions.push(`f.client_id = $${params.length}`); }
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
      `SELECT f.*, c.nom AS client_nom, c.code AS client_code, c.email AS client_email,
              fc.numero AS converti_numero, fc.statut AS converti_statut
       FROM factures f
       LEFT JOIN clients c  ON c.id = f.client_id
       LEFT JOIN factures fc ON fc.id = f.converti_facture_id
       WHERE ${where}
       ORDER BY f.date_emission DESC, f.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (err) {
    console.error('Erreur getDevis:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/devis/stats
const getStatsDevis = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    await expirerDevis(eid);

    const r = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE devis_statut = 'en_attente')::int AS en_attente,
         COUNT(*) FILTER (WHERE devis_statut = 'accepte')::int    AS accepte,
         COUNT(*) FILTER (WHERE devis_statut = 'refuse')::int     AS refuse,
         COUNT(*) FILTER (WHERE devis_statut = 'expire')::int     AS expire,
         COUNT(*) FILTER (WHERE devis_statut = 'converti')::int   AS converti,
         COALESCE(SUM(total_ttc) FILTER (WHERE devis_statut = 'en_attente'), 0) AS montant_pipeline,
         COALESCE(SUM(total_ttc) FILTER (WHERE devis_statut = 'converti'), 0)   AS montant_converti
       FROM factures
       WHERE entreprise_id = $1 AND type IN ('devis','proforma')`,
      [eid]
    );
    const s = r.rows[0];
    // Taux de transformation = devis convertis / devis ayant connu une issue
    const traites = s.converti + s.refuse + s.expire;
    s.taux_conversion = traites > 0 ? Math.round((s.converti / traites) * 100) : 0;

    res.json({ success: true, data: s });
  } catch (err) {
    console.error('Erreur getStatsDevis:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /api/devis/:id/statut
const updateDevisStatut = async (req, res) => {
  try {
    const { id } = req.params;
    const { devis_statut } = req.body;
    const valid = ['en_attente', 'accepte', 'refuse', 'expire'];
    if (!valid.includes(devis_statut)) {
      return res.status(400).json({ success: false, message: 'Statut de devis invalide' });
    }

    const avant = await pool.query(
      `SELECT numero, devis_statut FROM factures
       WHERE id = $1 AND entreprise_id = $2 AND type IN ('devis','proforma')`,
      [id, req.entrepriseId]
    );
    if (avant.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Devis introuvable' });
    }
    if (avant.rows[0].devis_statut === 'converti') {
      return res.status(400).json({
        success: false,
        message: 'Ce devis a déjà été converti en facture, son statut ne peut plus changer',
      });
    }

    const result = await pool.query(
      `UPDATE factures SET devis_statut = $1, updated_at = NOW()
       WHERE id = $2 AND entreprise_id = $3 RETURNING *`,
      [devis_statut, id, req.entrepriseId]
    );
    logAudit(req, 'UPDATE', 'factures', id, {
      champ: 'devis_statut', ancien: avant.rows[0].devis_statut, nouveau: devis_statut,
      numero: avant.rows[0].numero,
    });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateDevisStatut:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/devis/:id/convertir
// Crée une facture à partir d'un devis : reprend les lignes, lie les deux pièces,
// passe le devis en "converti". Si valider_immediatement : génère l'écriture
// comptable et les sorties de stock comme une facture validée classique.
const convertirEnFacture = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const eid = req.entrepriseId;
    const { valider_immediatement = false, date_echeance = null } = req.body;

    const devisRes = await client.query(
      `SELECT * FROM factures
       WHERE id = $1 AND entreprise_id = $2 AND type IN ('devis','proforma') FOR UPDATE`,
      [id, eid]
    );
    if (devisRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Devis introuvable' });
    }
    const devis = devisRes.rows[0];

    if (devis.devis_statut === 'converti' || devis.converti_facture_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Ce devis a déjà été converti en facture' });
    }
    if (!devis.client_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Le devis n\'a plus de client associé' });
    }

    const lignesRes = await client.query(
      'SELECT * FROM lignes_facture WHERE facture_id = $1 ORDER BY ordre',
      [id]
    );
    if (lignesRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Le devis ne contient aucune ligne' });
    }

    // Numéro de facture auto — même verrou que createFacture
    await client.query('LOCK TABLE factures IN SHARE ROW EXCLUSIVE MODE');
    const year = new Date().getFullYear();
    const countRes = await client.query(
      `SELECT COUNT(*) FROM factures WHERE entreprise_id = $1 AND EXTRACT(YEAR FROM date_emission) = $2`,
      [eid, year]
    );
    const numero = `F-${year}-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;
    const statutInitial = valider_immediatement ? 'envoyee' : 'brouillon';

    const factureRes = await client.query(
      `INSERT INTO factures (entreprise_id, client_id, cree_par, numero, type, statut,
        date_emission, date_echeance, sous_total, taux_tva, montant_tva, total_ttc,
        notes, conditions_paiement, devis_origine_id)
       VALUES ($1,$2,$3,$4,'facture',$5,CURRENT_DATE,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        eid, devis.client_id, req.user.id, numero, statutInitial,
        date_echeance || null,
        devis.sous_total, devis.taux_tva, devis.montant_tva, devis.total_ttc,
        devis.notes || null,
        devis.conditions_paiement || 'Paiement à 30 jours',
        devis.id,
      ]
    );
    const facture = factureRes.rows[0];

    const lignesAvecProduit = [];
    for (const l of lignesRes.rows) {
      await client.query(
        `INSERT INTO lignes_facture (facture_id, description, quantite, unite, prix_unitaire, remise, total, ordre, produit_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [facture.id, l.description, l.quantite, l.unite, l.prix_unitaire, l.remise, l.total, l.ordre, l.produit_id || null]
      );
      if (l.produit_id) lignesAvecProduit.push({ produit_id: l.produit_id, quantite: parseFloat(l.quantite) });
    }

    // Marque le devis comme converti et le relie à sa facture
    await client.query(
      `UPDATE factures SET devis_statut = 'converti', converti_facture_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [facture.id, devis.id]
    );

    // Validation immédiate : écriture comptable + sortie de stock
    if (statutInitial === 'envoyee') {
      await ecritureFacture(client, { entrepriseId: eid, utilisateurId: req.user.id, facture });
      for (const lp of lignesAvecProduit) {
        try {
          await appliquerMouvement(client, {
            entrepriseId: eid,
            produitId: lp.produit_id,
            sens: 'sortie',
            quantite: lp.quantite,
            sourceType: 'vente',
            sourceId: facture.id,
            libelle: `Vente - ${facture.numero}`,
            reference: facture.numero,
            date: facture.date_emission,
            creePar: req.user?.id,
          });
        } catch (e) {
          console.warn('[stock] mouvement conversion devis échoué:', e.message);
        }
      }
    }

    await client.query('COMMIT');
    logAudit(req, 'CONVERT', 'factures', devis.id, {
      devis_numero: devis.numero, facture_numero: facture.numero,
      facture_id: facture.id, statut: facture.statut,
    });
    res.status(201).json({ success: true, data: facture });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur convertirEnFacture:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// DELETE /api/devis/:id
const supprimerDevis = async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT devis_statut FROM factures
       WHERE id = $1 AND entreprise_id = $2 AND type IN ('devis','proforma')`,
      [req.params.id, req.entrepriseId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Devis introuvable' });
    }
    if (check.rows[0].devis_statut === 'converti') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un devis déjà converti en facture',
      });
    }
    await pool.query('DELETE FROM factures WHERE id = $1 AND entreprise_id = $2', [req.params.id, req.entrepriseId]);
    logAudit(req, 'DELETE', 'factures', req.params.id);
    res.json({ success: true, message: 'Devis supprimé' });
  } catch (err) {
    console.error('Erreur supprimerDevis:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const convertirRules = [
  body('valider_immediatement').optional().isBoolean().withMessage('valider_immediatement doit être un booléen'),
  body('date_echeance').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Date d\'échéance invalide'),
];

module.exports = {
  getDevis, getStatsDevis, updateDevisStatut, convertirEnFacture, supprimerDevis, convertirRules,
};
