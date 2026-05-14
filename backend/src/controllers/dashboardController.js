const pool = require('../../config/database');

// GET /api/dashboard/stats
const getStats = async (req, res) => {
  try {
    const { annee = new Date().getFullYear() } = req.query;
    const eid = req.entrepriseId;

    const kpisRes = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN statut != 'annulee' THEN total_ttc ELSE 0 END), 0) AS ca_total,
        COALESCE(SUM(CASE WHEN statut = 'payee' THEN montant_paye ELSE 0 END), 0) AS encaisse,
        COALESCE(SUM(CASE WHEN statut IN ('en_attente','retard') THEN (total_ttc - montant_paye) ELSE 0 END), 0) AS en_attente,
        COALESCE(SUM(CASE WHEN statut = 'retard' THEN (total_ttc - montant_paye) ELSE 0 END), 0) AS en_retard,
        COUNT(*) AS nb_factures,
        COUNT(CASE WHEN statut = 'retard' THEN 1 END) AS nb_retard
      FROM factures
      WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_emission)=$2
        AND type='facture'
    `, [eid, annee]);

    const depensesRes = await pool.query(`
      SELECT COALESCE(SUM(montant_ttc), 0) AS total_depenses
      FROM depenses
      WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_depense)=$2 AND statut='payee'
    `, [eid, annee]);

    const taxesRes = await pool.query(`
      SELECT COALESCE(SUM(montant_du - montant_paye), 0) AS total_taxes_dues
      FROM declarations_taxes
      WHERE entreprise_id=$1 AND statut IN ('a_payer','en_retard')
        AND EXTRACT(YEAR FROM periode_fin)=$2
    `, [eid, annee]);

    const clientsRes = await pool.query(
      'SELECT COUNT(*) AS nb FROM clients WHERE entreprise_id=$1 AND actif=true', [eid]
    );

    const mensuelRecRes = await pool.query(`
      SELECT EXTRACT(MONTH FROM date_emission) AS mois,
             COALESCE(SUM(CASE WHEN statut!='annulee' THEN total_ttc ELSE 0 END),0) AS recettes,
             COALESCE(SUM(montant_paye),0) AS encaisse
      FROM factures
      WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_emission)=$2
        AND type='facture'
      GROUP BY EXTRACT(MONTH FROM date_emission)
    `, [eid, annee]);

    const mensuelDepRes = await pool.query(`
      SELECT EXTRACT(MONTH FROM date_depense) AS mois,
             COALESCE(SUM(montant_ttc),0) AS depenses
      FROM depenses
      WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_depense)=$2 AND statut='payee'
      GROUP BY EXTRACT(MONTH FROM date_depense)
    `, [eid, annee]);

    const chargesRes = await pool.query(`
      SELECT cd.nom AS categorie, cd.couleur, COALESCE(SUM(d.montant_ttc),0) AS total
      FROM categories_depenses cd
      LEFT JOIN depenses d ON d.categorie_id=cd.id
        AND EXTRACT(YEAR FROM d.date_depense)=$2 AND d.statut='payee'
      WHERE cd.entreprise_id=$1
      GROUP BY cd.id, cd.nom, cd.couleur
      HAVING COALESCE(SUM(d.montant_ttc),0) > 0
      ORDER BY total DESC
    `, [eid, annee]);

    const topClientsRes = await pool.query(`
      SELECT c.nom, c.code,
        COUNT(f.id) AS nb_factures,
        COALESCE(SUM(f.total_ttc),0) AS ca_total
      FROM clients c
      LEFT JOIN factures f ON f.client_id=c.id AND EXTRACT(YEAR FROM f.date_emission)=$2 AND f.statut!='annulee' AND f.type='facture'
      WHERE c.entreprise_id=$1
      GROUP BY c.id ORDER BY ca_total DESC LIMIT 5
    `, [eid, annee]);

    const moisNoms = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const evolutionMensuelle = moisNoms.map((nom, i) => {
      const moisNum = i + 1;
      const recRow = mensuelRecRes.rows.find(r => parseInt(r.mois) === moisNum);
      const depRow = mensuelDepRes.rows.find(r => parseInt(r.mois) === moisNum);
      const recettes = parseFloat(recRow?.recettes || 0);
      const depenses = parseFloat(depRow?.depenses || 0);
      return { mois: nom, recettes, depenses, benefice: recettes - depenses };
    });

    const kpis = kpisRes.rows[0];
    const ca_total = parseFloat(kpis.ca_total);
    const total_depenses = parseFloat(depensesRes.rows[0].total_depenses);
    const total_taxes_dues = parseFloat(taxesRes.rows[0].total_taxes_dues);

    res.json({
      success: true,
      data: {
        kpis: {
          ca_total,
          encaisse: parseFloat(kpis.encaisse),
          en_attente: parseFloat(kpis.en_attente),
          en_retard: parseFloat(kpis.en_retard),
          total_depenses,
          total_taxes_dues,
          benefice_net: ca_total - total_depenses - total_taxes_dues,
          marge: ca_total > 0 ? (((ca_total - total_depenses) / ca_total) * 100).toFixed(1) : 0,
          nb_factures: parseInt(kpis.nb_factures),
          nb_retard: parseInt(kpis.nb_retard),
          nb_clients: parseInt(clientsRes.rows[0].nb),
        },
        evolution_mensuelle: evolutionMensuelle,
        repartition_charges: chargesRes.rows.map(r => ({
          categorie: r.categorie,
          couleur: r.couleur,
          total: parseFloat(r.total),
          pourcentage: total_depenses > 0 ? ((r.total / total_depenses) * 100).toFixed(1) : 0,
        })),
        top_clients: topClientsRes.rows.map(r => ({ ...r, ca_total: parseFloat(r.ca_total) })),
      },
    });
  } catch (err) {
    console.error('Erreur getStats:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/dashboard/transactions-recentes
const getTransactionsRecentes = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const eid = req.entrepriseId;

    const facturesRes = await pool.query(`
      SELECT f.id, f.numero, f.statut, f.date_emission, f.total_ttc, f.montant_paye,
             'recette' AS sens, c.nom AS tiers
      FROM factures f
      LEFT JOIN clients c ON c.id = f.client_id
      WHERE f.entreprise_id=$1 AND f.type='facture'
      ORDER BY f.created_at DESC LIMIT $2
    `, [eid, limit]);

    const depensesRes = await pool.query(`
      SELECT d.id, d.numero, d.statut, d.date_depense AS date_emission,
             d.montant_ttc AS total_ttc, d.montant_ttc AS montant_paye,
             'depense' AS sens, COALESCE(d.fournisseur, d.description) AS tiers
      FROM depenses d
      WHERE d.entreprise_id=$1
      ORDER BY d.created_at DESC LIMIT $2
    `, [eid, limit]);

    const all = [...facturesRes.rows, ...depensesRes.rows]
      .sort((a, b) => new Date(b.date_emission) - new Date(a.date_emission))
      .slice(0, parseInt(limit));

    res.json({ success: true, data: all });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/dashboard/annees
const getAnneesDisponibles = async (req, res) => {
  try {
    const eid = req.entrepriseId;

    const result = await pool.query(`
      SELECT DISTINCT annee FROM (
        SELECT EXTRACT(YEAR FROM date_emission)::int AS annee FROM factures WHERE entreprise_id = $1
        UNION
        SELECT EXTRACT(YEAR FROM date_depense)::int AS annee FROM depenses WHERE entreprise_id = $1
        UNION
        SELECT EXTRACT(YEAR FROM periode_fin)::int AS annee FROM declarations_taxes WHERE entreprise_id = $1
      ) sub
      ORDER BY annee DESC
    `, [eid]);

    const now = new Date().getFullYear();
    const annees = result.rows.map(r => r.annee);
    if (!annees.includes(now)) annees.unshift(now);
    annees.sort((a, b) => b - a);

    res.json({ success: true, data: annees.map(String) });
  } catch (err) {
    console.error('Erreur getAnneesDisponibles:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { getStats, getTransactionsRecentes, getAnneesDisponibles };