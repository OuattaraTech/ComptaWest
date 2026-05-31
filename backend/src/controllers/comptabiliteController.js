const pool = require('../../config/database');
const ExcelJS = require('exceljs');
const { creerEcriture, ComptaError } = require('../utils/comptabilite');
const {
  verifierPreCloture, ecritureSoldeCharges, ecritureSoldeProduits, ecritureSoldeHAO,
  creerExerciceSuivant, ecritureAANouveau,
} = require('../utils/cloture');
const { logAudit } = require('../utils/audit');

// ─── PLAN COMPTABLE ────────────────────────────────────────────────────────
// GET /api/comptabilite/plan
const getPlanComptable = async (req, res) => {
  try {
    const { classe, search } = req.query;
    const eid = req.entrepriseId;
    const conditions = ['entreprise_id = $1', 'actif = true'];
    const params = [eid];

    if (classe) {
      params.push(parseInt(classe));
      conditions.push(`classe = $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(numero ILIKE $${params.length} OR libelle ILIKE $${params.length})`);
    }

    const result = await pool.query(
      `SELECT id, numero, libelle, classe, nature, est_systeme, est_lettrable, parent_numero
       FROM plan_comptable
       WHERE ${conditions.join(' AND ')}
       ORDER BY numero ASC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getPlanComptable:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── JOURNAUX ──────────────────────────────────────────────────────────────
// GET /api/comptabilite/journaux
const getJournaux = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, code, libelle, type, compte_contrepartie, est_systeme
       FROM journaux WHERE entreprise_id=$1 AND actif=true ORDER BY code`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── EXERCICES ─────────────────────────────────────────────────────────────
// GET /api/comptabilite/exercices
const getExercices = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, libelle, date_debut, date_fin, cloture, date_cloture
       FROM exercices WHERE entreprise_id=$1 ORDER BY date_debut DESC`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── JOURNAL GÉNÉRAL (liste paginée d'écritures) ───────────────────────────
// GET /api/comptabilite/ecritures
const getEcritures = async (req, res) => {
  try {
    const {
      journal_code, date_debut, date_fin, search, origine,
      page = 1, limit = 50,
    } = req.query;
    const eid = req.entrepriseId;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * limitNum;

    // Cohérence avec getGrandLivre et getBalance : on n'expose que les écritures
    // validées. Une écriture brouillon ne doit pas non plus apparaître dans le
    // journal général tant qu'elle n'est pas confirmée.
    const conditions = ['e.entreprise_id = $1', 'e.validee = true'];
    const params     = [eid];

    if (journal_code) {
      params.push(journal_code);
      conditions.push(`j.code = $${params.length}`);
    }
    if (date_debut) {
      params.push(date_debut);
      conditions.push(`e.date_ecriture >= $${params.length}`);
    }
    if (date_fin) {
      params.push(date_fin);
      conditions.push(`e.date_ecriture <= $${params.length}`);
    }
    if (origine) {
      params.push(origine);
      conditions.push(`e.origine = $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(e.libelle ILIKE $${params.length} OR e.numero_piece ILIKE $${params.length} OR e.reference ILIKE $${params.length})`);
    }

    const where = conditions.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM ecritures e
       LEFT JOIN journaux j ON j.id = e.journal_id
       WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT e.id, e.numero_piece, e.date_ecriture, e.libelle, e.reference, e.origine,
              e.validee, e.created_at,
              j.code AS journal_code, j.libelle AS journal_libelle,
              u.nom AS cree_par_nom,
              (SELECT COALESCE(SUM(debit),0) FROM lignes_ecriture WHERE ecriture_id = e.id) AS total_debit,
              (SELECT COALESCE(SUM(credit),0) FROM lignes_ecriture WHERE ecriture_id = e.id) AS total_credit
       FROM ecritures e
       LEFT JOIN journaux j ON j.id = e.journal_id
       LEFT JOIN utilisateurs u ON u.id = e.cree_par
       WHERE ${where}
       ORDER BY e.date_ecriture DESC, e.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (err) {
    console.error('Erreur getEcritures:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/comptabilite/ecritures/:id — détail avec lignes
const getEcritureById = async (req, res) => {
  try {
    const { id } = req.params;
    const ecRes = await pool.query(
      `SELECT e.*, j.code AS journal_code, j.libelle AS journal_libelle, u.nom AS cree_par_nom
       FROM ecritures e
       LEFT JOIN journaux j ON j.id = e.journal_id
       LEFT JOIN utilisateurs u ON u.id = e.cree_par
       WHERE e.id=$1 AND e.entreprise_id=$2`,
      [id, req.entrepriseId]
    );
    if (ecRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Écriture introuvable' });
    }
    const lignesRes = await pool.query(
      `SELECT l.*, pc.libelle AS compte_libelle
       FROM lignes_ecriture l
       LEFT JOIN plan_comptable pc ON pc.id = l.compte_id
       WHERE l.ecriture_id=$1 ORDER BY l.ordre`,
      [id]
    );
    res.json({ success: true, data: { ...ecRes.rows[0], lignes: lignesRes.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── GRAND LIVRE (toutes les lignes d'un compte sur une période) ──────────
// GET /api/comptabilite/grand-livre?compte=411&date_debut=...&date_fin=...
const getGrandLivre = async (req, res) => {
  try {
    const { compte, date_debut, date_fin } = req.query;
    const eid = req.entrepriseId;

    if (!compte) {
      return res.status(400).json({ success: false, message: 'Paramètre compte requis' });
    }

    const conditions = ['e.entreprise_id = $1', 'e.validee = true'];
    const params = [eid];

    // Tous les sous-comptes commençant par le préfixe (ex : 411 → 411, 4111, 41115…)
    params.push(`${compte}%`);
    conditions.push(`l.compte_numero LIKE $${params.length}`);

    if (date_debut) { params.push(date_debut); conditions.push(`e.date_ecriture >= $${params.length}`); }
    if (date_fin)   { params.push(date_fin);   conditions.push(`e.date_ecriture <= $${params.length}`); }

    const result = await pool.query(
      `SELECT l.id, l.compte_numero, l.libelle AS ligne_libelle, l.debit, l.credit, l.lettrage,
              e.id AS ecriture_id, e.numero_piece, e.date_ecriture, e.libelle AS ecriture_libelle,
              e.reference, j.code AS journal_code
       FROM lignes_ecriture l
       JOIN ecritures e ON e.id = l.ecriture_id
       LEFT JOIN journaux j ON j.id = e.journal_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.date_ecriture, e.created_at, l.ordre`,
      params
    );

    let soldeProgressif = 0;
    const lignesAvecSolde = result.rows.map(r => {
      soldeProgressif += parseFloat(r.debit) - parseFloat(r.credit);
      return { ...r, debit: parseFloat(r.debit), credit: parseFloat(r.credit), solde: Math.round(soldeProgressif * 100) / 100 };
    });

    const totalDebit  = lignesAvecSolde.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lignesAvecSolde.reduce((s, l) => s + l.credit, 0);

    res.json({
      success: true,
      data: {
        compte,
        lignes: lignesAvecSolde,
        totaux: {
          debit:  Math.round(totalDebit  * 100) / 100,
          credit: Math.round(totalCredit * 100) / 100,
          solde:  Math.round((totalDebit - totalCredit) * 100) / 100,
        },
      },
    });
  } catch (err) {
    console.error('Erreur getGrandLivre:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── BALANCE GÉNÉRALE ──────────────────────────────────────────────────────
// GET /api/comptabilite/balance?date_debut=...&date_fin=...&niveau=2
// niveau = nombre de digits de regroupement (2 = comptes principaux, 3 = sous-comptes…)
const getBalance = async (req, res) => {
  try {
    const { date_debut, date_fin, niveau = 4 } = req.query;
    const eid = req.entrepriseId;
    const niveauNum = Math.max(1, Math.min(8, parseInt(niveau)));

    const conditions = ['e.entreprise_id = $1', 'e.validee = true'];
    const params = [eid];
    if (date_debut) { params.push(date_debut); conditions.push(`e.date_ecriture >= $${params.length}`); }
    if (date_fin)   { params.push(date_fin);   conditions.push(`e.date_ecriture <= $${params.length}`); }

    // Agrégation par compte au niveau demandé (left() PostgreSQL pour tronquer)
    const result = await pool.query(
      `SELECT LEFT(l.compte_numero, $${params.length + 1}) AS compte,
              MIN(pc.libelle) AS libelle,
              MIN(pc.classe) AS classe,
              SUM(l.debit) AS total_debit,
              SUM(l.credit) AS total_credit
       FROM lignes_ecriture l
       JOIN ecritures e ON e.id = l.ecriture_id
       LEFT JOIN plan_comptable pc
         ON pc.entreprise_id = e.entreprise_id
        AND pc.numero = LEFT(l.compte_numero, $${params.length + 1})
       WHERE ${conditions.join(' AND ')}
       GROUP BY LEFT(l.compte_numero, $${params.length + 1})
       ORDER BY compte`,
      [...params, niveauNum]
    );

    const lignes = result.rows.map(r => {
      const debit  = parseFloat(r.total_debit);
      const credit = parseFloat(r.total_credit);
      return {
        compte: r.compte,
        libelle: r.libelle || '(libellé inconnu)',
        classe: r.classe,
        total_debit: debit,
        total_credit: credit,
        solde_debiteur:  debit > credit ? Math.round((debit - credit) * 100) / 100 : 0,
        solde_crediteur: credit > debit ? Math.round((credit - debit) * 100) / 100 : 0,
      };
    });

    const totaux = lignes.reduce(
      (acc, l) => ({
        debit:           acc.debit           + l.total_debit,
        credit:          acc.credit          + l.total_credit,
        solde_debiteur:  acc.solde_debiteur  + l.solde_debiteur,
        solde_crediteur: acc.solde_crediteur + l.solde_crediteur,
      }),
      { debit: 0, credit: 0, solde_debiteur: 0, solde_crediteur: 0 }
    );

    res.json({
      success: true,
      data: {
        lignes,
        totaux: {
          debit:           Math.round(totaux.debit           * 100) / 100,
          credit:          Math.round(totaux.credit          * 100) / 100,
          solde_debiteur:  Math.round(totaux.solde_debiteur  * 100) / 100,
          solde_crediteur: Math.round(totaux.solde_crediteur * 100) / 100,
        },
      },
    });
  } catch (err) {
    console.error('Erreur getBalance:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── OD MANUELLE ───────────────────────────────────────────────────────────
// POST /api/comptabilite/ecritures
const createEcritureManuelle = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { journal_code, date, libelle, reference, lignes } = req.body;

    if (!journal_code || !date || !libelle) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'journal_code, date et libelle requis' });
    }

    const ecriture = await creerEcriture(client, {
      entrepriseId: req.entrepriseId,
      utilisateurId: req.user.id,
      journalCode: journal_code,
      date, libelle, reference,
      origine: 'MANUEL',
      lignes,
    });

    await client.query('COMMIT');
    logAudit(req, 'CREATE', 'ecritures', ecriture.id, {
      numero_piece: ecriture.numero_piece, journal_code, libelle,
    });
    res.status(201).json({ success: true, data: ecriture });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur createEcritureManuelle:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//   EXPORTS COMPTABLES (Journal général + Grand-Livre) — TXT et Excel
// ═══════════════════════════════════════════════════════════════════════════
//
// CONTEXTE OHADA. Le « FEC » au sens du CGI est une obligation française et
// n'existe pas en droit ivoirien. Ce que la Côte d'Ivoire impose, c'est
// l'article 17 de l'Acte uniforme OHADA : intangibilité, chronologie et
// durabilité des écritures, avec extraction sous format numérique
// exploitable en cas de contrôle DGI. Tous ces exports ne ramènent que des
// écritures VALIDÉES (e.validee = true) — donc intangibles par construction.
//
// Deux états distincts, deux formats chacun :
//   • Journal général    = ordre chronologique des écritures par pièce
//   • Grand-Livre        = ordre par compte avec solde progressif
//
//   • Format TXT (pipe-delimited UTF-8)  → universel, machine readable
//   • Format Excel (.xlsx, ExcelJS)      → lisible, mis en forme, totaux
//
// ─── Helpers communs ───────────────────────────────────────────────────────
const clean       = (s) => String(s || '').replace(/[|\r\n\t]+/g, ' ').trim();
const fmtMontant  = (n) => (parseFloat(n) || 0).toFixed(2);
const fmtDateNum  = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
};
const fmtDateFR   = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};
const slugify = (s) => String(s || 'entreprise').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);

// Récupère les écritures validées d'un exercice + entête entreprise.
// Centralisé pour les 4 exports (DRY + cohérence des données).
const fetchEcrituresValidees = async (eid, annee, { triParCompte = false } = {}) => {
  const dateDebut = `${annee}-01-01`;
  const dateFin   = `${annee}-12-31`;
  const orderBy = triParCompte
    ? 'l.compte_numero, e.date_ecriture, e.numero_piece, l.ordre'
    : 'e.date_ecriture, e.numero_piece, l.ordre';

  const result = await pool.query(
    `SELECT
       j.code AS journal_code, j.libelle AS journal_lib,
       e.numero_piece, e.date_ecriture, e.libelle AS ecriture_lib,
       e.reference AS piece_ref, e.created_at AS valid_date,
       l.compte_numero, pc.libelle AS compte_lib,
       l.libelle AS ligne_lib, l.debit, l.credit, l.lettrage, l.ordre
     FROM ecritures e
     JOIN lignes_ecriture l ON l.ecriture_id = e.id
     JOIN journaux j ON j.id = e.journal_id
     LEFT JOIN plan_comptable pc ON pc.id = l.compte_id
     WHERE e.entreprise_id = $1
       AND e.date_ecriture BETWEEN $2 AND $3
       AND e.validee = true
     ORDER BY ${orderBy}`,
    [eid, dateDebut, dateFin]
  );

  const entRes = await pool.query('SELECT nom, ninea FROM entreprises WHERE id=$1', [eid]);
  const ent = entRes.rows[0] || { nom: 'entreprise', ninea: '' };

  return { rows: result.rows, ent };
};

// Valide & normalise le paramètre ?annee=YYYY
const lireAnnee = (req) => {
  const annee = parseInt(req.query.annee) || new Date().getFullYear();
  if (annee < 2000 || annee > 2100) return null;
  return annee;
};

// Mise en forme Excel commune : un en-tête entreprise + une ligne titre +
// un header de colonnes vert, puis les données. Renvoie la worksheet
// déjà configurée pour que le caller n'ait qu'à pousser les lignes.
const initWorksheet = (workbook, sheetName, ent, annee, titre, colonnes) => {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  // Ligne 1 : Nom entreprise (gros, gras)
  ws.mergeCells(1, 1, 1, colonnes.length);
  const c1 = ws.getCell(1, 1);
  c1.value = ent.nom || 'Entreprise';
  c1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0E1116' } };
  c1.alignment = { vertical: 'middle' };

  // Ligne 2 : NINEA + titre du document
  ws.mergeCells(2, 1, 2, colonnes.length);
  const c2 = ws.getCell(2, 1);
  c2.value = `${ent.ninea ? 'NINEA ' + ent.ninea + '  ·  ' : ''}${titre}  ·  Exercice ${annee}`;
  c2.font  = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };

  // Ligne 3 : mention OHADA (intangibilité)
  ws.mergeCells(3, 1, 3, colonnes.length);
  const c3 = ws.getCell(3, 1);
  c3.value = 'Document produit par ApeX  ·  Écritures validées (intangibilité — article 17 OHADA)';
  c3.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF6B7280' } };

  // Ligne 4 : vide
  ws.addRow([]);

  // Ligne 5 : header des colonnes
  const headerRow = ws.addRow(colonnes.map(c => c.label));
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F8A6E' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F8A6E' } } };
  });

  // Largeur des colonnes
  colonnes.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width || 14;
    if (col.numFmt) ws.getColumn(i + 1).numFmt = col.numFmt;
  });

  return ws;
};

// ─── Journal général : format TXT pipe-delimited ───────────────────────────
// GET /api/comptabilite/journal/txt?annee=YYYY (alias /fec préservé pour compat)
const exportJournalTxt = async (req, res) => {
  try {
    const annee = lireAnnee(req);
    if (!annee) return res.status(400).json({ success: false, message: 'Année invalide' });
    const { rows, ent } = await fetchEcrituresValidees(req.entrepriseId, annee);

    const enTete = [
      'JournalCode','JournalLib','EcritureNum','EcritureDate',
      'CompteNum','CompteLib','CompAuxNum','CompAuxLib',
      'PieceRef','PieceDate','EcritureLib','Debit','Credit',
      'EcritureLet','DateLet','ValidDate','Montantdevise','Idevise',
    ].join('|');

    const lignes = rows.map(r => [
      clean(r.journal_code), clean(r.journal_lib),
      clean(r.numero_piece), fmtDateNum(r.date_ecriture),
      clean(r.compte_numero), clean(r.compte_lib),
      '', '',                                       // comptes auxiliaires non gérés
      clean(r.piece_ref), fmtDateNum(r.date_ecriture),
      clean(r.ligne_lib || r.ecriture_lib),
      fmtMontant(r.debit), fmtMontant(r.credit),
      clean(r.lettrage), '',
      fmtDateNum(r.valid_date),
      '', '',
    ].join('|'));

    const contenu = [enTete, ...lignes].join('\r\n') + '\r\n';
    const filename = `Journal_${slugify(ent.ninea || ent.nom)}_${annee}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(contenu);
  } catch (err) {
    console.error('Erreur exportJournalTxt:', err.message);
    res.status(500).json({ success: false, message: 'Erreur génération du Journal' });
  }
};

// ─── Journal général : format Excel (.xlsx) ────────────────────────────────
// GET /api/comptabilite/journal/excel?annee=YYYY
const exportJournalExcel = async (req, res) => {
  try {
    const annee = lireAnnee(req);
    if (!annee) return res.status(400).json({ success: false, message: 'Année invalide' });
    const { rows, ent } = await fetchEcrituresValidees(req.entrepriseId, annee);

    const colonnes = [
      { label: 'Date',        width: 12 },
      { label: 'N° Pièce',    width: 18 },
      { label: 'Journal',     width: 10 },
      { label: 'Compte',      width: 10 },
      { label: 'Libellé compte', width: 28 },
      { label: 'Libellé écriture', width: 32 },
      { label: 'Référence',   width: 14 },
      { label: 'Débit',       width: 14, numFmt: '#,##0.00' },
      { label: 'Crédit',      width: 14, numFmt: '#,##0.00' },
      { label: 'Lettrage',    width: 10 },
    ];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ApeX';
    workbook.created = new Date();
    const ws = initWorksheet(workbook, 'Journal général', ent, annee, 'JOURNAL GÉNÉRAL', colonnes);

    let totalDebit = 0, totalCredit = 0;
    rows.forEach(r => {
      ws.addRow([
        fmtDateFR(r.date_ecriture),
        r.numero_piece || '',
        r.journal_code || '',
        r.compte_numero || '',
        r.compte_lib || '',
        r.ligne_lib || r.ecriture_lib || '',
        r.piece_ref || '',
        parseFloat(r.debit)  || 0,
        parseFloat(r.credit) || 0,
        r.lettrage || '',
      ]);
      totalDebit  += parseFloat(r.debit)  || 0;
      totalCredit += parseFloat(r.credit) || 0;
    });

    // Ligne totaux en gras
    const totalRow = ws.addRow(['', '', '', '', '', '', 'TOTAUX', totalDebit, totalCredit, '']);
    totalRow.eachCell((cell, col) => {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      if (col === 8 || col === 9) cell.numFmt = '#,##0.00';
      cell.border = { top: { style: 'medium', color: { argb: 'FF0F8A6E' } } };
    });

    const buf = await workbook.xlsx.writeBuffer();
    const filename = `Journal_${slugify(ent.ninea || ent.nom)}_${annee}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Erreur exportJournalExcel:', err.message);
    res.status(500).json({ success: false, message: 'Erreur génération du Journal Excel' });
  }
};

// ─── Grand-Livre : format TXT pipe-delimited (tri par compte) ──────────────
// GET /api/comptabilite/grand-livre/txt?annee=YYYY
const exportGrandLivreTxt = async (req, res) => {
  try {
    const annee = lireAnnee(req);
    if (!annee) return res.status(400).json({ success: false, message: 'Année invalide' });
    const { rows, ent } = await fetchEcrituresValidees(req.entrepriseId, annee, { triParCompte: true });

    const enTete = [
      'CompteNum','CompteLib','Date','JournalCode','EcritureNum','PieceRef',
      'EcritureLib','Debit','Credit','SoldeProgressif','Lettrage','ValidDate',
    ].join('|');

    const lignes = [];
    let compteCourant = null;
    let solde = 0;

    rows.forEach(r => {
      // Saut de compte → on remet le solde à zéro
      if (r.compte_numero !== compteCourant) {
        compteCourant = r.compte_numero;
        solde = 0;
      }
      solde += (parseFloat(r.debit) || 0) - (parseFloat(r.credit) || 0);
      lignes.push([
        clean(r.compte_numero), clean(r.compte_lib),
        fmtDateNum(r.date_ecriture),
        clean(r.journal_code), clean(r.numero_piece), clean(r.piece_ref),
        clean(r.ligne_lib || r.ecriture_lib),
        fmtMontant(r.debit), fmtMontant(r.credit),
        fmtMontant(solde),
        clean(r.lettrage),
        fmtDateNum(r.valid_date),
      ].join('|'));
    });

    const contenu = [enTete, ...lignes].join('\r\n') + '\r\n';
    const filename = `Grand-Livre_${slugify(ent.ninea || ent.nom)}_${annee}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(contenu);
  } catch (err) {
    console.error('Erreur exportGrandLivreTxt:', err.message);
    res.status(500).json({ success: false, message: 'Erreur génération du Grand-Livre' });
  }
};

// ─── Grand-Livre : format Excel (.xlsx) ────────────────────────────────────
// GET /api/comptabilite/grand-livre/excel?annee=YYYY
// Ajoute un séparateur visuel entre chaque compte avec totaux et solde final.
const exportGrandLivreExcel = async (req, res) => {
  try {
    const annee = lireAnnee(req);
    if (!annee) return res.status(400).json({ success: false, message: 'Année invalide' });
    const { rows, ent } = await fetchEcrituresValidees(req.entrepriseId, annee, { triParCompte: true });

    const colonnes = [
      { label: 'Compte',      width: 10 },
      { label: 'Libellé compte', width: 28 },
      { label: 'Date',        width: 12 },
      { label: 'Journal',     width: 10 },
      { label: 'N° Pièce',    width: 18 },
      { label: 'Libellé',     width: 32 },
      { label: 'Débit',       width: 14, numFmt: '#,##0.00' },
      { label: 'Crédit',      width: 14, numFmt: '#,##0.00' },
      { label: 'Solde',       width: 14, numFmt: '#,##0.00' },
    ];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ApeX';
    workbook.created = new Date();
    const ws = initWorksheet(workbook, 'Grand-Livre', ent, annee, 'GRAND-LIVRE', colonnes);

    let compteCourant = null, libCourant = null;
    let soldeCompte = 0, totalDebitCompte = 0, totalCreditCompte = 0;
    let totalDebitGlobal = 0, totalCreditGlobal = 0;

    const flushCompte = () => {
      if (compteCourant === null) return;
      const totalRow = ws.addRow([
        compteCourant, `Total ${libCourant || ''}`, '', '', '', '',
        totalDebitCompte, totalCreditCompte, soldeCompte,
      ]);
      totalRow.eachCell((cell, col) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0B6E58' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F2EC' } };
        if (col === 7 || col === 8 || col === 9) cell.numFmt = '#,##0.00';
        cell.border = { top: { style: 'thin', color: { argb: 'FF0F8A6E' } } };
      });
      ws.addRow([]);
    };

    rows.forEach(r => {
      if (r.compte_numero !== compteCourant) {
        flushCompte();
        compteCourant = r.compte_numero;
        libCourant = r.compte_lib;
        soldeCompte = 0;
        totalDebitCompte = 0;
        totalCreditCompte = 0;
      }
      const d = parseFloat(r.debit)  || 0;
      const c = parseFloat(r.credit) || 0;
      soldeCompte       += d - c;
      totalDebitCompte  += d;
      totalCreditCompte += c;
      totalDebitGlobal  += d;
      totalCreditGlobal += c;
      ws.addRow([
        r.compte_numero || '', r.compte_lib || '',
        fmtDateFR(r.date_ecriture),
        r.journal_code || '', r.numero_piece || '',
        r.ligne_lib || r.ecriture_lib || '',
        d, c, soldeCompte,
      ]);
    });
    flushCompte();

    // Total général en pied de tableau
    const grandTotal = ws.addRow(['', 'TOTAL GÉNÉRAL', '', '', '', '', totalDebitGlobal, totalCreditGlobal, totalDebitGlobal - totalCreditGlobal]);
    grandTotal.eachCell((cell, col) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F8A6E' } };
      if (col === 7 || col === 8 || col === 9) cell.numFmt = '#,##0.00';
    });

    const buf = await workbook.xlsx.writeBuffer();
    const filename = `Grand-Livre_${slugify(ent.ninea || ent.nom)}_${annee}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Erreur exportGrandLivreExcel:', err.message);
    res.status(500).json({ success: false, message: 'Erreur génération du Grand-Livre Excel' });
  }
};

// ─── CLÔTURE D'EXERCICE ────────────────────────────────────────────────────
// GET /api/comptabilite/exercices/:id/pre-cloture
// Renvoie la liste des contrôles préalables (ok / warning / error).
const getClotureChecks = async (req, res) => {
  const client = await pool.connect();
  try {
    const exRes = await client.query(
      `SELECT id, libelle, date_debut, date_fin, cloture, date_cloture
         FROM exercices WHERE id = $1 AND entreprise_id = $2`,
      [req.params.id, req.entrepriseId]
    );
    if (exRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercice introuvable' });
    }
    const exercice = exRes.rows[0];
    const checks = await verifierPreCloture(client, req.entrepriseId, exercice.id, exercice.date_fin);
    res.json({ success: true, data: { exercice, checks } });
  } catch (err) {
    console.error('Erreur getClotureChecks:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

// POST /api/comptabilite/exercices/:id/cloturer
// Orchestre la clôture : virements 6/7 → 13, marquage cloturé, exercice N+1, AN.
const cloturerExercice = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eid = req.entrepriseId;
    const userId = req.user.id;
    const { id } = req.params;

    // Récupère l'exercice et le verrouille pendant la transaction
    const exRes = await client.query(
      `SELECT * FROM exercices WHERE id = $1 AND entreprise_id = $2 FOR UPDATE`,
      [id, eid]
    );
    if (exRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Exercice introuvable' });
    }
    const exercice = exRes.rows[0];
    if (exercice.cloture) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Exercice déjà clôturé' });
    }

    // Vérifications bloquantes (toute erreur "error" empêche la clôture)
    const checks = await verifierPreCloture(client, eid, id, exercice.date_fin);
    const bloquants = checks.filter(c => c.niveau === 'error');
    if (bloquants.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Vérifications préalables non satisfaites',
        checks: bloquants,
      });
    }

    // Écritures de clôture des comptes de gestion (classes 6, 7 et 8) vers le 13.
    // La classe 8 (HAO) contient notamment le 89 « Impôts sur le résultat » qui
    // doit être viré sinon le résultat 13 reste faussé et l'IS bascule en N+1.
    const ecCharges  = await ecritureSoldeCharges(client,  { entrepriseId: eid, utilisateurId: userId, exercice });
    const ecProduits = await ecritureSoldeProduits(client, { entrepriseId: eid, utilisateurId: userId, exercice });
    const ecHAO      = await ecritureSoldeHAO(client,      { entrepriseId: eid, utilisateurId: userId, exercice });

    // Marque l'exercice clôturé AVANT de créer l'exercice suivant et l'AN,
    // pour qu'aucune nouvelle écriture ne puisse se glisser dans N.
    await client.query(
      `UPDATE exercices SET cloture = true, date_cloture = NOW(), cloture_par = $1 WHERE id = $2`,
      [userId, id]
    );

    // Crée l'exercice N+1 (ou récupère l'existant) puis l'écriture à-nouveau
    const exerciceSuivant = await creerExerciceSuivant(client, {
      entrepriseId: eid, exerciceCloture: exercice,
    });
    const ecAN = await ecritureAANouveau(client, {
      entrepriseId: eid, utilisateurId: userId,
      exerciceCloture: exercice,
      dateDebutN1: exerciceSuivant.date_debut,
      libelleN1: exerciceSuivant.libelle,
    });

    await client.query('COMMIT');
    logAudit(req, 'CLOSE', 'exercices', id, {
      libelle: exercice.libelle,
      ecritures: {
        charges: ecCharges?.numero_piece || null,
        produits: ecProduits?.numero_piece || null,
        hao: ecHAO?.numero_piece || null,
        a_nouveau: ecAN?.numero_piece || null,
      },
      exercice_suivant: exerciceSuivant.libelle,
    });
    res.json({
      success: true,
      message: `${exercice.libelle} clôturé. ${exerciceSuivant.libelle} ouvert.`,
      data: {
        exercice_cloture: { id, libelle: exercice.libelle },
        exercice_suivant: exerciceSuivant,
        ecritures_generees: {
          solde_charges: ecCharges?.numero_piece || null,
          solde_produits: ecProduits?.numero_piece || null,
          solde_hao: ecHAO?.numero_piece || null,
          a_nouveau: ecAN?.numero_piece || null,
        },
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ComptaError) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('Erreur cloturerExercice:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la clôture' });
  } finally {
    client.release();
  }
};

// ─── SUGGESTIONS DE CLÔTURE AUTOMATIQUES ───────────────────────────────────
const { genererSuggestionsCloture, enregistrerSuggestions } = require('../utils/clotureAuto');

const getSuggestionsCloture = async (req, res) => {
  try {
    const suggestions = await genererSuggestionsCloture(req.entrepriseId, req.params.id);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    console.error('Erreur getSuggestionsCloture:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const enregistrerSuggestionsCloture = async (req, res) => {
  try {
    const { suggestions } = req.body;
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune suggestion à enregistrer' });
    }
    const count = await enregistrerSuggestions(req.entrepriseId, req.params.id, req.user.id, suggestions);
    res.json({ success: true, message: `${count} écriture(s) créée(s) dans le journal OD`, count });
  } catch (err) {
    console.error('Erreur enregistrerSuggestionsCloture:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPlanComptable, getJournaux, getExercices,
  getEcritures, getEcritureById,
  getGrandLivre, getBalance, createEcritureManuelle,
  exportJournalTxt, exportJournalExcel,
  exportGrandLivreTxt, exportGrandLivreExcel,
  getClotureChecks, cloturerExercice,
  getSuggestionsCloture, enregistrerSuggestionsCloture,
};
