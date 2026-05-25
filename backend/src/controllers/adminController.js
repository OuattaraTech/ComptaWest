/**
 * Console super-admin ApeX (migration 029).
 *
 * Endpoints (tous protégés par requireSuperAdmin) :
 *   GET    /api/admin/stats               — KPIs globaux (MRR, cabinets, PME…)
 *   GET    /api/admin/cabinets            — Leaderboard cabinets partenaires
 *   GET    /api/admin/candidatures        — Liste des candidatures cabinets
 *   POST   /api/admin/candidatures/:id/valider — Active une candidature
 *   POST   /api/admin/candidatures/:id/refuser — Refuse une candidature
 *   GET    /api/admin/relances            — Dernières invitations relancées
 */
const crypto = require('crypto');
const pool = require('../../config/database');
const {
  creerCategoriesDefaut, creerPlanComptableSyscohada,
  creerJournauxDefaut, creerExerciceCourant,
  creerRubriquesPaieDefaut,
} = require('../utils/helpers');
const { envoyerEmail } = require('../utils/email');
const { activationCabinet: tplActivation } = require('../utils/emailTemplates');
const { logAudit } = require('../utils/audit');

function genererCodeParrain() {
  return `CAB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// ─── GET /api/admin/stats — KPIs globaux ───────────────────────────────────
async function getStats(req, res) {
  try {
    // MRR : somme des prix_mensuel_fcfa des abonnements actifs (hors gratuits)
    const mrr = await pool.query(`
      SELECT COALESCE(SUM(prix_mensuel_fcfa), 0) AS total
        FROM abonnements
       WHERE statut = 'actif'
         AND palier NOT IN ('decouverte', 'cabinet_partenaire')
    `);

    const compteurs = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM entreprises WHERE type_compte = 'cabinet_partenaire') AS cabinets_partenaires,
        (SELECT COUNT(*) FROM entreprises WHERE type_compte = 'pme' AND actif = TRUE) AS pme_actives,
        (SELECT COUNT(*) FROM entreprises WHERE parrainee_par_cabinet_id IS NOT NULL) AS pme_parrainees,
        (SELECT COUNT(*) FROM cabinet_invitations WHERE statut = 'pending') AS invitations_pending,
        (SELECT COUNT(*) FROM cabinet_invitations WHERE statut = 'accepted') AS invitations_acceptees,
        (SELECT COUNT(*) FROM cabinet_invitations) AS invitations_total,
        (SELECT COUNT(*) FROM cabinet_candidatures WHERE statut = 'pending') AS candidatures_pending,
        (SELECT COUNT(*) FROM utilisateurs WHERE actif = TRUE) AS utilisateurs_actifs,
        (SELECT COUNT(*) FROM utilisateurs WHERE is_demo = TRUE AND actif = TRUE) AS users_demo_actifs
    `);

    const c = compteurs.rows[0];
    const totalInv = parseInt(c.invitations_total) || 0;
    const acceptees = parseInt(c.invitations_acceptees) || 0;
    const tauxConversion = totalInv > 0 ? Math.round((acceptees / totalInv) * 1000) / 10 : 0;

    res.json({
      success: true,
      data: {
        mrr_fcfa: parseInt(mrr.rows[0].total) || 0,
        cabinets_partenaires: parseInt(c.cabinets_partenaires) || 0,
        pme_actives: parseInt(c.pme_actives) || 0,
        pme_parrainees: parseInt(c.pme_parrainees) || 0,
        invitations_pending: parseInt(c.invitations_pending) || 0,
        invitations_acceptees: acceptees,
        invitations_total: totalInv,
        taux_conversion_pct: tauxConversion,
        candidatures_pending: parseInt(c.candidatures_pending) || 0,
        utilisateurs_actifs: parseInt(c.utilisateurs_actifs) || 0,
        users_demo_actifs: parseInt(c.users_demo_actifs) || 0,
      },
    });
  } catch (err) {
    console.error('Erreur admin/stats:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/admin/cabinets — Leaderboard cabinets partenaires ────────────
async function getCabinetsLeaderboard(req, res) {
  try {
    const r = await pool.query(`
      SELECT
        e.id, e.nom AS cabinet_nom, e.code_parrain, e.created_at AS active_depuis,
        (SELECT COUNT(*) FROM cabinet_invitations WHERE cabinet_id = e.id) AS invitations_emises,
        (SELECT COUNT(*) FROM cabinet_invitations WHERE cabinet_id = e.id AND statut = 'accepted') AS invitations_acceptees,
        (SELECT COUNT(*) FROM entreprises WHERE parrainee_par_cabinet_id = e.id) AS pme_parrainees,
        (SELECT COUNT(*) FROM cabinet_connections WHERE cabinet_id = e.id AND statut = 'active') AS clients_actifs,
        COALESCE((
          SELECT SUM(ab.prix_mensuel_fcfa)
            FROM entreprises p
            JOIN abonnements ab ON ab.entreprise_id = p.id
           WHERE p.parrainee_par_cabinet_id = e.id
             AND ab.statut = 'actif'
        ), 0) AS mrr_genere_fcfa
      FROM entreprises e
      WHERE e.type_compte = 'cabinet_partenaire'
      ORDER BY pme_parrainees DESC, invitations_emises DESC
      LIMIT 100
    `);
    // Calcul taux de conversion par cabinet
    const data = r.rows.map((c) => {
      const e = parseInt(c.invitations_emises) || 0;
      const a = parseInt(c.invitations_acceptees) || 0;
      return {
        ...c,
        invitations_emises: e,
        invitations_acceptees: a,
        pme_parrainees: parseInt(c.pme_parrainees) || 0,
        clients_actifs: parseInt(c.clients_actifs) || 0,
        mrr_genere_fcfa: parseInt(c.mrr_genere_fcfa) || 0,
        taux_conversion_pct: e > 0 ? Math.round((a / e) * 1000) / 10 : 0,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/admin/candidatures — Liste des candidatures cabinets ─────────
async function getCandidatures(req, res) {
  try {
    const statut = req.query.statut || 'pending';
    const r = await pool.query(
      `SELECT c.*, e.nom AS cabinet_cree_nom
         FROM cabinet_candidatures c
         LEFT JOIN entreprises e ON e.id = c.cabinet_cree_id
        WHERE c.statut = $1
        ORDER BY c.created_at DESC LIMIT 200`,
      [statut]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── POST /api/admin/candidatures/:id/valider ─────────────────────────────
// Transforme une candidature pending en compte cabinet_partenaire complet :
//   1. Crée l'utilisateur dirigeant (actif=false, invitation_token unique)
//   2. Crée l'entreprise (type_compte='cabinet_partenaire', code parrain)
//   3. Membre proprietaire, abonnement 0 FCFA, plan compta SYSCOHADA
//   4. Envoie email d'activation avec lien /invitation/<token>
async function validerCandidature(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const candRes = await client.query(
      `SELECT * FROM cabinet_candidatures WHERE id = $1 AND statut = 'pending' FOR UPDATE`,
      [req.params.id]
    );
    const cand = candRes.rows[0];
    if (!cand) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Candidature introuvable ou déjà traitée' });
    }

    // Génère un mot de passe aléatoire temporaire (jamais envoyé en clair)
    // + invitation_token pour le lien d'activation
    const motDePasseTemp = crypto.randomBytes(24).toString('hex');
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(motDePasseTemp, 12);
    const invitationToken = crypto.randomBytes(32).toString('hex');

    // Crée ou met à jour l'utilisateur
    const userRes = await client.query(
      `INSERT INTO utilisateurs (nom, email, mot_de_passe, actif,
                                  invitation_token, invitation_expire_at)
       VALUES ($1, $2, $3, FALSE, $4, NOW() + INTERVAL '30 days')
       ON CONFLICT (email) DO UPDATE SET
         nom = $1,
         actif = FALSE,
         invitation_token = $4,
         invitation_expire_at = NOW() + INTERVAL '30 days',
         updated_at = NOW()
       RETURNING id`,
      [cand.nom_responsable, cand.email_pro, hash, invitationToken]
    );
    const userId = userRes.rows[0].id;

    // Génère un code parrain unique
    let codeParrain;
    for (let i = 0; i < 5; i++) {
      codeParrain = genererCodeParrain();
      const coll = await client.query('SELECT 1 FROM entreprises WHERE code_parrain = $1', [codeParrain]);
      if (coll.rows.length === 0) break;
      codeParrain = null;
    }
    if (!codeParrain) throw new Error('Génération code parrain échouée');

    // Crée l'entreprise cabinet
    const entRes = await client.query(
      `INSERT INTO entreprises
         (nom, forme_juridique, pays, devise, regime_fiscal, ville,
          type_compte, code_parrain)
       VALUES ($1, 'SARL', 'Côte d''Ivoire', 'FCFA', 'RNI', $2,
               'cabinet_partenaire', $3)
       RETURNING id`,
      [cand.nom_cabinet, cand.ville || 'Abidjan', codeParrain]
    );
    const eid = entRes.rows[0].id;

    // Membre propriétaire
    await client.query(
      `INSERT INTO membres_entreprise (utilisateur_id, entreprise_id, role)
       VALUES ($1, $2, 'proprietaire')`,
      [userId, eid]
    );

    // Plan comptable + journaux + exercice + rubriques paie
    await creerCategoriesDefaut(eid, client);
    await creerPlanComptableSyscohada(eid, client);
    await creerJournauxDefaut(eid, client);
    await creerExerciceCourant(eid, client);
    await creerRubriquesPaieDefaut(eid, client);

    // Abonnement gratuit cabinet_partenaire
    await client.query(
      `INSERT INTO abonnements (entreprise_id, palier, statut, periodicite,
         date_debut, date_fin, prix_mensuel_fcfa, notes_commerciales)
       VALUES ($1, 'cabinet_partenaire', 'actif', 'annuel',
         CURRENT_DATE, CURRENT_DATE + INTERVAL '999 years', 0,
         'Licence offerte — programme Partenaire ONECCA')`,
      [eid]
    );

    // Marque la candidature comme validée
    await client.query(
      `UPDATE cabinet_candidatures
          SET statut = 'valide',
              traite_at = NOW(),
              traite_par = $1,
              cabinet_cree_id = $2,
              notes_admin = COALESCE(notes_admin, '') || E'\n[' || NOW() || '] Validé par super-admin',
              updated_at = NOW()
        WHERE id = $3`,
      [req.user.id, eid, cand.id]
    );

    await client.query('COMMIT');

    // Envoi email d'activation (en dehors de la transaction)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const lienActivation = `${baseUrl}/invitation/${invitationToken}`;
    const emailRes = await envoyerEmail({
      to: cand.email_pro,
      ...tplActivation({
        cabinet_nom: cand.nom_cabinet,
        code_parrain: codeParrain,
        lien_portail: lienActivation,
      }),
      tags: { type: 'activation_cabinet', candidature_id: cand.id },
    });

    logAudit(req, 'VALIDATE', 'cabinet_candidature', cand.id,
      { cabinet_id: eid, code_parrain: codeParrain });

    res.json({
      success: true,
      message: 'Cabinet activé. Email d\'activation envoyé.',
      data: {
        cabinet_id: eid,
        cabinet_nom: cand.nom_cabinet,
        code_parrain: codeParrain,
        lien_activation: lienActivation,
        email_envoye: emailRes.sent,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur validerCandidature:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ─── POST /api/admin/candidatures/:id/refuser ─────────────────────────────
async function refuserCandidature(req, res) {
  try {
    const { motif } = req.body;
    const r = await pool.query(
      `UPDATE cabinet_candidatures
          SET statut = 'refuse',
              traite_at = NOW(),
              traite_par = $1,
              notes_admin = COALESCE(notes_admin, '') || E'\n[' || NOW() || '] Refusé : ' || $2,
              updated_at = NOW()
        WHERE id = $3 AND statut = 'pending'
        RETURNING id, email_pro, nom_cabinet`,
      [req.user.id, motif || 'pas de motif renseigné', req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Candidature introuvable ou déjà traitée' });
    logAudit(req, 'REFUSE', 'cabinet_candidature', r.rows[0].id, { motif });
    res.json({ success: true, message: 'Candidature refusée', data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/admin/relances — Dernières relances envoyées ─────────────────
async function getRelances(req, res) {
  try {
    const r = await pool.query(`
      SELECT ci.id, ci.email_pme, ci.nom_pme, ci.created_at, ci.relance_envoyee_at,
             ci.statut, e.nom AS cabinet_nom
        FROM cabinet_invitations ci
        JOIN entreprises e ON e.id = ci.cabinet_id
       WHERE ci.relance_envoyee_at IS NOT NULL
       ORDER BY ci.relance_envoyee_at DESC
       LIMIT 50
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getStats, getCabinetsLeaderboard, getCandidatures,
  validerCandidature, refuserCandidature, getRelances,
};
