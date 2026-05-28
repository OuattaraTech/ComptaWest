const pool = require('../../config/database');
const { body } = require('express-validator');
const { logAudit } = require('../utils/audit');
const { trouverExerciceOuvert, creerEcriture, ComptaError } = require('../utils/comptabilite');
const logger = require('../utils/logger');

// Mapping type compte trésorerie → code journal SYSCOHADA
const journalPourType = (type) => type === 'caisse' ? 'CAI'
                                : type === 'mobile_money' ? 'MM'
                                : 'BNK';

// Contrepartie par défaut quand l'utilisateur ne précise rien.
// 758 = Produits divers de gestion courante (entrée non rattachée à une vente)
// 658 = Charges diverses de gestion courante (sortie non rattachée à un achat)
// Ce ne sont PAS des comptes finaux corrects : l'utilisateur devrait éditer la
// pièce pour pointer le bon compte. Le défaut signale juste « à régulariser ».
const CONTREPARTIE_DEFAUT_ENTREE = '758';
const CONTREPARTIE_DEFAUT_SORTIE = '658';

// Ignore les ComptaError non bloquantes (compte manquant, libellé trop long,
// etc.). Les vraies erreurs (exercice clos, déséquilibre) sont relancées pour
// faire ROLLBACK et empêcher la divergence entre mouvement et compta.
const ERREURS_BLOQUANTES_COMPTA = new Set([
  'EXERCICE_FERME', 'DESEQUILIBRE', 'JOURNAL_INCONNU', 'COMPTE_INCONNU',
]);
const safeCompta = async (label, fn) => {
  try { return await fn(); }
  catch (err) {
    if (err instanceof ComptaError) {
      if (ERREURS_BLOQUANTES_COMPTA.has(err.code)) throw err;
      logger.warn('Écriture trésorerie ignorée', { label, code: err.code, message: err.message });
      return null;
    }
    logger.error('Écriture trésorerie en échec', { label, message: err.message });
    return null;
  }
};

// ─── Catalogue des opérateurs supportés ────────────────────────────────────
// Utilisé par le frontend pour pré-remplir la création de comptes.
// Liste évolutive — basée sur les principaux acteurs de l'UEMOA/CEMAC.
const OPERATEURS = {
  banque: [
    { code: 'BICICI',  nom: 'BICICI',                  pays: ['CI'] },
    { code: 'SGBCI',   nom: 'Société Générale CI',     pays: ['CI'] },
    { code: 'NSIA',    nom: 'NSIA Banque',             pays: ['CI', 'SN'] },
    { code: 'ECOBANK', nom: 'Ecobank',                 pays: ['CI', 'SN', 'BF', 'ML', 'TG', 'BJ', 'NE'] },
    { code: 'UBA',     nom: 'UBA',                     pays: ['CI', 'SN', 'BF', 'CM', 'BJ'] },
    { code: 'BOA',     nom: 'Bank of Africa',          pays: ['CI', 'SN', 'BF', 'ML', 'BJ', 'NE'] },
    { code: 'SIB',     nom: 'SIB',                     pays: ['CI'] },
    { code: 'CORIS',   nom: 'Coris Bank',              pays: ['CI', 'BF', 'ML', 'SN'] },
    { code: 'BHCI',    nom: 'BHCI',                    pays: ['CI'] },
    { code: 'AUTRE',   nom: 'Autre banque',            pays: [] },
  ],
  mobile_money: [
    { code: 'WAVE',         nom: 'Wave',           pays: ['CI', 'SN', 'BF', 'ML'] },
    { code: 'ORANGE_MONEY', nom: 'Orange Money',   pays: ['CI', 'SN', 'BF', 'ML', 'NE', 'GN', 'CM'] },
    { code: 'MTN_MOMO',     nom: 'MTN MoMo',       pays: ['CI', 'BF', 'BJ', 'CM', 'GN'] },
    { code: 'MOOV_MONEY',   nom: 'Moov Money',     pays: ['CI', 'BJ', 'BF', 'TG', 'NE'] },
    { code: 'DJAMO',        nom: 'Djamo',          pays: ['CI'] },
    { code: 'TRESOR_MONEY', nom: 'Trésor Money',   pays: ['CI'] },
    { code: 'AUTRE_MM',     nom: 'Autre opérateur', pays: [] },
  ],
  caisse: [
    { code: 'CAISSE_SIEGE', nom: 'Caisse siège',     pays: [] },
    { code: 'CAISSE_AGENCE', nom: 'Caisse agence',   pays: [] },
    { code: 'AUTRE_CAISSE',  nom: 'Autre caisse',    pays: [] },
  ],
};

// ─── Validations express-validator ─────────────────────────────────────────
const compteRules = [
  body('nom').trim().notEmpty().withMessage('Nom requis').isLength({ max: 120 }),
  body('type').isIn(['banque', 'mobile_money', 'caisse']).withMessage('Type invalide'),
  body('devise').optional().isLength({ min: 3, max: 10 }),
  body('solde_initial').optional().isFloat({ min: -1e12, max: 1e12 }),
];

const mouvementRules = [
  body('sens').isIn(['entree', 'sortie']).withMessage('Sens invalide'),
  body('montant').isFloat({ gt: 0 }).withMessage('Montant requis (> 0)'),
  body('libelle').trim().notEmpty().withMessage('Libellé requis').isLength({ max: 255 }),
];

// ─── Helpers ──────────────────────────────────────────────────────────────
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// ─── Erreur métier : solde insuffisant ────────────────────────────────────
class SoldeInsuffisantError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SoldeInsuffisantError';
    this.code = 'SOLDE_INSUFFISANT';
    this.details = details;
  }
}

/**
 * Vérifie qu'une sortie est compatible avec le solde et le découvert autorisé.
 *
 *   - Caisse / mobile money sans découvert : refus si solde après < 0
 *   - Banque avec découvert : refus si solde après < -decouvert_max
 *   - Découvert autorisé sans plafond (max = 0) : aucune limite (équivalent à 0
 *     car par défaut on n'autorise pas un débit infini ; à l'utilisateur de
 *     définir un plafond explicite)
 *
 * @param {pg.Client} client       — transaction en cours
 * @param {string}    compteId     — id du compte à débiter
 * @param {number}    montantSortie — montant à sortir (positif)
 * @throws {SoldeInsuffisantError} si l'opération dépasserait l'autorisation
 * @returns {Object} { compte, solde_actuel, solde_apres }
 */
const controlerSoldeAvantSortie = async (client, compteId, montantSortie) => {
  const mt = round2(montantSortie);
  if (mt <= 0) return null;

  const r = await client.query(
    `SELECT ct.id, ct.nom, ct.type, ct.devise, ct.decouvert_autorise, ct.decouvert_max,
       ct.solde_initial
         + COALESCE((SELECT SUM(CASE WHEN sens='entree' THEN montant ELSE -montant END)
                     FROM mouvements_tresorerie WHERE compte_id = ct.id), 0) AS solde_actuel
     FROM comptes_tresorerie ct
     WHERE ct.id = $1 AND ct.archived_at IS NULL`,
    [compteId]
  );
  if (!r.rows[0]) {
    throw new Error('Compte de trésorerie introuvable ou archivé');
  }
  const compte = r.rows[0];
  const soldeActuel = round2(compte.solde_actuel);
  const soldeApres = round2(soldeActuel - mt);

  // Calcul du plancher autorisé : 0 si pas de découvert, sinon -decouvert_max
  const plancher = compte.decouvert_autorise
    ? -round2(parseFloat(compte.decouvert_max) || 0)
    : 0;

  if (soldeApres < plancher - 0.001) {
    const manque = round2(plancher - soldeApres);
    const labelCompte = compte.type === 'caisse' ? 'la caisse'
      : compte.type === 'mobile_money' ? 'le compte mobile money'
      : 'le compte bancaire';
    let msg;
    if (compte.decouvert_autorise && parseFloat(compte.decouvert_max) > 0) {
      msg = `Découvert dépassé sur ${compte.nom} : solde actuel ${soldeActuel.toLocaleString('fr-FR')} ${compte.devise}, sortie de ${mt.toLocaleString('fr-FR')} demandée, découvert max −${parseFloat(compte.decouvert_max).toLocaleString('fr-FR')}. Il manque ${manque.toLocaleString('fr-FR')} ${compte.devise}.`;
    } else {
      msg = `Solde insuffisant sur ${labelCompte} ${compte.nom} : ${soldeActuel.toLocaleString('fr-FR')} ${compte.devise} disponible, ${mt.toLocaleString('fr-FR')} demandé. Il manque ${manque.toLocaleString('fr-FR')} ${compte.devise}.`;
    }
    throw new SoldeInsuffisantError(msg, {
      compte_id: compteId, compte_nom: compte.nom, type: compte.type,
      solde_actuel: soldeActuel, montant_demande: mt, manque,
      decouvert_autorise: compte.decouvert_autorise,
      decouvert_max: parseFloat(compte.decouvert_max) || 0,
    });
  }

  return { compte, solde_actuel: soldeActuel, solde_apres: soldeApres };
};

// Calcule le solde d'un compte (solde_initial + entrées − sorties).
// Renvoie également le total non rapproché pour le rapprochement.
const calculerSolde = async (compteId) => {
  const r = await pool.query(`
    SELECT
      ct.solde_initial,
      COALESCE(SUM(CASE WHEN m.sens = 'entree' THEN m.montant ELSE 0 END), 0) AS total_entrees,
      COALESCE(SUM(CASE WHEN m.sens = 'sortie' THEN m.montant ELSE 0 END), 0) AS total_sorties,
      COUNT(CASE WHEN m.statut_rapprochement = 'non_rapproche' THEN 1 END) AS nb_non_rapproches,
      COALESCE(SUM(CASE WHEN m.statut_rapprochement = 'rapproche' AND m.sens = 'entree' THEN m.montant
                        WHEN m.statut_rapprochement = 'rapproche' AND m.sens = 'sortie' THEN -m.montant
                        ELSE 0 END), 0) AS solde_rapproche_delta
    FROM comptes_tresorerie ct
    LEFT JOIN mouvements_tresorerie m ON m.compte_id = ct.id
    WHERE ct.id = $1
    GROUP BY ct.id
  `, [compteId]);
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  const soldeInitial = parseFloat(row.solde_initial) || 0;
  const totalEntrees = parseFloat(row.total_entrees) || 0;
  const totalSorties = parseFloat(row.total_sorties) || 0;
  return {
    solde_initial: soldeInitial,
    total_entrees: totalEntrees,
    total_sorties: totalSorties,
    solde_actuel: round2(soldeInitial + totalEntrees - totalSorties),
    solde_rapproche: round2(soldeInitial + parseFloat(row.solde_rapproche_delta || 0)),
    nb_non_rapproches: parseInt(row.nb_non_rapproches || 0),
  };
};

// ─── COMPTES ──────────────────────────────────────────────────────────────

// GET /api/tresorerie/operateurs
const getOperateurs = async (req, res) => {
  res.json({ success: true, data: OPERATEURS });
};

// GET /api/tresorerie/comptes
const getComptes = async (req, res) => {
  try {
    const { type, inclure_archives = 'false' } = req.query;
    const eid = req.entrepriseId;

    let query = `
      SELECT ct.*,
        ct.solde_initial
          + COALESCE((SELECT SUM(CASE WHEN sens='entree' THEN montant ELSE -montant END)
                      FROM mouvements_tresorerie WHERE compte_id = ct.id), 0) AS solde_actuel,
        COALESCE((SELECT COUNT(*) FROM mouvements_tresorerie
                   WHERE compte_id = ct.id AND statut_rapprochement = 'non_rapproche'), 0) AS nb_non_rapproches
      FROM comptes_tresorerie ct
      WHERE ct.entreprise_id = $1
    `;
    const params = [eid];

    if (inclure_archives !== 'true') {
      query += ` AND ct.archived_at IS NULL`;
    }
    if (type) {
      params.push(type);
      query += ` AND ct.type = $${params.length}`;
    }
    query += ` ORDER BY ct.type, ct.par_defaut DESC, ct.nom ASC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getComptes:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/tresorerie/comptes/:id
const getCompteById = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const compte = await pool.query(
      `SELECT * FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!compte.rows[0]) {
      return res.status(404).json({ success: false, message: 'Compte introuvable' });
    }

    const solde = await calculerSolde(id);
    res.json({ success: true, data: { ...compte.rows[0], ...solde } });
  } catch (err) {
    console.error('Erreur getCompteById:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/tresorerie/comptes
const createCompte = async (req, res) => {
  try {
    const eid = req.entrepriseId;
    const {
      nom, type, operateur = null, numero_compte = null, titulaire = null,
      devise = 'XOF', solde_initial = 0, compte_pc_numero = null, par_defaut = false,
      decouvert_autorise, decouvert_max,
    } = req.body;

    // Compte SYSCOHADA par défaut selon le type
    const compteParDefaut = type === 'caisse' ? '5711'
      : type === 'mobile_money' ? '541'
      : '5211';

    // Découvert : par défaut autorisé seulement pour les banques
    const decAutorise = decouvert_autorise !== undefined ? !!decouvert_autorise : (type === 'banque');
    const decMax = decAutorise ? round2(decouvert_max || 0) : 0;

    // Si on demande par_defaut, on retire l'attribut sur les autres comptes du même type
    if (par_defaut) {
      await pool.query(
        `UPDATE comptes_tresorerie SET par_defaut = FALSE
         WHERE entreprise_id = $1 AND type = $2 AND archived_at IS NULL`,
        [eid, type]
      );
    }

    const result = await pool.query(
      `INSERT INTO comptes_tresorerie
        (entreprise_id, nom, type, operateur, numero_compte, titulaire, devise,
         solde_initial, compte_pc_numero, par_defaut, decouvert_autorise, decouvert_max)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [eid, nom, type, operateur, numero_compte, titulaire, devise,
       round2(solde_initial), compte_pc_numero || compteParDefaut, par_defaut,
       decAutorise, decMax]
    );

    logAudit(req, 'CREATE', 'comptes_tresorerie', result.rows[0].id, { nom, type, operateur });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur createCompte:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création compte' });
  }
};

// PUT /api/tresorerie/comptes/:id
const updateCompte = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const {
      nom, operateur, numero_compte, titulaire, devise,
      solde_initial, compte_pc_numero, par_defaut,
      decouvert_autorise, decouvert_max,
    } = req.body;

    const existing = await pool.query(
      `SELECT * FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ success: false, message: 'Compte introuvable' });
    }

    if (par_defaut === true) {
      await pool.query(
        `UPDATE comptes_tresorerie SET par_defaut = FALSE
         WHERE entreprise_id = $1 AND type = $2 AND archived_at IS NULL AND id != $3`,
        [eid, existing.rows[0].type, id]
      );
    }

    const result = await pool.query(
      `UPDATE comptes_tresorerie SET
        nom = COALESCE($1, nom),
        operateur = COALESCE($2, operateur),
        numero_compte = COALESCE($3, numero_compte),
        titulaire = COALESCE($4, titulaire),
        devise = COALESCE($5, devise),
        solde_initial = COALESCE($6, solde_initial),
        compte_pc_numero = COALESCE($7, compte_pc_numero),
        par_defaut = COALESCE($8, par_defaut),
        decouvert_autorise = COALESCE($11, decouvert_autorise),
        decouvert_max = COALESCE($12, decouvert_max),
        updated_at = NOW()
       WHERE id = $9 AND entreprise_id = $10
       RETURNING *`,
      [nom, operateur, numero_compte, titulaire, devise,
       solde_initial !== undefined ? round2(solde_initial) : null,
       compte_pc_numero, par_defaut, id, eid,
       decouvert_autorise !== undefined ? !!decouvert_autorise : null,
       decouvert_max !== undefined ? round2(decouvert_max) : null]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateCompte:', err.message);
    res.status(500).json({ success: false, message: 'Erreur mise à jour' });
  }
};

// DELETE /api/tresorerie/comptes/:id  (archive — pas de suppression dure pour préserver l'historique)
const archiveCompte = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    // Refuser l'archivage s'il y a des mouvements non rapprochés
    const check = await pool.query(
      `SELECT COUNT(*) FROM mouvements_tresorerie
       WHERE compte_id = $1 AND statut_rapprochement = 'non_rapproche'`,
      [id]
    );
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: `Ce compte a ${check.rows[0].count} mouvement(s) non rapproché(s). Rapprochez-les d'abord.`,
      });
    }

    const result = await pool.query(
      `UPDATE comptes_tresorerie SET archived_at = NOW(), par_defaut = FALSE
       WHERE id = $1 AND entreprise_id = $2 RETURNING id`,
      [id, eid]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Compte introuvable' });
    }
    res.json({ success: true, message: 'Compte archivé' });
  } catch (err) {
    console.error('Erreur archiveCompte:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── MOUVEMENTS ───────────────────────────────────────────────────────────

// GET /api/tresorerie/comptes/:id/mouvements
const getMouvements = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const {
      sens, statut_rapprochement, date_debut, date_fin,
      page = 1, limit = 30,
    } = req.query;

    // Sécurité : vérifie que le compte appartient à l'entreprise
    const check = await pool.query(
      `SELECT id FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!check.rows[0]) {
      return res.status(404).json({ success: false, message: 'Compte introuvable' });
    }

    let query = `
      SELECT m.*, u.nom AS cree_par_nom
      FROM mouvements_tresorerie m
      LEFT JOIN utilisateurs u ON u.id = m.cree_par
      WHERE m.compte_id = $1
    `;
    const params = [id];
    if (sens) { params.push(sens); query += ` AND m.sens = $${params.length}`; }
    if (statut_rapprochement) {
      params.push(statut_rapprochement);
      query += ` AND m.statut_rapprochement = $${params.length}`;
    }
    if (date_debut) { params.push(date_debut); query += ` AND m.date_operation >= $${params.length}`; }
    if (date_fin)   { params.push(date_fin);   query += ` AND m.date_operation <= $${params.length}`; }

    const countQuery = query.replace(/SELECT.*?FROM/s, 'SELECT COUNT(*) FROM');
    const countRes = await pool.query(countQuery, params);

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    query += ` ORDER BY m.date_operation DESC, m.created_at DESC
               LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countRes.rows[0].count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Erreur getMouvements:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/tresorerie/comptes/:id/mouvements  (saisie manuelle)
// Body optionnel : { compte_contrepartie } pour pointer un compte SYSCOHADA
// précis (ex. 627 pour des frais bancaires). À défaut, on impute sur 658/758
// pour signaler qu'une régularisation est nécessaire.
const createMouvement = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const { date_operation, sens, montant, libelle, reference, compte_contrepartie } = req.body;

    await client.query('BEGIN');

    const check = await client.query(
      `SELECT id, type, compte_pc_numero, nom FROM comptes_tresorerie
       WHERE id = $1 AND entreprise_id = $2 AND archived_at IS NULL`,
      [id, eid]
    );
    if (!check.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Compte introuvable ou archivé' });
    }
    const compte = check.rows[0];

    const dateOp = date_operation || new Date().toISOString().split('T')[0];
    const exId = await trouverExerciceOuvert(client, eid, dateOp);
    if (!exId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Aucun exercice ouvert pour la date ${String(dateOp).slice(0, 10)}. L'exercice correspondant est clôturé.`,
        code: 'EXERCICE_FERME',
      });
    }

    if (sens === 'sortie') {
      await controlerSoldeAvantSortie(client, id, montant);
    }

    const montantR = round2(montant);
    const result = await client.query(
      `INSERT INTO mouvements_tresorerie
        (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, cree_par)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'manuel',$8)
       RETURNING *`,
      [eid, id, dateOp, sens, montantR, libelle, reference || null, req.user?.id]
    );
    const mouvement = result.rows[0];

    // Écriture comptable : D compte SYSCOHADA / C contrepartie (entrée)
    //                     D contrepartie / C compte SYSCOHADA (sortie)
    let ecPiece = null;
    if (compte.compte_pc_numero) {
      const contrepartie = compte_contrepartie
        || (sens === 'entree' ? CONTREPARTIE_DEFAUT_ENTREE : CONTREPARTIE_DEFAUT_SORTIE);
      const lignes = sens === 'entree'
        ? [
            { compte: compte.compte_pc_numero, debit: montantR, libelle },
            { compte: contrepartie,            credit: montantR, libelle },
          ]
        : [
            { compte: contrepartie,            debit: montantR, libelle },
            { compte: compte.compte_pc_numero, credit: montantR, libelle },
          ];
      const ecriture = await safeCompta(`mouvement ${compte.nom}`, () =>
        creerEcriture(client, {
          entrepriseId: eid,
          utilisateurId: req.user?.id,
          journalCode: journalPourType(compte.type),
          date: dateOp,
          libelle: libelle.slice(0, 250),
          reference: reference || null,
          origine: 'AUTO_TRESORERIE_MANUEL',
          origineId: mouvement.id,
          lignes,
        })
      );
      ecPiece = ecriture?.numero_piece || null;
    }

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'mouvements_tresorerie', mouvement.id,
      { sens, montant: montantR, libelle, ecriture: ecPiece });

    res.status(201).json({ success: true, data: mouvement });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof SoldeInsuffisantError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code, details: err.details });
    }
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur createMouvement:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création mouvement' });
  } finally {
    client.release();
  }
};

// POST /api/tresorerie/transfert  (transfert inter-comptes)
const transfererEntreComptes = async (req, res) => {
  const client = await pool.connect();
  try {
    const eid = req.entrepriseId;
    const { compte_source_id, compte_destination_id, montant, date_operation, libelle, reference } = req.body;

    if (!compte_source_id || !compte_destination_id || compte_source_id === compte_destination_id) {
      return res.status(400).json({ success: false, message: 'Comptes source et destination doivent différer' });
    }
    const m = round2(montant);
    if (!m || m <= 0) {
      return res.status(400).json({ success: false, message: 'Montant invalide' });
    }

    await client.query('BEGIN');

    const sourceRes = await client.query(
      `SELECT * FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [compte_source_id, eid]
    );
    const destRes = await client.query(
      `SELECT * FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [compte_destination_id, eid]
    );
    if (!sourceRes.rows[0] || !destRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Compte introuvable' });
    }

    // Garde-fou clôture : un transfert antidaté dans un exercice clos fait
    // diverger la balance fournisseur figée des soldes courants de trésorerie.
    // Même justification que pour createMouvement (pas d'écriture comptable
    // auto, donc creerEcriture ne protège pas).
    const dateOp = (date_operation && String(date_operation).slice(0, 10)) || new Date().toISOString().split('T')[0];
    const exId = await trouverExerciceOuvert(client, eid, dateOp);
    if (!exId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Aucun exercice ouvert pour la date ${dateOp}. L'exercice correspondant est clôturé.`,
        code: 'EXERCICE_FERME',
      });
    }

    // Contrôle de solde sur le compte source
    await controlerSoldeAvantSortie(client, compte_source_id, m);
    const libelleFinal = libelle || `Transfert ${sourceRes.rows[0].nom} → ${destRes.rows[0].nom}`;
    const transfertGroupRef = `TRF-${Date.now()}`;

    const sortie = await client.query(
      `INSERT INTO mouvements_tresorerie
        (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, cree_par)
       VALUES ($1,$2,$3,'sortie',$4,$5,$6,'transfert',$7) RETURNING *`,
      [eid, compte_source_id, dateOp, m, libelleFinal, reference || transfertGroupRef, req.user?.id]
    );
    const entree = await client.query(
      `INSERT INTO mouvements_tresorerie
        (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, source_id, cree_par)
       VALUES ($1,$2,$3,'entree',$4,$5,$6,'transfert',$7,$8) RETURNING *`,
      [eid, compte_destination_id, dateOp, m, libelleFinal, reference || transfertGroupRef, sortie.rows[0].id, req.user?.id]
    );
    // Lien réciproque
    await client.query(
      `UPDATE mouvements_tresorerie SET source_id = $1 WHERE id = $2`,
      [entree.rows[0].id, sortie.rows[0].id]
    );

    // Écriture comptable du transfert : D 521 dest / C 521 source
    // (journal OD ; on n'utilise pas BNK/CAI/MM car un transfert touche les
    // deux côtés et la convention courante est de le passer en OD). Si l'un
    // des comptes n'a pas de compte SYSCOHADA lié, on saute (l'utilisateur
    // pourra régulariser en OD manuel).
    let ecPiece = null;
    const source = sourceRes.rows[0];
    const dest = destRes.rows[0];
    if (source.compte_pc_numero && dest.compte_pc_numero) {
      const ecriture = await safeCompta(`transfert ${source.nom} → ${dest.nom}`, () =>
        creerEcriture(client, {
          entrepriseId: eid,
          utilisateurId: req.user?.id,
          journalCode: 'OD',
          date: dateOp,
          libelle: libelleFinal.slice(0, 250),
          reference: reference || transfertGroupRef,
          origine: 'AUTO_TRANSFERT',
          origineId: sortie.rows[0].id,
          lignes: [
            { compte: dest.compte_pc_numero,   debit: m,  libelle: `Entrée ${dest.nom}` },
            { compte: source.compte_pc_numero, credit: m, libelle: `Sortie ${source.nom}` },
          ],
        })
      );
      ecPiece = ecriture?.numero_piece || null;
    }

    await client.query('COMMIT');
    logAudit(req, 'TRANSFER', 'mouvements_tresorerie', sortie.rows[0].id,
      { source: source.nom, dest: dest.nom, montant: m, ecriture: ecPiece });

    res.status(201).json({
      success: true,
      data: { sortie: sortie.rows[0], entree: entree.rows[0] },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof SoldeInsuffisantError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code, details: err.details });
    }
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur transfererEntreComptes:', err.message);
    res.status(500).json({ success: false, message: 'Erreur transfert' });
  } finally {
    client.release();
  }
};

// DELETE /api/tresorerie/mouvements/:id  (suppression — uniquement saisie manuelle non rapprochée)
const deleteMouvement = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const mvt = await pool.query(
      `SELECT * FROM mouvements_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!mvt.rows[0]) {
      return res.status(404).json({ success: false, message: 'Mouvement introuvable' });
    }
    if (mvt.rows[0].source_type !== 'manuel' && mvt.rows[0].source_type !== 'transfert') {
      return res.status(400).json({
        success: false,
        message: 'Seuls les mouvements manuels ou transferts peuvent être supprimés. Annulez le paiement à la source.',
      });
    }
    if (mvt.rows[0].statut_rapprochement === 'rapproche') {
      return res.status(400).json({ success: false, message: 'Mouvement rapproché — délier d\'abord' });
    }

    // Si transfert : supprimer le mouvement réciproque
    if (mvt.rows[0].source_type === 'transfert' && mvt.rows[0].source_id) {
      await pool.query(`DELETE FROM mouvements_tresorerie WHERE id = $1`, [mvt.rows[0].source_id]);
    }
    await pool.query(`DELETE FROM mouvements_tresorerie WHERE id = $1`, [id]);

    res.json({ success: true, message: 'Mouvement supprimé' });
  } catch (err) {
    console.error('Erreur deleteMouvement:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── IMPORT RELEVÉ CSV ────────────────────────────────────────────────────
// Parser CSV minimaliste : gère les guillemets et les virgules échappées.
const parseCSV = (text) => {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

  // Auto-détection du séparateur sur la première ligne (; , tab)
  const first = lines[0] || '';
  const seps = [';', ',', '\t', '|'];
  let sep = ',';
  let max = 0;
  for (const s of seps) {
    const c = first.split(s).length;
    if (c > max) { max = c; sep = s; }
  }

  for (const line of lines) {
    const cells = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = !inQuote; }
      else if (ch === sep && !inQuote) { cells.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
};

// Détecte la position des colonnes à partir de l'en-tête (en français + anglais)
const detecterColonnes = (header) => {
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const idx = (patterns) => header.findIndex(h => patterns.some(p => norm(h).includes(p)));

  return {
    date:    idx(['date oper', 'date_oper', 'date opération', 'date op', 'transaction date', 'date']),
    valeur:  idx(['date valeur', 'valeur', 'value date']),
    libelle: idx(['libelle', 'libellé', 'description', 'designation', 'narration', 'motif', 'memo']),
    debit:   idx(['debit', 'débit', 'sortie', 'retrait', 'withdraw']),
    credit:  idx(['credit', 'crédit', 'entree', 'entrée', 'depot', 'dépôt', 'deposit']),
    montant: idx(['montant', 'amount', 'mt']),
    sens:    idx(['sens', 'type', 'direction']),
    ref:     idx(['reference', 'référence', 'ref', 'piece', 'transaction id', 'id']),
  };
};

const parseMontant = (s) => {
  if (s === null || s === undefined) return 0;
  const str = String(s).replace(/\s/g, '').replace(/[€$£FCFAxofXOF]/g, '').replace(/,/g, '.');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
};

const parseDate = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  // Format français DD/MM/YYYY ou DD-MM-YYYY
  let m = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3]); if (y < 100) y += 2000;
    return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  }
  // Format ISO YYYY-MM-DD
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

// POST /api/tresorerie/comptes/:id/releves   (body : { contenu_csv: string, fichier_nom?: string })
const importerReleve = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;
    const { contenu_csv, fichier_nom = 'releve.csv' } = req.body;

    if (!contenu_csv || typeof contenu_csv !== 'string') {
      return res.status(400).json({ success: false, message: 'Contenu CSV requis' });
    }

    const compteRes = await pool.query(
      `SELECT * FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!compteRes.rows[0]) {
      return res.status(404).json({ success: false, message: 'Compte introuvable' });
    }

    const rows = parseCSV(contenu_csv);
    if (rows.length < 2) {
      return res.status(400).json({ success: false, message: 'Fichier vide ou format inattendu' });
    }

    const colonnes = detecterColonnes(rows[0]);
    if (colonnes.date < 0 || colonnes.libelle < 0) {
      return res.status(400).json({
        success: false,
        message: 'En-tête non reconnue. Colonnes attendues : Date, Libellé, Débit/Crédit ou Montant',
      });
    }

    // Parse toutes les lignes (sans la première = en-tête)
    const lignesPretes = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const date = parseDate(row[colonnes.date]);
      if (!date) continue;

      const libelle = (row[colonnes.libelle] || '').slice(0, 500);
      const reference = colonnes.ref >= 0 ? (row[colonnes.ref] || '').slice(0, 100) : null;
      const valeur = colonnes.valeur >= 0 ? parseDate(row[colonnes.valeur]) : null;

      let sens, montant;
      if (colonnes.debit >= 0 && colonnes.credit >= 0) {
        const d = parseMontant(row[colonnes.debit]);
        const c = parseMontant(row[colonnes.credit]);
        if (d > 0)      { sens = 'sortie'; montant = d; }
        else if (c > 0) { sens = 'entree'; montant = c; }
        else continue;
      } else if (colonnes.montant >= 0) {
        const m = parseMontant(row[colonnes.montant]);
        if (m === 0) continue;
        montant = Math.abs(m);
        if (colonnes.sens >= 0) {
          const s = String(row[colonnes.sens] || '').toLowerCase();
          sens = s.includes('cred') || s.includes('ent') || s.includes('dep') ? 'entree' : 'sortie';
        } else {
          sens = m >= 0 ? 'entree' : 'sortie';
        }
      } else continue;

      lignesPretes.push({ date, valeur, libelle, reference, sens, montant: round2(montant) });
    }

    if (lignesPretes.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune ligne valide détectée' });
    }

    await client.query('BEGIN');

    const dateDebut = lignesPretes.reduce((m, l) => l.date < m ? l.date : m, lignesPretes[0].date);
    const dateFin   = lignesPretes.reduce((m, l) => l.date > m ? l.date : m, lignesPretes[0].date);

    const releveRes = await client.query(
      `INSERT INTO releves_bancaires
        (entreprise_id, compte_id, fichier_nom, date_debut, date_fin, nb_lignes, importe_par)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [eid, id, fichier_nom, dateDebut, dateFin, lignesPretes.length, req.user?.id]
    );
    const releveId = releveRes.rows[0].id;

    for (let i = 0; i < lignesPretes.length; i++) {
      const l = lignesPretes[i];
      await client.query(
        `INSERT INTO lignes_releve
          (releve_id, date_operation, date_valeur, libelle, reference, sens, montant, ordre)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [releveId, l.date, l.valeur, l.libelle, l.reference, l.sens, l.montant, i]
      );
    }

    await client.query('COMMIT');

    logAudit(req, 'IMPORT', 'releves_bancaires', releveId, { fichier: fichier_nom, lignes: lignesPretes.length });

    res.status(201).json({
      success: true,
      data: { releve: releveRes.rows[0], nb_lignes: lignesPretes.length },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur importerReleve:', err.message);
    res.status(500).json({ success: false, message: 'Erreur import relevé' });
  } finally {
    client.release();
  }
};

// GET /api/tresorerie/comptes/:id/releves
const getReleves = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const result = await pool.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM lignes_releve WHERE releve_id = r.id AND statut_matching = 'matche') AS nb_matches,
        (SELECT COUNT(*) FROM lignes_releve WHERE releve_id = r.id) AS nb_total
       FROM releves_bancaires r
       WHERE r.compte_id = $1 AND r.entreprise_id = $2
       ORDER BY r.date_fin DESC, r.created_at DESC`,
      [id, eid]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getReleves:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/tresorerie/releves/:id  (détail + lignes + propositions de matching)
const getReleveDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const releveRes = await pool.query(
      `SELECT r.*, ct.nom AS compte_nom
       FROM releves_bancaires r
       JOIN comptes_tresorerie ct ON ct.id = r.compte_id
       WHERE r.id = $1 AND r.entreprise_id = $2`,
      [id, eid]
    );
    if (!releveRes.rows[0]) {
      return res.status(404).json({ success: false, message: 'Relevé introuvable' });
    }
    const releve = releveRes.rows[0];

    const lignes = await pool.query(
      `SELECT lr.*, m.libelle AS mouvement_libelle, m.reference AS mouvement_reference
       FROM lignes_releve lr
       LEFT JOIN mouvements_tresorerie m ON m.id = lr.mouvement_id
       WHERE lr.releve_id = $1 ORDER BY lr.ordre ASC`,
      [id]
    );

    // Mouvements candidats du compte sur la période (non rapprochés)
    const candidats = await pool.query(
      `SELECT * FROM mouvements_tresorerie
       WHERE compte_id = $1
         AND statut_rapprochement = 'non_rapproche'
         AND date_operation BETWEEN $2::date - INTERVAL '7 days' AND $3::date + INTERVAL '7 days'
       ORDER BY date_operation ASC`,
      [releve.compte_id, releve.date_debut, releve.date_fin]
    );

    res.json({
      success: true,
      data: { releve, lignes: lignes.rows, candidats: candidats.rows },
    });
  } catch (err) {
    console.error('Erreur getReleveDetail:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/tresorerie/releves/:id/auto-match
// Tente d'apparier automatiquement par montant exact + date proche (±3 jours).
const autoMatch = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const releveRes = await pool.query(
      `SELECT * FROM releves_bancaires WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!releveRes.rows[0]) {
      return res.status(404).json({ success: false, message: 'Relevé introuvable' });
    }
    const compteId = releveRes.rows[0].compte_id;

    // Lignes non matchées
    const lignesRes = await pool.query(
      `SELECT * FROM lignes_releve WHERE releve_id = $1 AND statut_matching = 'non_matche' ORDER BY ordre`,
      [id]
    );

    await client.query('BEGIN');
    let nbMatches = 0;

    for (const ligne of lignesRes.rows) {
      // Recherche un mouvement unique avec même sens, même montant et date à ±3 jours
      const match = await client.query(
        `SELECT id FROM mouvements_tresorerie
         WHERE compte_id = $1
           AND statut_rapprochement = 'non_rapproche'
           AND sens = $2
           AND montant = $3
           AND date_operation BETWEEN $4::date - INTERVAL '3 days' AND $4::date + INTERVAL '3 days'
         LIMIT 2`,
        [compteId, ligne.sens, ligne.montant, ligne.date_operation]
      );
      // On ne matche que si exactement 1 candidat unique
      if (match.rows.length === 1) {
        const mvtId = match.rows[0].id;
        await client.query(
          `UPDATE lignes_releve SET statut_matching = 'matche', mouvement_id = $1 WHERE id = $2`,
          [mvtId, ligne.id]
        );
        await client.query(
          `UPDATE mouvements_tresorerie SET statut_rapprochement = 'rapproche', ligne_releve_id = $1
           WHERE id = $2`,
          [ligne.id, mvtId]
        );
        nbMatches++;
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, data: { nb_matches: nbMatches } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur autoMatch:', err.message);
    res.status(500).json({ success: false, message: 'Erreur matching automatique' });
  } finally {
    client.release();
  }
};

// POST /api/tresorerie/lignes-releve/:id/rapprocher  (body : { mouvement_id })
const rapprocherLigne = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { mouvement_id } = req.body;
    const eid = req.entrepriseId;

    if (!mouvement_id) {
      return res.status(400).json({ success: false, message: 'mouvement_id requis' });
    }

    const ligneRes = await pool.query(
      `SELECT lr.*, r.entreprise_id FROM lignes_releve lr
       JOIN releves_bancaires r ON r.id = lr.releve_id
       WHERE lr.id = $1`,
      [id]
    );
    if (!ligneRes.rows[0] || ligneRes.rows[0].entreprise_id !== eid) {
      return res.status(404).json({ success: false, message: 'Ligne introuvable' });
    }

    const mvtRes = await pool.query(
      `SELECT * FROM mouvements_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [mouvement_id, eid]
    );
    if (!mvtRes.rows[0]) {
      return res.status(404).json({ success: false, message: 'Mouvement introuvable' });
    }

    await client.query('BEGIN');

    // Si la ligne ou le mouvement était déjà matché, on délie d'abord
    if (ligneRes.rows[0].mouvement_id) {
      await client.query(
        `UPDATE mouvements_tresorerie SET statut_rapprochement = 'non_rapproche', ligne_releve_id = NULL
         WHERE id = $1`,
        [ligneRes.rows[0].mouvement_id]
      );
    }

    await client.query(
      `UPDATE lignes_releve SET statut_matching = 'matche', mouvement_id = $1 WHERE id = $2`,
      [mouvement_id, id]
    );
    await client.query(
      `UPDATE mouvements_tresorerie SET statut_rapprochement = 'rapproche', ligne_releve_id = $1
       WHERE id = $2`,
      [id, mouvement_id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Ligne rapprochée' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur rapprocherLigne:', err.message);
    res.status(500).json({ success: false, message: 'Erreur rapprochement' });
  } finally {
    client.release();
  }
};

// POST /api/tresorerie/lignes-releve/:id/delier
const delierLigne = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const ligneRes = await pool.query(
      `SELECT lr.*, r.entreprise_id FROM lignes_releve lr
       JOIN releves_bancaires r ON r.id = lr.releve_id
       WHERE lr.id = $1`,
      [id]
    );
    if (!ligneRes.rows[0] || ligneRes.rows[0].entreprise_id !== eid) {
      return res.status(404).json({ success: false, message: 'Ligne introuvable' });
    }
    const ligne = ligneRes.rows[0];

    await client.query('BEGIN');
    if (ligne.mouvement_id) {
      await client.query(
        `UPDATE mouvements_tresorerie SET statut_rapprochement = 'non_rapproche', ligne_releve_id = NULL
         WHERE id = $1`,
        [ligne.mouvement_id]
      );
    }
    await client.query(
      `UPDATE lignes_releve SET statut_matching = 'non_matche', mouvement_id = NULL WHERE id = $1`,
      [id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Lien retiré' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur delierLigne:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  } finally {
    client.release();
  }
};

// POST /api/tresorerie/lignes-releve/:id/creer-mouvement
// Crée un mouvement de trésorerie à partir d'une ligne de relevé non encore reconnue dans l'app.
const creerMouvementDepuisLigne = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const ligneRes = await pool.query(
      `SELECT lr.*, r.compte_id, r.entreprise_id FROM lignes_releve lr
       JOIN releves_bancaires r ON r.id = lr.releve_id
       WHERE lr.id = $1`,
      [id]
    );
    if (!ligneRes.rows[0] || ligneRes.rows[0].entreprise_id !== eid) {
      return res.status(404).json({ success: false, message: 'Ligne introuvable' });
    }
    const ligne = ligneRes.rows[0];
    if (ligne.statut_matching === 'matche') {
      return res.status(400).json({ success: false, message: 'Ligne déjà rapprochée' });
    }

    await client.query('BEGIN');
    const mvtRes = await client.query(
      `INSERT INTO mouvements_tresorerie
        (entreprise_id, compte_id, date_operation, sens, montant, libelle, reference, source_type, cree_par, statut_rapprochement, ligne_releve_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'releve',$8,'rapproche',$9)
       RETURNING *`,
      [eid, ligne.compte_id, ligne.date_operation, ligne.sens, ligne.montant,
       ligne.libelle, ligne.reference, req.user?.id, id]
    );
    await client.query(
      `UPDATE lignes_releve SET statut_matching = 'matche', mouvement_id = $1 WHERE id = $2`,
      [mvtRes.rows[0].id, id]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: mvtRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur creerMouvementDepuisLigne:', err.message);
    res.status(500).json({ success: false, message: 'Erreur création' });
  } finally {
    client.release();
  }
};

// DELETE /api/tresorerie/releves/:id  (supprime un relevé et délie ses mouvements)
const deleteReleve = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const releveRes = await pool.query(
      `SELECT * FROM releves_bancaires WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!releveRes.rows[0]) {
      return res.status(404).json({ success: false, message: 'Relevé introuvable' });
    }

    await client.query('BEGIN');
    // Délier les mouvements rattachés (mais ne pas les supprimer)
    await client.query(
      `UPDATE mouvements_tresorerie SET statut_rapprochement = 'non_rapproche', ligne_releve_id = NULL
       WHERE ligne_releve_id IN (SELECT id FROM lignes_releve WHERE releve_id = $1)`,
      [id]
    );
    // Supprimer les lignes du relevé puis le relevé lui-même
    await client.query(`DELETE FROM lignes_releve WHERE releve_id = $1`, [id]);
    await client.query(`DELETE FROM releves_bancaires WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Relevé supprimé' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur deleteReleve:', err.message);
    res.status(500).json({ success: false, message: 'Erreur' });
  } finally {
    client.release();
  }
};

// ─── POST /api/tresorerie/comptes/:id/tout-rapprocher ──────────────────────
// Rapprochement EN MASSE de tous les mouvements non rapprochés du compte.
// Mode "TPE de confiance" : pour les petites structures qui n'importent pas
// de relevé bancaire et veulent juste valider en bloc que toutes leurs
// saisies correspondent à la réalité bancaire. Une note obligatoire est
// stockée par mouvement pour traçabilité audit.
const toutRapprocher = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    // Vérifie que le compte appartient bien à l'entreprise
    const compte = await pool.query(
      `SELECT id, nom FROM comptes_tresorerie WHERE id = $1 AND entreprise_id = $2`,
      [id, eid]
    );
    if (!compte.rows[0]) return res.status(404).json({ success: false, message: 'Compte introuvable' });

    const r = await pool.query(
      `UPDATE mouvements_tresorerie
          SET statut_rapprochement = 'rapproche'
        WHERE compte_id = $1 AND statut_rapprochement = 'non_rapproche'
        RETURNING id`,
      [id]
    );

    res.json({
      success: true,
      message: `${r.rowCount} mouvement(s) rapproché(s)`,
      count: r.rowCount,
    });
  } catch (err) {
    console.error('Erreur toutRapprocher:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  // Comptes
  getOperateurs, getComptes, getCompteById, createCompte, updateCompte, archiveCompte,
  compteRules,
  // Mouvements
  getMouvements, createMouvement, deleteMouvement, transfererEntreComptes,
  mouvementRules,
  // Relevés / rapprochement
  importerReleve, getReleves, getReleveDetail, autoMatch,
  rapprocherLigne, delierLigne, creerMouvementDepuisLigne, deleteReleve,
  toutRapprocher,
  // Helpers exportés pour les autres contrôleurs
  controlerSoldeAvantSortie, SoldeInsuffisantError,
};
