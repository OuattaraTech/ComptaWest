/**
 * Controller d'import en masse (Clients, Fournisseurs, Produits).
 *
 * Workflow :
 *   POST /api/import/:type            (multipart, champ « fichier »)
 *   Query : ?dry_run=true|false
 *
 *   - dry_run=true (défaut) : parse + valide + retourne le rapport,
 *                              n'insère RIEN. Permet à l'UI d'afficher
 *                              un aperçu avec les erreurs avant commit.
 *   - dry_run=false          : si zéro erreur, insère dans une transaction
 *                              (rollback total à la moindre erreur SQL,
 *                              jamais de demi-import).
 *
 * Permission : MODULES.<type>.CREATE (réutilise la matrice de droits
 * existante — un commercial peut importer des clients, un magasinier
 * des produits, etc.).
 */

const multer = require('multer');
const pool = require('../../config/database');
const { logAudit } = require('../utils/audit');
const {
  parserBuffer, validerEtNormaliser, SCHEMAS,
  deduireClasse, deduireNature, parserDate,
} = require('../utils/imports');

// ─── Upload mémoire (pas de stockage disque) ──────────────────────────────
// Limite à 5 MB : largement suffisant pour 10 000 lignes Excel, et coupe
// court à toute tentative de DoS par upload d'un fichier énorme.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (!ok) return cb(new Error('Format de fichier non supporté (xlsx, xls ou csv uniquement)'), false);
    cb(null, true);
  },
}).single('fichier');

// ─── Mappers : ligne normalisée → INSERT SQL ──────────────────────────────
// Chaque type d'import a son propre INSERT — on évite l'INSERT générique
// par concaténation de chaînes (vulnérable et plus difficile à auditer).
const INSERTERS = {
  clients: async (client, eid, row) => {
    const r = row.data;
    const res = await client.query(
      `INSERT INTO clients (entreprise_id, nom, email, telephone, adresse, ville, pays, ninea, rccm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, nom`,
      [eid, r.nom, r.email || null, r.telephone || null, r.adresse || null,
       r.ville || null, r.pays || 'Côte d\'Ivoire',
       r.ninea || null, r.rccm || null]
    );
    return res.rows[0];
  },
  fournisseurs: async (client, eid, row) => {
    const r = row.data;
    const res = await client.query(
      `INSERT INTO fournisseurs (entreprise_id, nom, email, telephone, adresse, ville, pays, ninea, rccm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, nom`,
      [eid, r.nom, r.email || null, r.telephone || null, r.adresse || null,
       r.ville || null, r.pays || 'Côte d\'Ivoire',
       r.ninea || null, r.rccm || null]
    );
    return res.rows[0];
  },
  produits: async (client, eid, row) => {
    const r = row.data;
    // `code` est NOT NULL UNIQUE par entreprise — auto-génération si vide :
    // « IMP-<6 derniers chiffres du timestamp>-<index ligne Excel> » pour
    // rester court (<40 caractères) et identifiable comme issu d'un import.
    const codeAuto = r.code && String(r.code).trim() !== ''
      ? String(r.code).trim()
      : `IMP-${Date.now().toString().slice(-6)}-${row.ligne_excel}`;
    // Type : 'service' si l'unité contient 'h', 'jour', 'mission' ; sinon produit
    const typeAuto = r.type && ['produit', 'service'].includes(String(r.type).toLowerCase())
      ? String(r.type).toLowerCase()
      : (/^(h|heure|hour|jour|mission|exercice|bulletin|prestation)/i.test(r.unite || '') ? 'service' : 'produit');
    const res = await client.query(
      `INSERT INTO produits (entreprise_id, libelle, code, type, prix_vente_ht, prix_achat_ht, unite, taux_tva)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, libelle AS nom`,
      [eid, r.libelle, codeAuto, typeAuto,
       r.prix_vente_ht || 0, r.prix_achat_ht || 0,
       r.unite || 'unité', r.taux_tva ?? 18]
    );
    return res.rows[0];
  },
  plan_comptable: async (client, eid, row) => {
    const r = row.data;
    const classe = r.classe || deduireClasse(r.numero);
    const nature = (r.nature || '').toUpperCase() || deduireNature(classe);
    if (!classe || !nature) {
      throw new Error(`Ligne ${row.ligne_excel} : impossible de déduire classe/nature pour le compte ${r.numero}`);
    }
    const lettr = String(r.lettrable || '').toLowerCase();
    const estLettrable = ['true', 'oui', '1', 'yes', 'y'].includes(lettr);
    const res = await client.query(
      `INSERT INTO plan_comptable (entreprise_id, numero, libelle, classe, nature, est_systeme, est_lettrable)
       VALUES ($1, $2, $3, $4, $5, false, $6)
       ON CONFLICT (entreprise_id, numero) DO UPDATE SET
         libelle = EXCLUDED.libelle,
         est_lettrable = EXCLUDED.est_lettrable
       RETURNING id, numero AS nom`,
      [eid, r.numero, r.libelle, classe, nature, estLettrable]
    );
    return res.rows[0];
  },
};

// ─── Endpoint principal ────────────────────────────────────────────────────
const importerFichier = (type) => async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fichier requis (champ « fichier »).' });
    }
    if (!SCHEMAS[type]) {
      return res.status(400).json({ success: false, message: `Type d'import inconnu : ${type}` });
    }

    const dryRun = req.query.dry_run !== 'false';   // défaut = true
    const eid = req.entrepriseId;

    let rows;
    try {
      rows = await parserBuffer(req.file.buffer, req.file.originalname);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: `Impossible de lire le fichier : ${e.message}`,
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le fichier ne contient aucune ligne de données (vérifiez la 1ʳᵉ ligne d\'en-têtes).',
      });
    }
    if (rows.length > 5000) {
      return res.status(400).json({
        success: false,
        message: `Trop de lignes (${rows.length}). Maximum : 5000 lignes par import. Découpez votre fichier.`,
      });
    }

    const { rowsOk, errors } = validerEtNormaliser(rows, type);

    // Validations métier supplémentaires par type, appliquées AVANT le
    // dry-run pour que l'UI affiche les erreurs et que l'utilisateur n'ait
    // pas un commit qui plante après validation visuelle.
    if (type === 'plan_comptable') {
      const filtres = [];
      rowsOk.forEach(row => {
        const r = row.data;
        const classe = r.classe || deduireClasse(r.numero);
        const nature = (r.nature || '').toUpperCase() || deduireNature(classe);
        if (!classe || !nature) {
          errors.push({
            ligne_excel: row.ligne_excel,
            champ: 'numero',
            message: `Compte « ${r.numero} » : classe SYSCOHADA non déductible. Le numéro doit commencer par un chiffre de 1 à 9 (ou renseignez classe + nature explicitement).`,
          });
        } else {
          filtres.push(row);
        }
      });
      // On remplace en place pour que rowsOk ne contienne plus que des
      // lignes vraiment valides (utilisé par l'apercu + le commit).
      rowsOk.length = 0;
      rowsOk.push(...filtres);
    }

    // Mode preview : on renvoie le rapport sans rien insérer
    if (dryRun) {
      return res.json({
        success: true,
        data: {
          dry_run: true,
          total_lignes:    rows.length,
          ok_count:        rowsOk.length,
          erreurs_count:   errors.length,
          erreurs:         errors.slice(0, 100),
          apercu:          rowsOk.slice(0, 10).map(r => r.data),
          colonnes_detectees: Object.keys(rows[0] || {}),
        },
      });
    }

    // Mode commit : on insère tout en transaction, rollback à la moindre erreur
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${errors.length} erreur(s) dans le fichier. Corrigez-les avant d'importer.`,
        data: { erreurs: errors.slice(0, 100) },
      });
    }

    // Pour les produits : détecte les codes déjà présents en BDD avant
    // l'INSERT pour éviter le 23505 brutal sur la contrainte UNIQUE
    // (entreprise_id, code) — message clair côté UI.
    if (type === 'produits') {
      const codesFournis = rowsOk
        .map(r => (r.data.code && String(r.data.code).trim()) || null)
        .filter(c => c !== null);
      if (codesFournis.length > 0) {
        const ex = await pool.query(
          'SELECT code FROM produits WHERE entreprise_id=$1 AND code = ANY($2)',
          [eid, codesFournis]
        );
        if (ex.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: `${ex.rows.length} produit(s) ont déjà un code existant : `
                   + ex.rows.slice(0, 5).map(r => r.code).join(', ')
                   + (ex.rows.length > 5 ? ', …' : '')
                   + `. Renommez les références dans votre fichier ou supprimez les produits existants.`,
          });
        }
      }
    }

    const inserter = INSERTERS[type];
    const client = await pool.connect();
    const insertedNoms = [];
    try {
      await client.query('BEGIN');
      for (const row of rowsOk) {
        const ins = await inserter(client, eid, row);
        if (ins?.nom) insertedNoms.push(ins.nom);
      }
      await client.query('COMMIT');

      logAudit(req, 'IMPORT', type, null, {
        type, nb: rowsOk.length, fichier: req.file.originalname,
      });

      res.json({
        success: true,
        data: {
          dry_run: false,
          ok_count: rowsOk.length,
          inserted: insertedNoms,
        },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`Erreur import ${type}:`, e.message);
      res.status(500).json({
        success: false,
        message: `Erreur d'insertion : ${e.message}. Aucune ligne n'a été ajoutée (rollback complet).`,
      });
    } finally {
      client.release();
    }
  });
};

// ─── GET /api/import/template/:type ───────────────────────────────────────
// Renvoie un fichier Excel modèle avec les colonnes attendues + une ligne
// d'exemple. Évite à l'utilisateur de deviner le format du fichier.
const ExcelJS = require('exceljs');

const EXEMPLES = {
  clients: {
    nom: 'Banque Atlantique CI', email: 'contact@banqueatlantique.ci',
    telephone: '+225 27 20 24 16 00', adresse: 'Plateau, Abidjan',
    ville: 'Abidjan', pays: "Côte d'Ivoire",
    ninea: 'CI-1234567A', rccm: 'CI-ABJ-2024-B-1234',
  },
  fournisseurs: {
    nom: 'SARL OUATTARA TECH', email: 'contact@ouattaratech.ci',
    telephone: '+225 07 07 07 07 07', adresse: 'Cocody, Abidjan',
    ville: 'Abidjan', pays: "Côte d'Ivoire",
    ninea: 'CI-9876543B', rccm: 'CI-ABJ-2024-B-9876',
  },
  produits: {
    libelle: 'Audit SI SYSCOHADA', code: 'PRESTA-001',
    prix_vente_ht: 750000, prix_achat_ht: 0,
    unite: 'jour', taux_tva: 18, type: 'service',
  },
  plan_comptable: {
    numero: '411100', libelle: 'Clients - Marché local',
    classe: 4, nature: 'ACTIF', lettrable: 'oui',
  },
  balance_ouverture: {
    numero: '411000', libelle: 'Clients',
    debit: 1500000, credit: 0,
  },
  ecritures_historiques: {
    date: '15/01/2025', journal: 'VTE', numero_piece: 'F-2025-001',
    compte: '411000', libelle: 'Facture vente Banque Atlantique',
    debit: 1180000, credit: 0,
  },
};

const telechargerModele = async (req, res) => {
  const { type } = req.params;
  if (!SCHEMAS[type]) {
    return res.status(400).json({ success: false, message: `Type inconnu : ${type}` });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ApeX';
  const ws = wb.addWorksheet(`Modèle ${type}`);

  const fields = Object.keys(SCHEMAS[type].fields);
  ws.addRow(fields);
  ws.getRow(1).eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F8A6E' } };
  });

  const exemple = EXEMPLES[type] || {};
  ws.addRow(fields.map(f => exemple[f] ?? ''));

  fields.forEach((_, i) => { ws.getColumn(i + 1).width = 22; });

  const buf = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="modele_${type}.xlsx"`);
  res.send(Buffer.from(buf));
};

// ═══════════════════════════════════════════════════════════════════════════
//   IMPORTS COMPTABLES SPÉCIAUX : balance d'ouverture + écritures historiques
// ═══════════════════════════════════════════════════════════════════════════
// Ces deux endpoints ont une logique métier plus stricte que clients /
// fournisseurs / produits : ils touchent au cœur SYSCOHADA donc validation
// d'équilibre obligatoire, auto-création de comptes/journaux manquants,
// rattachement à l'exercice ouvert.

// Trouve l'exercice qui contient une date donnée. Si NULL, prend l'exercice
// actif le plus récent non clôturé.
const trouverExercice = async (client, eid, date) => {
  let r;
  if (date) {
    r = await client.query(
      `SELECT id, date_debut, date_fin, cloture FROM exercices
       WHERE entreprise_id=$1 AND date_debut <= $2 AND date_fin >= $2
       ORDER BY date_debut DESC LIMIT 1`,
      [eid, date]
    );
  }
  if (!r || r.rows.length === 0) {
    r = await client.query(
      `SELECT id, date_debut, date_fin, cloture FROM exercices
       WHERE entreprise_id=$1 AND cloture=false
       ORDER BY date_debut DESC LIMIT 1`,
      [eid]
    );
  }
  return r.rows[0] || null;
};

// Garantit qu'un journal existe (par code). Le crée s'il manque — utile
// pour les imports historiques qui mentionnent des codes journal non
// présents dans l'entreprise (VTE, ACH, AN, BAN, CAI…).
const trouverOuCreerJournal = async (client, eid, code, type, libelle) => {
  const codeUp = String(code || '').toUpperCase().trim();
  let r = await client.query(
    'SELECT id FROM journaux WHERE entreprise_id=$1 AND code=$2',
    [eid, codeUp]
  );
  if (r.rows.length > 0) return r.rows[0].id;
  const ins = await client.query(
    `INSERT INTO journaux (entreprise_id, code, libelle, type, est_systeme)
     VALUES ($1, $2, $3, $4, false) RETURNING id`,
    [eid, codeUp, libelle || codeUp, type || 'OD']
  );
  return ins.rows[0].id;
};

// Garantit qu'un compte existe dans le plan comptable de l'entreprise.
// Auto-création : si absent, on l'ajoute avec classe et nature déduites.
const trouverOuCreerCompte = async (client, eid, numero, libelle) => {
  const num = String(numero).trim();
  let r = await client.query(
    'SELECT id FROM plan_comptable WHERE entreprise_id=$1 AND numero=$2',
    [eid, num]
  );
  if (r.rows.length > 0) return r.rows[0].id;
  const classe = deduireClasse(num);
  const nature = deduireNature(classe);
  if (!classe || !nature) {
    throw new Error(`Compte « ${num} » : classe ou nature SYSCOHADA introuvable. Ajoutez-le manuellement au plan comptable.`);
  }
  const ins = await client.query(
    `INSERT INTO plan_comptable (entreprise_id, numero, libelle, classe, nature, est_systeme)
     VALUES ($1, $2, $3, $4, $5, false) RETURNING id`,
    [eid, num, libelle || `Compte ${num}`, classe, nature]
  );
  return ins.rows[0].id;
};

// ─── POST /api/import/balance-ouverture ───────────────────────────────────
// Body multipart : fichier (XLSX/CSV). Query : ?dry_run=true|false
// Validation : somme débit = somme crédit sur l'ensemble du fichier.
const importerBalanceOuverture = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'Fichier requis.' });

    const dryRun = req.query.dry_run !== 'false';
    const eid = req.entrepriseId;

    let rows;
    try { rows = await parserBuffer(req.file.buffer, req.file.originalname); }
    catch (e) { return res.status(400).json({ success: false, message: `Lecture impossible : ${e.message}` }); }

    const { rowsOk, errors } = validerEtNormaliser(rows, 'balance_ouverture');

    // Validation métier supplémentaire : débit XOR crédit, somme équilibrée
    let totalDebit = 0, totalCredit = 0;
    const errMetier = [];
    rowsOk.forEach(row => {
      const d = parseFloat(row.data.debit)  || 0;
      const c = parseFloat(row.data.credit) || 0;
      if (d > 0 && c > 0) {
        errMetier.push({ ligne_excel: row.ligne_excel, champ: 'debit/credit',
          message: `Compte ${row.data.numero} : débit ET crédit renseignés. Choisissez l'un des deux.` });
        return;
      }
      if (d === 0 && c === 0) {
        errMetier.push({ ligne_excel: row.ligne_excel, champ: 'debit/credit',
          message: `Compte ${row.data.numero} : ni débit ni crédit. Supprimez la ligne ou renseignez un solde.` });
        return;
      }
      totalDebit  += d;
      totalCredit += c;
    });
    const ecart = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
    if (ecart > 0.01 && errMetier.length === 0) {
      errMetier.push({ ligne_excel: '-', champ: 'equilibre',
        message: `Balance non équilibrée : débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)} (écart ${ecart.toFixed(2)}).` });
    }
    const allErrors = [...errors, ...errMetier];

    if (dryRun) {
      return res.json({
        success: true,
        data: {
          dry_run: true,
          total_lignes: rows.length,
          ok_count: rowsOk.length,
          erreurs_count: allErrors.length,
          erreurs: allErrors.slice(0, 100),
          apercu: rowsOk.slice(0, 10).map(r => r.data),
          total_debit: totalDebit,
          total_credit: totalCredit,
          equilibre: ecart <= 0.01,
        },
      });
    }
    if (allErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${allErrors.length} erreur(s) — corrigez avant l'import.`,
        data: { erreurs: allErrors.slice(0, 100) },
      });
    }

    // Commit : 1 écriture A_NOUVEAU avec N lignes, dans l'exercice ouvert.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const exercice = await trouverExercice(client, eid, null);
      if (!exercice) throw new Error('Aucun exercice ouvert. Créez d\'abord un exercice depuis Comptabilité → Clôture.');
      const journalId = await trouverOuCreerJournal(client, eid, 'AN', 'A_NOUVEAU', 'À nouveaux (balance d\'ouverture)');
      const dateDebutStr = exercice.date_debut.toISOString().slice(0,10).replace(/-/g,'');
      const numPiece = `BAL-OUV-${dateDebutStr}`;

      // Idempotence : si une balance d'ouverture existe déjà pour l'exercice,
      // on refuse explicitement avec un message qui dit quoi faire. Évite le
      // 23505 brutal de Postgres sur la contrainte d'unicité de numero_piece.
      const existant = await client.query(
        'SELECT id FROM ecritures WHERE entreprise_id=$1 AND numero_piece=$2',
        [eid, numPiece]
      );
      if (existant.rows.length > 0) {
        throw new Error(
          `Une balance d'ouverture existe déjà pour cet exercice (pièce ${numPiece}). `
          + `Supprimez l'écriture existante depuis Comptabilité → Journal avant de réimporter, `
          + `ou utilisez la contre-passation si elle est déjà validée.`
        );
      }

      const ecr = await client.query(
        `INSERT INTO ecritures (entreprise_id, exercice_id, journal_id, numero_piece,
                                date_ecriture, libelle, reference, origine, validee, cree_par)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'import_balance_ouverture', true, $8)
         RETURNING id`,
        [eid, exercice.id, journalId, numPiece,
         exercice.date_debut, 'Balance d\'ouverture importée', req.file.originalname.slice(0, 80), req.user?.id || null]
      );
      const ecritureId = ecr.rows[0].id;

      let ordre = 0;
      for (const row of rowsOk) {
        const r = row.data;
        const compteId = await trouverOuCreerCompte(client, eid, r.numero, r.libelle);
        await client.query(
          `INSERT INTO lignes_ecriture (ecriture_id, compte_id, compte_numero, libelle, debit, credit, ordre)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [ecritureId, compteId, r.numero, r.libelle || `À-nouveau ${r.numero}`,
           parseFloat(r.debit) || 0, parseFloat(r.credit) || 0, ordre++]
        );
      }

      await client.query('COMMIT');
      logAudit(req, 'IMPORT', 'balance_ouverture', ecritureId, {
        nb_lignes: rowsOk.length, total_debit: totalDebit, total_credit: totalCredit,
        fichier: req.file.originalname,
      });
      res.json({
        success: true,
        data: { dry_run: false, ok_count: rowsOk.length, ecriture_id: ecritureId, numero_piece: numPiece },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Erreur import balance:', e.message);
      res.status(500).json({ success: false, message: `Erreur insertion : ${e.message}` });
    } finally { client.release(); }
  });
};

// ─── POST /api/import/ecritures-historiques ──────────────────────────────
// 1 ligne fichier = 1 ligne d'écriture. On groupe par (date + numero_piece +
// journal), on valide l'équilibre de chaque pièce, on crée 1 écriture +
// N lignes par groupe. Permet de reprendre une compta exercice par exercice.
const importerEcrituresHistoriques = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'Fichier requis.' });

    const dryRun = req.query.dry_run !== 'false';
    const eid = req.entrepriseId;

    let rows;
    try { rows = await parserBuffer(req.file.buffer, req.file.originalname); }
    catch (e) { return res.status(400).json({ success: false, message: `Lecture impossible : ${e.message}` }); }

    const { rowsOk, errors } = validerEtNormaliser(rows, 'ecritures_historiques');

    // Validation métier : date parsable, débit XOR crédit, regroupement
    const errMetier = [];
    const pieces = new Map();  // key = `${journal}|${date}|${piece}` → { rows, totalD, totalC }
    rowsOk.forEach(row => {
      const r = row.data;
      const dateIso = parserDate(r.date);
      if (!dateIso) {
        errMetier.push({ ligne_excel: row.ligne_excel, champ: 'date',
          message: `Date « ${r.date} » non reconnue (formats : JJ/MM/AAAA ou AAAA-MM-JJ).` });
        return;
      }
      r._date_iso = dateIso;
      const d = parseFloat(r.debit) || 0;
      const c = parseFloat(r.credit) || 0;
      if (d > 0 && c > 0) {
        errMetier.push({ ligne_excel: row.ligne_excel, champ: 'debit/credit',
          message: `Ligne ${r.numero_piece} compte ${r.compte} : débit ET crédit renseignés.` });
        return;
      }
      if (d === 0 && c === 0) {
        errMetier.push({ ligne_excel: row.ligne_excel, champ: 'debit/credit',
          message: `Ligne ${r.numero_piece} compte ${r.compte} : ni débit ni crédit.` });
        return;
      }
      const key = `${r.journal.toUpperCase()}|${dateIso}|${r.numero_piece}`;
      if (!pieces.has(key)) pieces.set(key, { rows: [], totalD: 0, totalC: 0 });
      const grp = pieces.get(key);
      grp.rows.push(row);
      grp.totalD += d;
      grp.totalC += c;
    });

    // Vérifie équilibre par pièce
    pieces.forEach((grp, key) => {
      const ecart = Math.round(Math.abs(grp.totalD - grp.totalC) * 100) / 100;
      if (ecart > 0.01) {
        errMetier.push({ ligne_excel: grp.rows[0].ligne_excel, champ: 'equilibre',
          message: `Pièce ${key.split('|')[2]} non équilibrée (D ${grp.totalD.toFixed(2)} ≠ C ${grp.totalC.toFixed(2)}).` });
      }
    });

    const allErrors = [...errors, ...errMetier];

    if (dryRun) {
      return res.json({
        success: true,
        data: {
          dry_run: true,
          total_lignes:  rows.length,
          ok_count:      rowsOk.length,
          erreurs_count: allErrors.length,
          erreurs:       allErrors.slice(0, 100),
          apercu:        rowsOk.slice(0, 10).map(r => r.data),
          nb_pieces:     pieces.size,
        },
      });
    }
    if (allErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${allErrors.length} erreur(s) — corrigez avant l'import.`,
        data: { erreurs: allErrors.slice(0, 100) },
      });
    }

    // Commit : pour chaque pièce, 1 écriture + N lignes
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const exerciceCache = new Map();
      const journalCache = new Map();

      // Idempotence : on refuse en bloc s'il existe DÉJÀ une pièce avec
      // l'un des numéros qu'on s'apprête à insérer. Message clair pour
      // permettre à l'utilisateur de corriger (supprimer ou renommer).
      const numerosCibles = [...pieces.keys()].map(k => k.split('|')[2]);
      const conflits = await client.query(
        'SELECT numero_piece FROM ecritures WHERE entreprise_id=$1 AND numero_piece=ANY($2)',
        [eid, numerosCibles]
      );
      if (conflits.rows.length > 0) {
        throw new Error(
          `${conflits.rows.length} pièce(s) existent déjà avec ces numéros : `
          + conflits.rows.slice(0, 5).map(r => r.numero_piece).join(', ')
          + (conflits.rows.length > 5 ? ', …' : '')
          + `. Renommez-les dans votre fichier ou supprimez les anciennes avant de réimporter.`
        );
      }

      for (const [key, grp] of pieces) {
        const [journal, dateIso, numPiece] = key.split('|');
        // Exercice cible (peut changer selon la date)
        let exId = exerciceCache.get(dateIso);
        if (!exId) {
          const ex = await trouverExercice(client, eid, dateIso);
          if (!ex) throw new Error(`Aucun exercice ne contient la date ${dateIso}. Créez l'exercice manquant.`);
          exId = ex.id;
          exerciceCache.set(dateIso, exId);
        }
        // Journal (cache pour éviter N requêtes)
        let jId = journalCache.get(journal);
        if (!jId) {
          jId = await trouverOuCreerJournal(client, eid, journal, 'OD', journal);
          journalCache.set(journal, jId);
        }
        // Libellé de l'écriture = libellé de la 1ʳᵉ ligne, ou n° pièce
        const libelleEcr = grp.rows[0].data.libelle || `Reprise ${numPiece}`;
        const ecr = await client.query(
          `INSERT INTO ecritures (entreprise_id, exercice_id, journal_id, numero_piece,
                                  date_ecriture, libelle, reference, origine, validee, cree_par)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'import_historique', true, $8)
           RETURNING id`,
          [eid, exId, jId, numPiece, dateIso, libelleEcr.slice(0, 255),
           req.file.originalname.slice(0, 80), req.user?.id || null]
        );
        const ecritureId = ecr.rows[0].id;

        let ordre = 0;
        for (const row of grp.rows) {
          const r = row.data;
          const compteId = await trouverOuCreerCompte(client, eid, r.compte, r.libelle);
          await client.query(
            `INSERT INTO lignes_ecriture (ecriture_id, compte_id, compte_numero, libelle, debit, credit, ordre)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [ecritureId, compteId, r.compte, r.libelle || libelleEcr.slice(0, 255),
             parseFloat(r.debit) || 0, parseFloat(r.credit) || 0, ordre++]
          );
        }
      }

      await client.query('COMMIT');
      logAudit(req, 'IMPORT', 'ecritures_historiques', null, {
        nb_pieces: pieces.size, nb_lignes: rowsOk.length,
        fichier: req.file.originalname,
      });
      res.json({
        success: true,
        data: { dry_run: false, ok_count: rowsOk.length, nb_pieces: pieces.size },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Erreur import ecritures:', e.message);
      res.status(500).json({ success: false, message: `Erreur insertion : ${e.message}` });
    } finally { client.release(); }
  });
};

module.exports = {
  importerClients:      importerFichier('clients'),
  importerFournisseurs: importerFichier('fournisseurs'),
  importerProduits:     importerFichier('produits'),
  importerPlanComptable: importerFichier('plan_comptable'),
  importerBalanceOuverture,
  importerEcrituresHistoriques,
  telechargerModele,
};
