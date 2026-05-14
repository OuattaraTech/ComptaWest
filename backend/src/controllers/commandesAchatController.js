const pool = require('../../config/database');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { appliquerMouvement } = require('./produitsController');
const { controlerSoldeAvantSortie, SoldeInsuffisantError } = require('./tresorerieController');

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const round3 = (n) => Math.round((parseFloat(n) || 0) * 1000) / 1000;

const commandeRules = [
  body('fournisseur_id').isUUID().withMessage('Fournisseur invalide'),
  body('date_commande').optional().isISO8601().withMessage('Date invalide'),
  body('lignes').isArray({ min: 1 }).withMessage('Au moins une ligne requise'),
];

// Génération du numéro de commande
const generateNumero = async (client, entrepriseId) => {
  const year = new Date().getFullYear();
  const r = await client.query(
    `SELECT COUNT(*) FROM commandes_achat WHERE entreprise_id = $1
     AND EXTRACT(YEAR FROM date_commande) = $2`,
    [entrepriseId, year]
  );
  return `BC-${year}-${String(parseInt(r.rows[0].count) + 1).padStart(4, '0')}`;
};

// GET /api/commandes-achat
const getCommandes = async (req, res) => {
  try {
    const { search, statut, fournisseur_id, page = 1, limit = 30 } = req.query;
    const eid = req.entrepriseId;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let query = `
      SELECT c.*, f.nom AS fournisseur_nom, f.code AS fournisseur_code
      FROM commandes_achat c
      LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
      WHERE c.entreprise_id = $1
    `;
    const params = [eid];
    if (statut)         { params.push(statut);         query += ` AND c.statut = $${params.length}`; }
    if (fournisseur_id) { params.push(fournisseur_id); query += ` AND c.fournisseur_id = $${params.length}`; }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (c.numero ILIKE $${params.length} OR f.nom ILIKE $${params.length})`;
    }

    const countQuery = query.replace(/SELECT.*?FROM commandes_achat/s, 'SELECT COUNT(*) FROM commandes_achat');
    const countRes = await pool.query(countQuery, params);

    params.push(parseInt(limit), offset);
    query += ` ORDER BY c.date_commande DESC, c.numero DESC
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
    console.error('Erreur getCommandes:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// GET /api/commandes-achat/:id
const getCommandeById = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const c = await pool.query(
      `SELECT c.*, f.nom AS fournisseur_nom, f.code AS fournisseur_code,
              f.adresse AS fournisseur_adresse, f.ville AS fournisseur_ville,
              f.email AS fournisseur_email, f.telephone AS fournisseur_telephone,
              f.ninea AS fournisseur_ninea, f.rccm AS fournisseur_rccm
       FROM commandes_achat c
       LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
       WHERE c.id = $1 AND c.entreprise_id = $2`,
      [id, eid]
    );
    if (!c.rows[0]) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const lignes = await pool.query(
      `SELECT lc.*, p.libelle AS produit_libelle, p.code AS produit_code
       FROM lignes_commande_achat lc
       LEFT JOIN produits p ON p.id = lc.produit_id
       WHERE lc.commande_id = $1 ORDER BY lc.ordre`,
      [id]
    );

    res.json({ success: true, data: { ...c.rows[0], lignes: lignes.rows } });
  } catch (err) {
    console.error('Erreur getCommandeById:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// POST /api/commandes-achat
const createCommande = async (req, res) => {
  const client = await pool.connect();
  try {
    const eid = req.entrepriseId;
    const b = req.body;
    if (!b.fournisseur_id || !Array.isArray(b.lignes) || b.lignes.length === 0) {
      return res.status(400).json({ success: false, message: 'Fournisseur et au moins une ligne requis' });
    }

    await client.query('BEGIN');

    const numero = await generateNumero(client, eid);

    // Calcul des totaux
    let sousTotal = 0;
    for (const l of b.lignes) {
      const qte = parseFloat(l.quantite) || 1;
      const pu = parseFloat(l.prix_unitaire) || 0;
      const rem = Math.min(100, Math.max(0, parseFloat(l.remise) || 0));
      sousTotal += qte * pu * (1 - rem / 100);
    }
    sousTotal = round2(sousTotal);
    const tauxTva = parseFloat(b.taux_tva) || 18;
    const montantTva = round2(sousTotal * tauxTva / 100);
    const totalTtc = round2(sousTotal + montantTva);

    const cRes = await client.query(
      `INSERT INTO commandes_achat (
        entreprise_id, numero, fournisseur_id, date_commande, date_livraison_prevue,
        reference_fournisseur, sous_total, taux_tva, montant_tva, total_ttc,
        statut, notes, conditions, cree_par
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        eid, numero, b.fournisseur_id,
        b.date_commande || new Date().toISOString().split('T')[0],
        b.date_livraison_prevue || null,
        b.reference_fournisseur || null,
        sousTotal, tauxTva, montantTva, totalTtc,
        b.valider_envoi ? 'envoyee' : 'brouillon',
        b.notes || null, b.conditions || null, req.user?.id,
      ]
    );
    const cmd = cRes.rows[0];

    for (let i = 0; i < b.lignes.length; i++) {
      const l = b.lignes[i];
      const qte = parseFloat(l.quantite) || 1;
      const pu = parseFloat(l.prix_unitaire) || 0;
      const rem = Math.min(100, Math.max(0, parseFloat(l.remise) || 0));
      const total = round2(qte * pu * (1 - rem / 100));
      await client.query(
        `INSERT INTO lignes_commande_achat
          (commande_id, produit_id, description, quantite, unite, prix_unitaire, remise, total, ordre)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cmd.id, l.produit_id || null, (l.description || '').trim(),
         qte, l.unite || 'unité', pu, rem, total, i]
      );
    }

    if (cmd.statut === 'envoyee') {
      await client.query(`UPDATE commandes_achat SET date_envoi = NOW() WHERE id = $1`, [cmd.id]);
    }

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'commandes_achat', cmd.id, { numero, total: totalTtc });
    res.status(201).json({ success: true, data: cmd });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur createCommande:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création commande' });
  } finally {
    client.release();
  }
};

// POST /api/commandes-achat/:id/envoyer
const envoyerCommande = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `UPDATE commandes_achat SET statut = 'envoyee', date_envoi = NOW(), updated_at = NOW()
       WHERE id = $1 AND entreprise_id = $2 AND statut = 'brouillon' RETURNING *`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(400).json({ success: false, message: 'Commande non envoyable' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur envoyerCommande:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// POST /api/commandes-achat/:id/receptionner
// Pour chaque ligne avec produit_id → entrée en stock auto au prix unitaire
const receptionnerCommande = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const dateReception = req.body.date_reception || new Date().toISOString().split('T')[0];

    await client.query('BEGIN');

    const cRes = await client.query(
      `SELECT * FROM commandes_achat WHERE id = $1 AND entreprise_id = $2 FOR UPDATE`,
      [id, eid]
    );
    if (!cRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }
    const cmd = cRes.rows[0];
    if (cmd.statut !== 'envoyee') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Commande non réceptionnable (envoyer d\'abord)' });
    }

    // Entrée en stock pour chaque ligne avec produit
    const lignesRes = await client.query(
      `SELECT * FROM lignes_commande_achat WHERE commande_id = $1 AND produit_id IS NOT NULL`,
      [id]
    );

    for (const l of lignesRes.rows) {
      try {
        await appliquerMouvement(client, {
          entrepriseId: eid,
          produitId: l.produit_id,
          sens: 'entree',
          quantite: parseFloat(l.quantite),
          prix: parseFloat(l.prix_unitaire),
          sourceType: 'achat',
          sourceId: cmd.id,
          libelle: `Réception ${cmd.numero}`,
          reference: cmd.numero,
          date: dateReception,
          creePar: req.user?.id,
        });
      } catch (err) {
        console.warn('[stock] réception échouée:', err.message);
      }
    }

    await client.query(
      `UPDATE commandes_achat SET statut = 'receptionnee', date_reception = $1, updated_at = NOW()
       WHERE id = $2`,
      [dateReception, id]
    );

    await client.query('COMMIT');
    logAudit(req, 'RECEIVE', 'commandes_achat', id, { numero: cmd.numero });
    res.json({ success: true, data: { id, statut: 'receptionnee', nb_lignes_stockees: lignesRes.rows.length } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur receptionnerCommande:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  } finally {
    client.release();
  }
};

// POST /api/commandes-achat/:id/facturer
// Crée la dépense correspondante (sans regénérer les mouvements stock — déjà passés à la réception)
const facturerCommande = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const b = req.body || {};

    await client.query('BEGIN');

    const cRes = await client.query(
      `SELECT c.*, f.nom AS fournisseur_nom, f.compte_charge_defaut
       FROM commandes_achat c
       LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
       WHERE c.id = $1 AND c.entreprise_id = $2 FOR UPDATE OF c`,
      [id, eid]
    );
    if (!cRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }
    const cmd = cRes.rows[0];
    if (cmd.statut !== 'receptionnee' && cmd.statut !== 'envoyee') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Commande non facturable' });
    }
    if (cmd.depense_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Commande déjà facturée' });
    }

    // Numéro de dépense
    const year = new Date().getFullYear();
    const countRes = await client.query(
      `SELECT COUNT(*) FROM depenses WHERE entreprise_id = $1 AND EXTRACT(YEAR FROM date_depense) = $2`,
      [eid, year]
    );
    const numeroDep = `D-${year}-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;

    const dateDepense = b.date_depense || cmd.date_reception || new Date().toISOString().split('T')[0];
    const dateEcheance = b.date_echeance || null;
    const statut = b.statut_paiement || 'en_attente';

    const depRes = await client.query(
      `INSERT INTO depenses (
        entreprise_id, cree_par, numero, description, fournisseur, fournisseur_id, commande_achat_id,
        montant_ht, taux_tva, montant_tva, montant_ttc,
        date_depense, date_echeance, statut, mode_paiement, reference
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        eid, req.user?.id, numeroDep,
        `Facture ${cmd.numero} - ${cmd.fournisseur_nom}`,
        cmd.fournisseur_nom, cmd.fournisseur_id, cmd.id,
        cmd.sous_total, cmd.taux_tva, cmd.montant_tva, cmd.total_ttc,
        dateDepense, dateEcheance, statut, 'virement', b.reference || cmd.reference_fournisseur,
      ]
    );

    await client.query(
      `UPDATE commandes_achat SET statut = 'facturee', depense_id = $1, date_facturation = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [depRes.rows[0].id, id]
    );

    await client.query('COMMIT');
    logAudit(req, 'INVOICE', 'commandes_achat', id, { numero: cmd.numero, depense_id: depRes.rows[0].id });
    res.json({ success: true, data: { commande_id: id, depense_id: depRes.rows[0].id, depense_numero: numeroDep } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur facturerCommande:', err.message);
    res.status(500).json({ success: false, message: 'Erreur facturation' });
  } finally {
    client.release();
  }
};

// DELETE /api/commandes-achat/:id
const supprimerCommande = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `DELETE FROM commandes_achat WHERE id = $1 AND entreprise_id = $2 AND statut = 'brouillon' RETURNING id`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(400).json({ success: false, message: 'Non supprimable (envoyer/annuler d\'abord)' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur supprimerCommande:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// POST /api/commandes-achat/:id/annuler
const annulerCommande = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `UPDATE commandes_achat SET statut = 'annulee', updated_at = NOW()
       WHERE id = $1 AND entreprise_id = $2 AND statut IN ('brouillon','envoyee') RETURNING *`,
      [id, eid]
    );
    if (!r.rows[0]) return res.status(400).json({ success: false, message: 'Non annulable' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Erreur annulerCommande:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ─── PAIEMENT FOURNISSEUR ────────────────────────────────────────────────
// POST /api/fournisseurs/paiements
// Body : { fournisseur_id, depense_id, montant, date_paiement, mode_paiement, compte_tresorerie_id, reference }
const creerPaiementFournisseur = async (req, res) => {
  const client = await pool.connect();
  try {
    const eid = req.entrepriseId;
    const b = req.body;
    if (!b.fournisseur_id || !b.montant || parseFloat(b.montant) <= 0) {
      return res.status(400).json({ success: false, message: 'Fournisseur et montant > 0 requis' });
    }

    await client.query('BEGIN');

    // Résolution du compte trésorerie
    let compteId = b.compte_tresorerie_id;
    if (!compteId) {
      const typeAttendu = b.mode_paiement === 'cash' ? 'caisse'
        : b.mode_paiement === 'mobile_money' ? 'mobile_money'
        : 'banque';
      const r = await client.query(
        `SELECT id FROM comptes_tresorerie
         WHERE entreprise_id = $1 AND par_defaut = TRUE AND archived_at IS NULL
           AND (type = $2 OR type = 'banque')
         ORDER BY (type = $2) DESC LIMIT 1`,
        [eid, typeAttendu]
      );
      compteId = r.rows[0]?.id;
    }
    if (!compteId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Aucun compte de trésorerie disponible' });
    }

    const montant = round2(b.montant);
    const datePaiement = b.date_paiement || new Date().toISOString().split('T')[0];

    // Récupère le fournisseur pour le libellé
    const fRes = await client.query(`SELECT nom FROM fournisseurs WHERE id = $1`, [b.fournisseur_id]);
    const fournisseurNom = fRes.rows[0]?.nom || 'Fournisseur';

    // Si une dépense est désignée, on vérifie le reste à payer
    let depenseSoldeApres = null;
    if (b.depense_id) {
      const dRes = await client.query(
        `SELECT d.*,
          COALESCE((SELECT SUM(montant) FROM paiements_fournisseur WHERE depense_id = d.id), 0) AS total_paye
         FROM depenses d WHERE d.id = $1 AND d.entreprise_id = $2`,
        [b.depense_id, eid]
      );
      if (!dRes.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Dépense introuvable' });
      }
      const dep = dRes.rows[0];
      const reste = round2(parseFloat(dep.montant_ttc) - parseFloat(dep.total_paye));
      if (montant > reste + 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Montant > reste à payer (${reste})` });
      }
      depenseSoldeApres = round2(parseFloat(dep.total_paye) + montant);
    }

    // Contrôle du solde du compte de trésorerie avant le décaissement
    await controlerSoldeAvantSortie(client, compteId, montant);

    // Création du mouvement de trésorerie (sortie)
    const mvtRes = await client.query(
      `INSERT INTO mouvements_tresorerie
        (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, cree_par)
       VALUES ($1,$2,$3,'sortie',$4,$5,$6,'paiement_fournisseur',$7) RETURNING id`,
      [eid, compteId, datePaiement, montant,
       `Paiement ${fournisseurNom}${b.depense_id ? ' - ' + (b.reference || '') : ''}`.slice(0, 250),
       b.reference || null, req.user?.id]
    );

    // Création du paiement
    const pRes = await client.query(
      `INSERT INTO paiements_fournisseur (
        entreprise_id, fournisseur_id, depense_id, montant, date_paiement,
        mode_paiement, reference, compte_tresorerie_id, mouvement_tresorerie_id, notes, cree_par
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [eid, b.fournisseur_id, b.depense_id || null, montant, datePaiement,
       b.mode_paiement || 'virement', b.reference || null, compteId, mvtRes.rows[0].id,
       b.notes || null, req.user?.id]
    );

    // Si dépense liée : mise à jour de son statut (payée si solde fini)
    if (b.depense_id && depenseSoldeApres !== null) {
      const dRes = await client.query(`SELECT montant_ttc FROM depenses WHERE id = $1`, [b.depense_id]);
      const ttc = parseFloat(dRes.rows[0].montant_ttc);
      const nouveauStatut = depenseSoldeApres >= ttc - 0.01 ? 'payee' : 'en_attente';
      await client.query(
        `UPDATE depenses SET statut = $1, updated_at = NOW() WHERE id = $2`,
        [nouveauStatut, b.depense_id]
      );
    }

    await client.query('COMMIT');
    logAudit(req, 'PAY', 'fournisseurs', b.fournisseur_id,
      { montant, mode: b.mode_paiement, depense_id: b.depense_id });
    res.status(201).json({ success: true, data: pRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof SoldeInsuffisantError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code, details: err.details });
    }
    console.error('Erreur creerPaiementFournisseur:', err.message);
    res.status(500).json({ success: false, message: 'Erreur paiement' });
  } finally {
    client.release();
  }
};

// GET /api/fournisseurs/:id/paiements
const getPaiementsFournisseur = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const r = await pool.query(
      `SELECT p.*, d.numero AS depense_numero, ct.nom AS compte_tresorerie_nom
       FROM paiements_fournisseur p
       LEFT JOIN depenses d ON d.id = p.depense_id
       LEFT JOIN comptes_tresorerie ct ON ct.id = p.compte_tresorerie_id
       WHERE p.entreprise_id = $1 AND p.fournisseur_id = $2
       ORDER BY p.date_paiement DESC LIMIT 30`,
      [eid, id]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Erreur getPaiementsFournisseur:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

module.exports = {
  commandeRules,
  getCommandes, getCommandeById, createCommande,
  envoyerCommande, receptionnerCommande, facturerCommande,
  annulerCommande, supprimerCommande,
  creerPaiementFournisseur, getPaiementsFournisseur,
};
