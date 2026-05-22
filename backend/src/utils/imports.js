/**
 * Helpers d'import en masse depuis Excel / CSV / Sage / Ciel.
 *
 * Architecture : le client uploade un fichier (.xlsx, .xls ou .csv) au
 * controller dédié, qui parse via ExcelJS, valide chaque ligne contre
 * un SCHÉMA (champs requis, types, longueurs), puis renvoie un rapport
 * structuré { ok, errors, preview }. En mode dry_run=true, rien n'est
 * inséré ; en commit, les inserts sont enveloppés dans une transaction
 * pour qu'une erreur ligne par ligne annule tout (cohérence garantie).
 *
 * Pour ajouter un nouveau type d'import : déclarer un SCHEMA dans
 * SCHEMAS ci-dessous + créer la fonction `insererLignes` dédiée dans
 * le controller (cf. importController.js).
 */

const ExcelJS = require('exceljs');

// ─── 1. Parsing d'un buffer en lignes JSON ────────────────────────────────
// Le buffer peut être :
//   - .xlsx / .xls : on lit avec ExcelJS (1ʳᵉ feuille uniquement)
//   - .csv         : on parse manuellement (séparateur , ou ; auto-détecté)
//
// Retour : array d'objets { col_name: value } basé sur la 1ʳᵉ ligne
// qui sert d'en-tête. Les colonnes vides ou commençant par "_" sont
// ignorées (utile pour les fichiers Sage qui exportent des marqueurs).
async function parserBuffer(buffer, filename = '') {
  const isCsv = /\.csv$/i.test(filename);
  if (isCsv) return parserCsv(buffer.toString('utf-8'));
  return parserXlsx(buffer);
}

async function parserXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const ws = workbook.worksheets[0];
  if (!ws) throw new Error('Le fichier ne contient aucune feuille.');

  // 1ʳᵉ ligne = en-têtes ; on normalise (trim, lower, snake_case léger).
  const headerRow = ws.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const raw = String(cell.value || '').trim();
    if (!raw || raw.startsWith('_')) {
      headers[col - 1] = null;  // sentinelle pour ignorer cette colonne
    } else {
      headers[col - 1] = normaliserHeader(raw);
    }
  });

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;  // skip header
    const obj = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col - 1];
      if (!key) return;
      obj[key] = lireCellValue(cell);
    });
    if (Object.keys(obj).length > 0) rows.push(obj);
  });

  return rows;
}

// Lecture intelligente d'une cellule ExcelJS (gère formules, dates, nombres).
function lireCellValue(cell) {
  if (cell.value === null || cell.value === undefined) return null;
  if (typeof cell.value === 'object') {
    // Formule : on lit le résultat calculé
    if ('result' in cell.value) return cell.value.result;
    // Lien hypertexte : on lit le texte affiché
    if ('text' in cell.value) return cell.value.text;
    // Date : on retourne ISO
    if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
    // Texte enrichi (richText) : on concatène les fragments
    if (Array.isArray(cell.value.richText)) {
      return cell.value.richText.map(r => r.text).join('');
    }
  }
  return cell.value;
}

// Normalise un libellé d'en-tête. « N° de facture » → « n_de_facture ».
// On essaie de matcher les variations courantes vers nos clés canoniques.
function normaliserHeader(raw) {
  return raw
    .toLowerCase()
    .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/[ç]/g, 'c')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ─── 2. Parsing CSV minimal (séparateur , ou ; auto, guillemets gérés) ────
function parserCsv(texte) {
  if (!texte || !texte.trim()) return [];
  // Auto-détection du séparateur sur la 1ʳᵉ ligne
  const firstLine = texte.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >
              (firstLine.match(/,/g) || []).length ? ';' : ',';

  const lignes = texte.split(/\r?\n/).filter(l => l.length > 0);
  const headers = parserLigneCsv(lignes.shift(), sep).map(normaliserHeader);
  return lignes.map(ligne => {
    const cellules = parserLigneCsv(ligne, sep);
    const obj = {};
    headers.forEach((h, i) => {
      if (h && cellules[i] !== undefined) obj[h] = cellules[i];
    });
    return obj;
  });
}

function parserLigneCsv(ligne, sep) {
  const cellules = [];
  let cur = '';
  let dansGuillemet = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (dansGuillemet && ligne[i + 1] === '"') { cur += '"'; i++; }
      else dansGuillemet = !dansGuillemet;
    } else if (c === sep && !dansGuillemet) {
      cellules.push(cur.trim()); cur = '';
    } else {
      cur += c;
    }
  }
  cellules.push(cur.trim());
  return cellules;
}

// ─── 3. Schémas de validation par type d'import ───────────────────────────
// Chaque champ : { type, required, max, alias[], normalize }
//   - type      : 'string' | 'number' | 'email' | 'phone'
//   - required  : true / false
//   - max       : longueur max pour string
//   - alias[]   : noms alternatifs que peut prendre la colonne dans le
//                 fichier source (Sage, Ciel, Excel maison…)
//   - normalize : fonction de transformation appliquée avant stockage
const SCHEMAS = {
  clients: {
    table: 'clients',
    libelle: 'clients',
    fields: {
      nom:       { type: 'string', required: true, max: 150, alias: ['raison_sociale', 'denomination', 'societe', 'client', 'name'] },
      email:     { type: 'email',  max: 150, alias: ['e_mail', 'mail', 'courriel'] },
      telephone: { type: 'phone',  max: 20,  alias: ['tel', 'phone', 'mobile', 'gsm'] },
      adresse:   { type: 'string', max: 300, alias: ['adr', 'address'] },
      ville:     { type: 'string', max: 100, alias: ['city'] },
      pays:      { type: 'string', max: 50,  alias: ['country'] },
      // Le NCC ivoirien (Numéro de Compte Contribuable) est stocké en BDD
      // dans la colonne historique `ninea` (origine sénégalaise). On reconnaît
      // les deux libellés dans le fichier source pour ne forcer personne.
      ninea:     { type: 'string', max: 50,  alias: ['ncc', 'n_cc', 'numero_compte_contribuable', 'tax_id'] },
      rccm:      { type: 'string', max: 50,  alias: ['n_rccm', 'numero_rccm', 'registre_commerce'] },
    },
  },
  fournisseurs: {
    table: 'fournisseurs',
    libelle: 'fournisseurs',
    fields: {
      nom:        { type: 'string', required: true, max: 200, alias: ['raison_sociale', 'denomination', 'societe', 'fournisseur', 'supplier', 'name'] },
      email:      { type: 'email',  max: 150, alias: ['e_mail', 'mail', 'courriel'] },
      telephone:  { type: 'phone',  max: 30,  alias: ['tel', 'phone', 'mobile', 'gsm'] },
      adresse:    { type: 'string', max: 300, alias: ['adr', 'address'] },
      ville:      { type: 'string', max: 100, alias: ['city'] },
      pays:       { type: 'string', max: 50,  alias: ['country'] },
      ninea:      { type: 'string', max: 50,  alias: ['ncc', 'n_cc', 'numero_compte_contribuable', 'tax_id'] },
      rccm:       { type: 'string', max: 50,  alias: ['n_rccm', 'numero_rccm', 'registre_commerce'] },
    },
  },
  // Produits : la colonne d'affichage est `libelle` en BDD (pas `nom`),
  // et `code` est NOT NULL UNIQUE par entreprise — on auto-génère si vide.
  produits: {
    table: 'produits',
    libelle: 'produits',
    fields: {
      libelle:       { type: 'string', required: true, max: 200, alias: ['nom', 'designation', 'product', 'name', 'article'] },
      code:          { type: 'string', max: 40,  alias: ['ref', 'reference', 'sku', 'code_barre', 'code_article'] },
      prix_vente_ht: { type: 'number', alias: ['pv', 'prix_vente', 'prix', 'price', 'pu', 'prix_unitaire'] },
      prix_achat_ht: { type: 'number', alias: ['pa', 'prix_achat', 'cost', 'cout_achat'] },
      unite:         { type: 'string', max: 30,  alias: ['unit', 'um', 'unite_mesure'] },
      taux_tva:      { type: 'number', alias: ['tva', 'vat', 'tva_percent'] },
      type:          { type: 'string', max: 15,  alias: ['kind'] },  // 'produit' ou 'service'
    },
  },

  // ─── Plan comptable personnalisé ────────────────────────────────────────
  // numero + libelle obligatoires. classe et nature sont déduits du 1er
  // chiffre du numero si non fournis (1=ressources/PASSIF, 2=immo/ACTIF…).
  plan_comptable: {
    table: 'plan_comptable',
    libelle: 'plan comptable',
    fields: {
      numero:   { type: 'string', required: true, max: 15,  alias: ['compte', 'n_compte', 'no_compte', 'code'] },
      libelle:  { type: 'string', required: true, max: 200, alias: ['intitule', 'designation', 'nom', 'label'] },
      classe:   { type: 'number', alias: ['cls', 'class'] },
      nature:   { type: 'string', max: 15, alias: ['type', 'category'] },
      lettrable: { type: 'string', max: 5,  alias: ['lettrage', 'lettr'] },  // "true"/"false" ou "oui"/"non"
    },
  },

  // ─── Balance d'ouverture ────────────────────────────────────────────────
  // Une ligne = un solde de compte en début d'exercice. Débit OU crédit
  // (pas les deux). La somme totale débit doit égaler la somme totale
  // crédit ; la validation se fait globalement après normalisation.
  balance_ouverture: {
    table: 'balance_ouverture',  // virtuel : on insère dans ecritures + lignes_ecriture
    libelle: 'balance d\'ouverture',
    fields: {
      numero:  { type: 'string', required: true, max: 15,  alias: ['compte', 'n_compte', 'no_compte', 'numero_compte', 'code'] },
      libelle: { type: 'string', max: 200, alias: ['intitule', 'designation', 'nom', 'label'] },
      debit:   { type: 'number', alias: ['debit_ouverture', 'd', 'solde_debit', 'sd'] },
      credit:  { type: 'number', alias: ['credit_ouverture', 'c', 'solde_credit', 'sc'] },
    },
  },

  // ─── Écritures historiques ──────────────────────────────────────────────
  // 1 ligne = 1 ligne d'écriture. Les lignes du même numero_piece + date
  // + journal sont groupées en une écriture après validation d'équilibre.
  ecritures_historiques: {
    table: 'ecritures',  // virtuel
    libelle: 'écritures historiques',
    fields: {
      date:         { type: 'string', required: true, max: 12,  alias: ['date_ecriture', 'date_piece', 'jour'] },
      journal:      { type: 'string', required: true, max: 8,   alias: ['journal_code', 'code_journal', 'jrn'] },
      numero_piece: { type: 'string', required: true, max: 40,  alias: ['piece', 'num_piece', 'n_piece', 'numero', 'reference'] },
      compte:       { type: 'string', required: true, max: 15,  alias: ['compte_numero', 'n_compte', 'no_compte', 'code'] },
      libelle:      { type: 'string', max: 255, alias: ['libelle_ligne', 'intitule', 'designation'] },
      debit:        { type: 'number', alias: ['d', 'montant_debit'] },
      credit:       { type: 'number', alias: ['c', 'montant_credit'] },
    },
  },
};

// ─── 5. Helpers spécifiques au plan comptable et aux écritures ─────────────

// Déduit la classe SYSCOHADA à partir du 1er chiffre du n° de compte
// (« 411000 Clients » → classe 4). Sécurise les imports où l'utilisateur
// oublie la colonne classe.
function deduireClasse(numero) {
  const c = parseInt(String(numero).trim().charAt(0), 10);
  return (c >= 1 && c <= 9) ? c : null;
}

// Déduit la nature comptable depuis la classe SYSCOHADA standard :
//   1 → PASSIF (capitaux/dettes durables)   6 → CHARGE
//   2 → ACTIF (immo) / 3 → ACTIF (stocks)   7 → PRODUIT
//   4 → tiers (ACTIF/PASSIF selon contexte) 8 → HAO (hors activités ordinaires)
//   5 → ACTIF (trésorerie)                  9 → ANALYTIQUE
// Pour la classe 4 (tiers) on retourne ACTIF par défaut — le bilan recalcule
// le sens à la consolidation, donc pas critique.
function deduireNature(classe) {
  const map = { 1: 'PASSIF', 2: 'ACTIF', 3: 'ACTIF', 4: 'ACTIF', 5: 'ACTIF',
                6: 'CHARGE', 7: 'PRODUIT', 8: 'HAO', 9: 'ANALYTIQUE' };
  return map[classe] || null;
}

// Parse une date (string) au format JJ/MM/AAAA, AAAA-MM-JJ, JJ-MM-AAAA…
// Retourne ISO YYYY-MM-DD ou null si invalide.
function parserDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  // FR JJ/MM/AAAA ou JJ-MM-AAAA
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // FR avec année courte JJ/MM/AA
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);
  if (m) {
    const yy = parseInt(m[3], 10);
    const annee = yy < 50 ? 2000 + yy : 1900 + yy;
    return `${annee}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}


// ─── 4. Application du schéma : normalisation + validation ────────────────
// Retourne { rowsOk, errors }
//   rowsOk : array d'objets prêts à insérer (clés canoniques du schéma)
//   errors : array { ligne_excel: N, champ, message }
function validerEtNormaliser(rows, schemaName) {
  const schema = SCHEMAS[schemaName];
  if (!schema) throw new Error(`Schéma inconnu : ${schemaName}`);

  // Construire la table inverse : alias → champ canonique
  const aliasMap = {};
  for (const [canonical, def] of Object.entries(schema.fields)) {
    aliasMap[canonical] = canonical;
    (def.alias || []).forEach(a => { aliasMap[a] = canonical; });
  }

  const rowsOk = [];
  const errors = [];

  rows.forEach((rawRow, idx) => {
    const ligneExcel = idx + 2;  // +1 pour 0-indexed, +1 pour skip header
    const normalisedRow = {};

    // 1) Remap les clés via aliasMap
    for (const [key, val] of Object.entries(rawRow)) {
      const canonical = aliasMap[key];
      if (!canonical) continue;  // colonne inconnue ignorée silencieusement
      normalisedRow[canonical] = val;
    }

    // 2) Vérifier les requis + valider chaque champ
    const errorsForRow = [];
    const cleanRow = {};
    for (const [field, def] of Object.entries(schema.fields)) {
      const val = normalisedRow[field];
      const present = val !== null && val !== undefined && String(val).trim() !== '';

      if (def.required && !present) {
        errorsForRow.push({ ligne_excel: ligneExcel, champ: field, message: `Champ requis « ${field} » manquant.` });
        continue;
      }
      if (!present) {
        cleanRow[field] = null;
        continue;
      }

      let v = val;
      // Validation par type
      if (def.type === 'email') {
        v = String(v).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          errorsForRow.push({ ligne_excel: ligneExcel, champ: field, message: `Email « ${v} » invalide.` });
          continue;
        }
      } else if (def.type === 'phone') {
        v = String(v).trim().replace(/\s+/g, ' ');
      } else if (def.type === 'number') {
        // Accepter "12 345,67" (FR), "12,345.67" (EN), "12345.67"
        const cleaned = String(v).replace(/\s/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
        v = Number(cleaned);
        if (Number.isNaN(v)) {
          errorsForRow.push({ ligne_excel: ligneExcel, champ: field, message: `Nombre « ${val} » invalide.` });
          continue;
        }
      } else {
        v = String(v).trim();
      }

      // Validation longueur
      if (def.max && typeof v === 'string' && v.length > def.max) {
        errorsForRow.push({ ligne_excel: ligneExcel, champ: field, message: `Champ « ${field} » trop long (${v.length} > ${def.max} caractères).` });
        continue;
      }
      cleanRow[field] = v;
    }

    if (errorsForRow.length > 0) {
      errors.push(...errorsForRow);
    } else {
      rowsOk.push({ ligne_excel: ligneExcel, data: cleanRow });
    }
  });

  return { rowsOk, errors };
}

module.exports = {
  SCHEMAS,
  parserBuffer,
  parserXlsx,
  parserCsv,
  validerEtNormaliser,
  normaliserHeader,
  deduireClasse,
  deduireNature,
  parserDate,
};
