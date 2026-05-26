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
  const { entreprise, exercice, compte_resultat, bilan_actif, bilan_passif, equilibre } = data;
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
  ];

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

module.exports = { listerExercices, getDataDSF, getPdfDSF };
