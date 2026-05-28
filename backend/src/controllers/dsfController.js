/**
 * DSF (Déclaration Statistique et Fiscale) — endpoints.
 *
 * V1 (Lot DSF-1) :
 *   GET /api/dsf/exercices               — Liste des exercices disponibles
 *   GET /api/dsf/:exerciceId/data        — JSON des 3 formulaires
 *   GET /api/dsf/:exerciceId/pdf         — PDF formaté SYSCOHADA
 *
 * Permission requise : cloture.read (expert_comptable, admin, propriétaire).
 */
const path = require('path');
const pool = require('../../config/database');
const pdfmake = require('pdfmake');
const { genererLiasseDSF } = require('../utils/dsf');

const pdfmakeDir = path.dirname(require.resolve('pdfmake/package.json'));
pdfmake.addFonts({
  Roboto: {
    normal: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Regular.ttf'),
    bold: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Medium.ttf'),
    italics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Italic.ttf'),
    bolditalics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-MediumItalic.ttf'),
  },
});

const fmt = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ─── GET /api/dsf/exercices ────────────────────────────────────────────────
async function listerExercices(req, res) {
  try {
    const r = await pool.query(
      `SELECT id, libelle, date_debut, date_fin, cloture, date_cloture
         FROM exercices
        WHERE entreprise_id = $1
        ORDER BY date_debut DESC`,
      [req.entrepriseId]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/dsf/:exerciceId/data ─────────────────────────────────────────
async function getDataDSF(req, res) {
  try {
    const data = await genererLiasseDSF(req.entrepriseId, req.params.exerciceId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Erreur getDataDSF:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/dsf/:exerciceId/pdf ──────────────────────────────────────────
async function getPdfDSF(req, res) {
  try {
    const data = await genererLiasseDSF(req.entrepriseId, req.params.exerciceId);
    const docDef = buildPdfDoc(data);
    const buffer = await pdfmake.createPdf(docDef).getBuffer();
    const slug = (data.entreprise.nom || 'entreprise').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const lib = (data.exercice.libelle || 'exercice').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="DSF_${slug}_${lib}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Erreur getPdfDSF:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

function buildPdfDoc(data) {
  const { entreprise, exercice, compte_resultat, bilan_actif, bilan_passif, tafire, annexes, equilibre } = data;
  const ent = entreprise;
  const periode = `du ${String(exercice.date_debut).slice(0, 10)} au ${String(exercice.date_fin).slice(0, 10)}`;

  // Header commun à chaque formulaire
  const headerEntreprise = (sousTitre) => ([
    {
      table: {
        widths: ['*', 'auto'],
        body: [[
          {
            stack: [
              { text: ent.nom, fontSize: 13, bold: true },
              { text: `${ent.forme_juridique || ''}${ent.ville ? ' · ' + ent.ville : ''}${ent.pays ? ' · ' + ent.pays : ''}`, fontSize: 9, color: '#6B7280' },
              { text: ent.ncc ? `NCC ${ent.ncc}` : '', fontSize: 9, color: '#6B7280' },
            ],
          },
          {
            stack: [
              { text: 'DSF — SYSCOHADA révisé', fontSize: 10, bold: true, alignment: 'right' },
              { text: periode, fontSize: 9, color: '#6B7280', alignment: 'right' },
              { text: exercice.cloture ? 'Exercice clôturé' : 'Exercice en cours', fontSize: 9, color: exercice.cloture ? '#10B981' : '#F59E0B', alignment: 'right', italics: true },
            ],
          },
        ]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 14],
    },
    { text: sousTitre, fontSize: 14, bold: true, color: '#0F8A6E', margin: [0, 0, 0, 10] },
  ]);

  // Tableau Bilan ACTIF
  const tableauActif = {
    table: {
      widths: ['auto', '*', 'auto', 'auto', 'auto'],
      headerRows: 1,
      body: [
        [
          { text: 'Réf.', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
          { text: 'Libellé', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
          { text: 'Brut', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
          { text: 'Amort./Prov.', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
          { text: 'Net', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
        ],
        ...bilan_actif.lignes.map(l => [
          { text: l.ref, fontSize: 8, color: l.total ? '#0F8A6E' : '#6B7280', bold: !!l.total },
          { text: l.libelle, fontSize: 8.5, bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null },
          { text: fmt(l.brut), fontSize: 8.5, alignment: 'right', bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null },
          { text: l.amort ? fmt(l.amort) : '', fontSize: 8.5, alignment: 'right', bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null },
          { text: fmt(l.net), fontSize: 8.5, alignment: 'right', bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null },
        ]),
      ],
    },
    layout: { hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
  };

  // Tableau Bilan PASSIF
  const tableauPassif = {
    table: {
      widths: ['auto', '*', 'auto'],
      headerRows: 1,
      body: [
        [
          { text: 'Réf.', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
          { text: 'Libellé', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
          { text: 'Montant net', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
        ],
        ...bilan_passif.lignes.map(l => [
          { text: l.ref, fontSize: 8, color: l.total ? '#0F8A6E' : '#6B7280', bold: !!l.total },
          { text: l.libelle, fontSize: 8.5, bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null, margin: [l.niveau === 1 ? 10 : 0, 0, 0, 0] },
          { text: fmt(l.valeur), fontSize: 8.5, alignment: 'right', bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null },
        ]),
      ],
    },
    layout: { hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
  };

  // Tableau Compte de Résultat
  const tableauResultat = {
    table: {
      widths: ['auto', '*', 'auto'],
      headerRows: 1,
      body: [
        [
          { text: 'Réf.', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
          { text: 'Libellé', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
          { text: 'Montant', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
        ],
        ...compte_resultat.lignes.map(l => [
          { text: l.ref, fontSize: 8, color: l.total ? '#0F8A6E' : '#6B7280', bold: !!l.total },
          { text: l.libelle, fontSize: 8.5, bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null, margin: [l.niveau === 1 ? 10 : 0, 0, 0, 0] },
          { text: fmt(l.valeur), fontSize: 8.5, alignment: 'right', bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null },
        ]),
      ],
    },
    layout: { hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
  };

  const content = [
    ...headerEntreprise('FORMULAIRE N°10 — BILAN — ACTIF'),
    tableauActif,
    { text: '', pageBreak: 'after' },

    ...headerEntreprise('FORMULAIRE N°11 — BILAN — PASSIF'),
    tableauPassif,
    Math.abs(equilibre) > 1
      ? { text: `⚠ Écart de bilan : ${fmt(equilibre)} FCFA — vérifier les écritures de l'exercice`,
          fontSize: 9, color: '#DC2626', italics: true, margin: [0, 10, 0, 0] }
      : { text: `✓ Bilan équilibré (Actif = Passif = ${fmt(bilan_actif.total_net)} FCFA)`,
          fontSize: 9, color: '#10B981', italics: true, margin: [0, 10, 0, 0] },
    { text: '', pageBreak: 'after' },

    ...headerEntreprise('FORMULAIRE N°4 — COMPTE DE RÉSULTAT'),
    tableauResultat,
    { text: '', pageBreak: 'after' },

    ...headerEntreprise('FORMULAIRE N°6 — TAFIRE (Tableau Financier des Ressources et Emplois)'),
    ...(tafire.avertissement
      ? [{ text: '⚠ ' + tafire.avertissement, fontSize: 9, color: '#B45309', italics: true, margin: [0, 0, 0, 10] }]
      : []),
    {
      table: {
        widths: ['auto', '*', 'auto'],
        headerRows: 1,
        body: [
          [
            { text: 'Réf.', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
            { text: 'Libellé', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
            { text: 'Montant', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
          ],
          ...tafire.lignes.map(l => l.section ? [
            { text: l.ref, fontSize: 8, color: '#0F8A6E', bold: true, fillColor: '#F0FDF4' },
            { text: l.libelle, fontSize: 9, bold: true, color: '#0F8A6E', fillColor: '#F0FDF4', colSpan: 2 },
            {},
          ] : [
            { text: l.ref, fontSize: 8, color: l.total ? '#0F8A6E' : '#6B7280', bold: !!l.total },
            { text: l.libelle, fontSize: 8.5, bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null, margin: [l.niveau === 1 ? 10 : 0, 0, 0, 0] },
            { text: l.valeur === null ? '' : fmt(l.valeur), fontSize: 8.5, alignment: 'right', bold: !!l.total, fillColor: l.surligne ? '#FEF3C7' : null },
          ]),
        ],
      },
      layout: { hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
    },
    !tafire.avertissement && Math.abs(tafire.ecart || 0) > 1
      ? { text: `⚠ Écart TAFIRE : ${fmt(tafire.ecart)} FCFA — vérifier la cohérence des soldes N-1`,
          fontSize: 9, color: '#DC2626', italics: true, margin: [0, 10, 0, 0] }
      : !tafire.avertissement
      ? { text: '✓ TAFIRE équilibré · Ressources – Emplois = Variation trésorerie',
          fontSize: 9, color: '#10B981', italics: true, margin: [0, 10, 0, 0] }
      : null,

    // ─── PAGE 5 : Annexes immobilisations & amortissements ─────────────────
    { text: '', pageBreak: 'after' },
    ...headerEntreprise('FORMULAIRE N°3A — IMMOBILISATIONS (mouvements bruts)'),
    annexes.immobilisations.lignes.length === 0
      ? { text: 'Aucune immobilisation enregistrée.', fontSize: 9, italics: true, color: '#6B7280' }
      : {
        table: {
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
          headerRows: 1,
          body: [
            [
              { text: 'Réf.', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
              { text: 'Catégorie', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
              { text: 'Brut ouverture', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
              { text: 'Acquisitions', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
              { text: 'Cessions', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
              { text: 'Brut clôture', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
            ],
            ...annexes.immobilisations.lignes.map(l => [
              { text: l.ref, fontSize: 8, color: '#6B7280' },
              { text: l.libelle, fontSize: 8.5 },
              { text: fmt(l.brut_ouverture), fontSize: 8.5, alignment: 'right' },
              { text: fmt(l.acquisitions), fontSize: 8.5, alignment: 'right' },
              { text: fmt(l.cessions), fontSize: 8.5, alignment: 'right' },
              { text: fmt(l.brut_cloture), fontSize: 8.5, alignment: 'right', bold: true },
            ]),
            [
              { text: '', fontSize: 8 },
              { text: 'TOTAL', bold: true, fontSize: 9, fillColor: '#FEF3C7' },
              { text: fmt(annexes.immobilisations.totaux.brut_ouverture), fontSize: 9, alignment: 'right', bold: true, fillColor: '#FEF3C7' },
              { text: fmt(annexes.immobilisations.totaux.acquisitions), fontSize: 9, alignment: 'right', bold: true, fillColor: '#FEF3C7' },
              { text: fmt(annexes.immobilisations.totaux.cessions), fontSize: 9, alignment: 'right', bold: true, fillColor: '#FEF3C7' },
              { text: fmt(annexes.immobilisations.totaux.brut_cloture), fontSize: 9, alignment: 'right', bold: true, fillColor: '#FEF3C7' },
            ],
          ],
        },
        layout: { hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
      },

    { text: 'FORMULAIRE N°3B — AMORTISSEMENTS (mouvements cumulés)', fontSize: 13, bold: true, color: '#0F8A6E', margin: [0, 18, 0, 8] },
    annexes.amortissements.lignes.length === 0
      ? { text: 'Aucun amortissement enregistré.', fontSize: 9, italics: true, color: '#6B7280' }
      : {
        table: {
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
          headerRows: 1,
          body: [
            [
              { text: 'Réf.', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
              { text: 'Catégorie', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
              { text: 'Cumul N-1', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
              { text: 'Dotations', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
              { text: 'Reprises', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
              { text: 'Cumul N', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
            ],
            ...annexes.amortissements.lignes.map(l => [
              { text: l.ref, fontSize: 8, color: '#6B7280' },
              { text: l.libelle, fontSize: 8.5 },
              { text: fmt(l.cumul_ouverture), fontSize: 8.5, alignment: 'right' },
              { text: fmt(l.dotations), fontSize: 8.5, alignment: 'right' },
              { text: fmt(l.reprises), fontSize: 8.5, alignment: 'right' },
              { text: fmt(l.cumul_cloture), fontSize: 8.5, alignment: 'right', bold: true },
            ]),
            [
              { text: '', fontSize: 8 },
              { text: 'TOTAL', bold: true, fontSize: 9, fillColor: '#FEF3C7' },
              { text: fmt(annexes.amortissements.totaux.cumul_ouverture), fontSize: 9, alignment: 'right', bold: true, fillColor: '#FEF3C7' },
              { text: fmt(annexes.amortissements.totaux.dotations), fontSize: 9, alignment: 'right', bold: true, fillColor: '#FEF3C7' },
              { text: fmt(annexes.amortissements.totaux.reprises), fontSize: 9, alignment: 'right', bold: true, fillColor: '#FEF3C7' },
              { text: fmt(annexes.amortissements.totaux.cumul_cloture), fontSize: 9, alignment: 'right', bold: true, fillColor: '#FEF3C7' },
            ],
          ],
        },
        layout: { hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
      },

    // ─── PAGE 6 : Effectifs + Emprunts + Créances/Dettes ───────────────────
    { text: '', pageBreak: 'after' },
    ...headerEntreprise('FORMULAIRE N°4 — EFFECTIFS · N°10 — EMPRUNTS · N°12 — ÉTAT CRÉANCES/DETTES'),

    { text: 'EFFECTIFS', fontSize: 11, bold: true, color: '#0F8A6E', margin: [0, 0, 0, 6] },
    annexes.effectifs
      ? { text: `Salariés actifs en fin d'exercice : ${annexes.effectifs.total_fin_exercice}\n${annexes.effectifs.details}`, fontSize: 10 }
      : { text: 'Module Paie non disponible — effectif à compléter manuellement.', fontSize: 9, italics: true, color: '#6B7280' },

    { text: 'EMPRUNTS ET DETTES FINANCIÈRES', fontSize: 11, bold: true, color: '#0F8A6E', margin: [0, 16, 0, 6] },
    annexes.emprunts.lignes.length === 0
      ? { text: 'Aucun emprunt en cours.', fontSize: 9, italics: true, color: '#6B7280' }
      : {
        table: {
          widths: ['auto', '*', 'auto'],
          headerRows: 1,
          body: [
            [
              { text: 'Compte', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
              { text: 'Libellé', bold: true, fontSize: 8, fillColor: '#F0FDF4' },
              { text: 'Solde restant', bold: true, fontSize: 8, alignment: 'right', fillColor: '#F0FDF4' },
            ],
            ...annexes.emprunts.lignes.map(l => [
              { text: l.compte, fontSize: 9, color: '#6B7280' },
              { text: l.libelle, fontSize: 9 },
              { text: fmt(l.montant), fontSize: 9, alignment: 'right' },
            ]),
            [
              { text: '', fontSize: 9 },
              { text: 'TOTAL', bold: true, fontSize: 9.5, fillColor: '#FEF3C7' },
              { text: fmt(annexes.emprunts.total), bold: true, fontSize: 9.5, alignment: 'right', fillColor: '#FEF3C7' },
            ],
          ],
        },
        layout: { hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
      },

    { text: 'ÉTAT DES CRÉANCES ET DETTES', fontSize: 11, bold: true, color: '#0F8A6E', margin: [0, 16, 0, 6] },
    {
      table: {
        widths: ['*', 'auto'],
        body: [
          [{ text: 'Créances clients (compte 41)', fontSize: 9.5 }, { text: fmt(annexes.creances_dettes.creances_clients), fontSize: 9.5, alignment: 'right' }],
          [{ text: 'Autres créances (42-48)', fontSize: 9.5 }, { text: fmt(annexes.creances_dettes.autres_creances), fontSize: 9.5, alignment: 'right' }],
          [{ text: 'Dettes fournisseurs (compte 40)', fontSize: 9.5 }, { text: fmt(annexes.creances_dettes.dettes_fournisseurs), fontSize: 9.5, alignment: 'right' }],
          [{ text: 'Dettes fiscales (compte 44)', fontSize: 9.5 }, { text: fmt(annexes.creances_dettes.dettes_fiscales), fontSize: 9.5, alignment: 'right' }],
          [{ text: 'Dettes sociales (comptes 42-43)', fontSize: 9.5 }, { text: fmt(annexes.creances_dettes.dettes_sociales), fontSize: 9.5, alignment: 'right' }],
          [{ text: 'Autres dettes (45-47)', fontSize: 9.5 }, { text: fmt(annexes.creances_dettes.autres_dettes), fontSize: 9.5, alignment: 'right' }],
        ],
      },
      layout: { hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
    },
  ].filter(Boolean);

  return {
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 50],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1F2937' },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `${ent.nom} · DSF ${exercice.libelle || ''}`, fontSize: 7, color: '#9CA3AF', alignment: 'left', margin: [30, 0, 0, 0] },
        { text: `Page ${currentPage} / ${pageCount}`, fontSize: 7, color: '#9CA3AF', alignment: 'right', margin: [0, 0, 30, 0] },
      ],
    }),
  };
}

// ─── GET /api/dsf/:exerciceId/csv ──────────────────────────────────────────
// Export multi-sections au format CSV pivot. Une section par formulaire,
// précédée d'une ligne d'en-tête `# FORMULAIRE N°X — Titre`.
// Adapté à la spec officielle e-DGI le moment venu (XML ou autre).
async function getCsvDSF(req, res) {
  try {
    const data = await genererLiasseDSF(req.entrepriseId, req.params.exerciceId);
    const csv = buildCsvExport(data);
    const slug = (data.entreprise.nom || 'entreprise').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const lib  = (data.exercice.libelle || 'exercice').replace(/[^a-zA-Z0-9]/g, '_');
    // BOM UTF-8 pour Excel
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="DSF_${slug}_${lib}.csv"`);
    res.send('﻿' + csv);
  } catch (err) {
    console.error('Erreur getCsvDSF:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

function cellCsv(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvExport(data) {
  const lignes = [];
  // Métadonnées en tête
  lignes.push(`# DSF SYSCOHADA révisé`);
  lignes.push(`# Entreprise: ${cellCsv(data.entreprise.nom)}`);
  lignes.push(`# NCC: ${cellCsv(data.entreprise.ncc || '')}`);
  lignes.push(`# Régime: ${cellCsv(data.entreprise.regime_fiscal || '')}`);
  lignes.push(`# Exercice: ${cellCsv(data.exercice.libelle || '')} (${String(data.exercice.date_debut).slice(0,10)} → ${String(data.exercice.date_fin).slice(0,10)})`);
  lignes.push('');

  // Bilan ACTIF
  lignes.push('# FORMULAIRE N°10 — BILAN ACTIF');
  lignes.push('Ref,Libelle,Brut,Amort_Prov,Net');
  for (const l of data.bilan_actif.lignes) {
    lignes.push([l.ref, cellCsv(l.libelle), Math.round(l.brut || 0), Math.round(l.amort || 0), Math.round(l.net || 0)].join(','));
  }
  lignes.push('');

  // Bilan PASSIF
  lignes.push('# FORMULAIRE N°11 — BILAN PASSIF');
  lignes.push('Ref,Libelle,Montant');
  for (const l of data.bilan_passif.lignes) {
    lignes.push([l.ref, cellCsv(l.libelle), Math.round(l.valeur || 0)].join(','));
  }
  lignes.push('');

  // Compte de résultat
  lignes.push('# FORMULAIRE N°4 — COMPTE DE RESULTAT');
  lignes.push('Ref,Libelle,Montant');
  for (const l of data.compte_resultat.lignes) {
    lignes.push([l.ref, cellCsv(l.libelle), Math.round(l.valeur || 0)].join(','));
  }
  lignes.push('');

  // TAFIRE
  lignes.push('# FORMULAIRE N°6 — TAFIRE');
  if (data.tafire.avertissement) {
    lignes.push(`# Avertissement: ${cellCsv(data.tafire.avertissement)}`);
  }
  lignes.push('Ref,Libelle,Montant');
  for (const l of data.tafire.lignes) {
    if (l.section) {
      lignes.push(`# ${cellCsv(l.libelle)}`);
    } else {
      lignes.push([l.ref, cellCsv(l.libelle), l.valeur === null ? '' : Math.round(l.valeur || 0)].join(','));
    }
  }
  lignes.push('');

  // Annexes immobilisations
  lignes.push('# FORMULAIRE N°3A — IMMOBILISATIONS');
  lignes.push('Ref,Categorie,Brut_ouverture,Acquisitions,Cessions,Brut_cloture');
  for (const l of data.annexes.immobilisations.lignes) {
    lignes.push([l.ref, cellCsv(l.libelle), Math.round(l.brut_ouverture), Math.round(l.acquisitions), Math.round(l.cessions), Math.round(l.brut_cloture)].join(','));
  }
  lignes.push('');

  // Annexes amortissements
  lignes.push('# FORMULAIRE N°3B — AMORTISSEMENTS');
  lignes.push('Ref,Categorie,Cumul_ouverture,Dotations,Reprises,Cumul_cloture');
  for (const l of data.annexes.amortissements.lignes) {
    lignes.push([l.ref, cellCsv(l.libelle), Math.round(l.cumul_ouverture), Math.round(l.dotations), Math.round(l.reprises), Math.round(l.cumul_cloture)].join(','));
  }
  lignes.push('');

  // Effectifs
  lignes.push('# FORMULAIRE N°4 — EFFECTIFS');
  if (data.annexes.effectifs) {
    lignes.push(`Effectif_fin_exercice,${data.annexes.effectifs.total_fin_exercice}`);
  } else {
    lignes.push('# Effectif non disponible (module Paie non utilisé)');
  }
  lignes.push('');

  // Emprunts
  lignes.push('# FORMULAIRE N°10 — EMPRUNTS');
  lignes.push('Compte,Libelle,Solde_restant');
  for (const l of data.annexes.emprunts.lignes) {
    lignes.push([l.compte, cellCsv(l.libelle), Math.round(l.montant)].join(','));
  }
  lignes.push('');

  // Créances/Dettes
  lignes.push('# FORMULAIRE N°12 — ETAT CREANCES ET DETTES');
  lignes.push('Poste,Montant');
  const cd = data.annexes.creances_dettes;
  lignes.push(`Creances_clients,${Math.round(cd.creances_clients)}`);
  lignes.push(`Autres_creances,${Math.round(cd.autres_creances)}`);
  lignes.push(`Dettes_fournisseurs,${Math.round(cd.dettes_fournisseurs)}`);
  lignes.push(`Dettes_fiscales,${Math.round(cd.dettes_fiscales)}`);
  lignes.push(`Dettes_sociales,${Math.round(cd.dettes_sociales)}`);
  lignes.push(`Autres_dettes,${Math.round(cd.autres_dettes)}`);

  return lignes.join('\n');
}

module.exports = { listerExercices, getDataDSF, getPdfDSF, getCsvDSF };
