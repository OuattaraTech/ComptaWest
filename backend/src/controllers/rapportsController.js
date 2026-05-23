const pool = require('../../config/database');
const path = require('path');
const pdfmake = require('pdfmake');
const QRCode = require('qrcode');

const pdfmakeDir = path.dirname(require.resolve('pdfmake/package.json'));
pdfmake.addFonts({
  Roboto: {
    normal: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Regular.ttf'),
    bold: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Medium.ttf'),
    italics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-Italic.ttf'),
    bolditalics: path.join(pdfmakeDir, 'fonts/Roboto/Roboto-MediumItalic.ttf'),
  },
});
pdfmake.setLocalAccessPolicy(() => true);
pdfmake.setUrlAccessPolicy(() => false);

const VERT = '#00D4AA';
const GRIS = '#6B7A99';
const GRIS_CLAIR = '#F5F7FA';
const NOIR = '#0B0F1A';
const ROUGE = '#FF5C6B';
const BORDURE = '#E2E8F0';

const fmtMontant = (n) => {
  const num = Math.round(Number(n) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
const fmtDate = (d) => d ? String(d).slice(0, 10) : 'N/A';

// Convertit un montant en lettres (français, jusqu'à 999 999 999 999)
const montantEnLettres = (n) => {
  const num = Math.round(Math.abs(Number(n) || 0));
  if (num === 0) return 'zéro';
  const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  // isMultiplier = true → cent et vingt restent invariables (suivis de mille/million)
  const moinsMille = (n, isMultiplier = false) => {
    if (n === 0) return '';
    if (n < 20) return unites[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      if (d === 7 || d === 9) {
        const reste = 10 + u;
        return dizaines[d] + (u === 1 && d === 7 ? ' et ' : '-') + unites[reste];
      }
      if (u === 0) return dizaines[d] + (d === 8 && !isMultiplier ? 's' : '');
      if (u === 1 && d !== 8) return dizaines[d] + ' et un';
      return dizaines[d] + '-' + unites[u];
    }
    const c = Math.floor(n / 100);
    const reste = n % 100;
    const centaine = c === 1 ? 'cent' : unites[c] + ' cent' + (reste === 0 && !isMultiplier ? 's' : '');
    return reste === 0 ? centaine : centaine + ' ' + moinsMille(reste, false);
  };

  const milliards = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const milliers = Math.floor((num % 1000000) / 1000);
  const reste = num % 1000;

  let parts = [];
  if (milliards) parts.push((milliards === 1 ? 'un' : moinsMille(milliards, true)) + ' milliard' + (milliards > 1 ? 's' : ''));
  if (millions) parts.push((millions === 1 ? 'un' : moinsMille(millions, true)) + ' million' + (millions > 1 ? 's' : ''));
  if (milliers) parts.push((milliers === 1 ? '' : moinsMille(milliers, true) + ' ') + 'mille');
  if (reste) parts.push(moinsMille(reste, false));
  return parts.join(' ').trim();
};

// Mention TVA légale selon le régime fiscal (UEMOA / CGI)
const mentionTVA = (regime, tauxTva) => {
  if (parseFloat(tauxTva) === 0 || regime === 'Exonéré') {
    return 'TVA non applicable — opération exonérée selon le Code Général des Impôts';
  }
  if (regime === 'RSI' || regime === 'BIC') {
    return 'TVA acquittée d\'après les encaissements';
  }
  return 'TVA acquittée d\'après les débits';
};

// Mention légale standard sur les pénalités de retard
const mentionPenalites = 'En cas de retard de paiement, des pénalités seront appliquées au taux légal en vigueur, sans préjudice de l\'indemnité forfaitaire pour frais de recouvrement.';

const buildFactureDoc = (facture, lignes, opts = {}) => {
  const { qrFne = null, qrPaiement = null, urlPaiement = null } = opts;
  const typeMap = { facture: 'FACTURE', devis: 'DEVIS', avoir: 'AVOIR', proforma: 'PROFORMA' };
  const typeLabel = typeMap[facture.type] || 'FACTURE';
  const devise = facture.devise || 'FCFA';

  const sousTotal = parseFloat(facture.sous_total) || 0;
  const tauxTva = parseFloat(facture.taux_tva) || 0;
  const montantTva = parseFloat(facture.montant_tva) || 0;
  const totalTtc = parseFloat(facture.total_ttc) || 0;
  const montantPaye = parseFloat(facture.montant_paye) || 0;
  const reste = totalTtc - montantPaye;

  // ── En-tête émetteur (raison sociale + identification complète OHADA)
  const nomComplet = [facture.emetteur_forme_juridique, facture.emetteur_nom]
    .filter(Boolean).join(' ');
  const emetteur = [{ text: nomComplet || facture.emetteur_nom || '', style: 'titre' }];

  if (facture.emetteur_sigle) {
    emetteur.push({ text: `(${facture.emetteur_sigle})`, style: 'sous' });
  }
  const adresseLignes = [];
  if (facture.emetteur_adresse) adresseLignes.push(facture.emetteur_adresse);
  if (facture.emetteur_ville || facture.emetteur_pays) {
    adresseLignes.push([facture.emetteur_ville, facture.emetteur_pays].filter(Boolean).join(', '));
  }
  if (adresseLignes.length) emetteur.push({ text: adresseLignes.join(' — '), style: 'sous' });

  const contactsLine = [
    facture.emetteur_tel ? `Tél : ${facture.emetteur_tel}` : null,
    facture.emetteur_email || null,
  ].filter(Boolean).join('  ·  ');
  if (contactsLine) emetteur.push({ text: contactsLine, style: 'sous' });

  // Identifiants légaux DGI : NCC (Numéro Compte Contribuable) prioritaire
  // sur NINEA (rétrocompatibilité), puis IDU, RCCM, régime, centre fiscal.
  // Toutes ces mentions sont OBLIGATOIRES sur une facture FNE certifiée.
  const numeroFiscal = facture.emetteur_ncc || facture.emetteur_ninea;
  const idsLine1 = [
    numeroFiscal ? `NCC : ${numeroFiscal}` : null,
    facture.emetteur_idu ? `IDU : ${facture.emetteur_idu}` : null,
    facture.emetteur_rccm ? `RCCM : ${facture.emetteur_rccm}` : null,
  ].filter(Boolean).join('  ·  ');
  if (idsLine1) emetteur.push({ text: idsLine1, style: 'sousFort' });

  const idsLine2 = [
    facture.emetteur_regime_fiscal ? `Régime fiscal : ${facture.emetteur_regime_fiscal}` : null,
    facture.emetteur_centre_fiscal ? `Centre fiscal : ${facture.emetteur_centre_fiscal}` : null,
  ].filter(Boolean).join('  ·  ');
  if (idsLine2) emetteur.push({ text: idsLine2, style: 'sous' });

  // ── Bloc métadonnées
  const facturePart = [
    { text: `${typeLabel} N°${facture.numero || ''}`, style: 'h2' },
    { text: `Date d'émission : ${fmtDate(facture.date_emission)}`, style: 'valeur' },
    { text: `Échéance : ${fmtDate(facture.date_echeance)}`, style: 'valeur' },
    { text: `Statut : ${(facture.statut || '').toUpperCase()}`, style: 'valeur' },
  ];
  // Référence facture d'origine (obligatoire pour les avoirs)
  if (facture.type === 'avoir' && facture.origine_numero) {
    facturePart.push({
      text: [{ text: 'Facture d\'origine : ', bold: true, color: ROUGE }, { text: facture.origine_numero, color: ROUGE }],
      style: 'valeur',
    });
  }

  const clientPart = [
    { text: 'FACTURÉ À', style: 'label' },
    { text: facture.client_nom || '—', style: 'clientNom' },
  ];
  if (facture.client_adresse) clientPart.push({ text: facture.client_adresse, style: 'sous' });
  if (facture.client_ville || facture.client_pays) {
    clientPart.push({ text: [facture.client_ville, facture.client_pays].filter(Boolean).join(', '), style: 'sous' });
  }
  if (facture.client_email) clientPart.push({ text: facture.client_email, style: 'sous' });
  if (facture.client_tel) clientPart.push({ text: facture.client_tel, style: 'sous' });
  // NCC client : OBLIGATOIRE pour B2B (sans lui, la TVA n'est pas déductible
  // par le client et la facture risque d'être refusée à la certification FNE).
  // On affiche en vert si présent, en alerte rouge si manquant et client
  // identifié comme entreprise (code commence par CLI-E ou type pro défini).
  if (facture.client_ninea) {
    clientPart.push({ text: `NCC : ${facture.client_ninea}`, style: 'sousFort' });
  } else if (facture.client_nom && parseFloat(facture.total_ttc) >= 100000) {
    // Heuristique : facture > 100 000 FCFA sans NCC client → probablement B2B
    clientPart.push({
      text: '⚠ NCC client manquant — la TVA ne sera pas déductible côté acheteur',
      fontSize: 8, color: ROUGE, italics: true, margin: [0, 2, 0, 0],
    });
  }
  if (facture.client_rccm) clientPart.push({ text: `RCCM : ${facture.client_rccm}`, style: 'sous' });

  // Table des lignes
  const headerRow = ['Description', 'Qté', 'Unité', `P.U. (${devise})`, 'Remise', `Total (${devise})`]
    .map((h) => ({ text: h, style: 'thead' }));

  const lignesRows = lignes.map((l) => {
    const remise = parseFloat(l.remise) || 0;
    return [
      { text: l.description || '', style: 'tcell' },
      { text: String(l.quantite ?? 1), style: 'tcellCenter' },
      { text: l.unite || 'unité', style: 'tcellCenter' },
      { text: fmtMontant(l.prix_unitaire), style: 'tcellRight' },
      { text: remise ? `${remise}%` : '-', style: 'tcellCenter' },
      { text: fmtMontant(l.total), style: 'tcellRight' },
    ];
  });

  // Totaux
  const totauxBody = [
    [{ text: 'Sous-total HT', style: 'totLabel' }, { text: `${fmtMontant(sousTotal)} ${devise}`, style: 'totValue' }],
    [{ text: `TVA (${tauxTva.toFixed(0)}%)`, style: 'totLabel' }, { text: `${fmtMontant(montantTva)} ${devise}`, style: 'totValue' }],
    [{ text: 'TOTAL TTC', style: 'totTotal' }, { text: `${fmtMontant(totalTtc)} ${devise}`, style: 'totTotal' }],
  ];
  if (montantPaye > 0) {
    totauxBody.push([{ text: 'Déjà payé', style: 'totLabel' }, { text: `${fmtMontant(montantPaye)} ${devise}`, style: 'totValue' }]);
    totauxBody.push([{ text: 'RESTE À PAYER', style: 'totReste' }, { text: `${fmtMontant(reste)} ${devise}`, style: 'totReste' }]);
  }

  // ── Sticker FNE (DGI) — en haut à droite. Trois éléments réglementaires :
  // logo « FNE » + QR vers la page DGI de vérification + numéro fiscal unique.
  // Si la facture n'a pas été certifiée, le bloc est masqué.
  const stickerFne = qrFne && facture.fne_numero ? {
    width: 120,
    stack: [
      { text: 'CERTIFIÉE FNE', fontSize: 7, bold: true, color: '#0B6E58',
        alignment: 'center', margin: [0, 0, 0, 3] },
      { image: qrFne, width: 90, alignment: 'center' },
      { text: facture.fne_numero, fontSize: 7, color: NOIR,
        alignment: 'center', bold: true, margin: [0, 3, 0, 0] },
      { text: `DGI · Côte d'Ivoire${facture.fne_mode === 'mock' ? ' (test)' : ''}`,
        fontSize: 6, color: GRIS, italics: true, alignment: 'center' },
    ],
  } : null;

  // ── En-tête : logo (optionnel) + identification émetteur + sticker FNE
  const headerCols = [];
  if (facture.emetteur_logo_url) {
    headerCols.push({ image: facture.emetteur_logo_url, fit: [100, 70], width: 110 });
  }
  headerCols.push({ stack: emetteur, width: '*' });
  if (stickerFne) headerCols.push(stickerFne);

  const headerBlock = { columns: headerCols, columnGap: 14 };

  const content = [
    headerBlock,
    { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 2, lineColor: VERT }] },
    { text: '', margin: [0, 8, 0, 0] },
    {
      columns: [
        { width: '*', stack: facturePart },
        { width: '*', stack: clientPart },
      ],
      columnGap: 20,
    },
    { text: '', margin: [0, 16, 0, 0] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 35, 50, 70, 45, 80],
        body: [headerRow, ...lignesRows],
      },
      layout: {
        fillColor: (rowIndex) => rowIndex === 0 ? VERT : (rowIndex % 2 === 0 ? GRIS_CLAIR : null),
        hLineColor: () => BORDURE,
        vLineColor: () => BORDURE,
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        paddingTop: () => 6,
        paddingBottom: () => 6,
        paddingLeft: () => 8,
        paddingRight: () => 8,
      },
    },
    { text: '', margin: [0, 14, 0, 0] },
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 'auto',
          table: { widths: ['auto', 'auto'], body: totauxBody },
          layout: 'noBorders',
        },
      ],
    },
    // ── Montant en lettres (mention recommandée SYSCOHADA)
    { text: '', margin: [0, 8, 0, 0] },
    {
      text: [
        { text: 'Arrêtée la présente facture à la somme de : ', italics: true, color: GRIS },
        { text: `${montantEnLettres(totalTtc)} ${devise}`, bold: true, color: NOIR },
      ],
      fontSize: 9,
    },
    // ── Mention TVA légale
    { text: '', margin: [0, 6, 0, 0] },
    {
      text: mentionTVA(facture.emetteur_regime_fiscal, tauxTva),
      fontSize: 9,
      italics: true,
      color: GRIS,
    },
    // ── Mention timbre de quittance (FAQ DGI Q#10 — le sticker FNE
    //    ne dispense pas du timbre, qui reste un impôt distinct).
    //    Affichée uniquement pour les vraies factures, pas pour les
    //    devis / proforma qui ne sont pas exigibles.
    ...(facture.type === 'facture' ? [{
      text: 'Le sticker fiscal numérique (FNE) ne dispense pas du timbre de quittance (CGI CI art. 1004 et suivants).',
      fontSize: 8,
      italics: true,
      color: GRIS,
      margin: [0, 3, 0, 0],
    }] : []),
  ];

  // ── Bloc paiement intégré : QR Mobile Money + coordonnées bancaires.
  // Visible uniquement sur les factures (pas devis / avoir / proforma).
  if (facture.type === 'facture' && qrPaiement) {
    const coordBancaires = [];
    if (facture.emetteur_banque) coordBancaires.push({ text: facture.emetteur_banque, fontSize: 9, bold: true, color: NOIR });
    if (facture.emetteur_rib)    coordBancaires.push({ text: `RIB : ${facture.emetteur_rib}`, fontSize: 8.5, color: NOIR, margin: [0, 1, 0, 0] });
    if (facture.emetteur_swift)  coordBancaires.push({ text: `SWIFT : ${facture.emetteur_swift}`, fontSize: 8.5, color: GRIS, margin: [0, 1, 0, 0] });

    content.push({ text: '', margin: [0, 14, 0, 0] });
    content.push({
      table: {
        widths: [95, '*', '*'],
        body: [[
          // QR de paiement
          {
            stack: [
              { image: qrPaiement, width: 80, alignment: 'center' },
              { text: 'Scanner pour payer', fontSize: 7, color: GRIS, alignment: 'center', italics: true, margin: [0, 3, 0, 0] },
            ],
            border: [false, false, true, false],
            borderColor: [BORDURE, BORDURE, BORDURE, BORDURE],
            margin: [0, 4, 8, 4],
          },
          // Méthodes Mobile Money
          {
            stack: [
              { text: 'PAIEMENT MOBILE MONEY', fontSize: 8, bold: true, color: VERT,
                margin: [0, 0, 0, 4] },
              { text: 'Wave · Orange Money · MTN MoMo', fontSize: 9.5, bold: true, color: NOIR },
              { text: 'Scannez le QR ou ouvrez le lien :', fontSize: 8, color: GRIS, margin: [0, 4, 0, 1] },
              { text: urlPaiement, fontSize: 8, color: VERT, decoration: 'underline' },
            ],
            border: [false, false, true, false],
            borderColor: [BORDURE, BORDURE, BORDURE, BORDURE],
            margin: [8, 6, 8, 4],
          },
          // Coordonnées bancaires
          {
            stack: coordBancaires.length ? [
              { text: 'VIREMENT BANCAIRE', fontSize: 8, bold: true, color: VERT, margin: [0, 0, 0, 4] },
              ...coordBancaires,
            ] : [
              { text: 'VIREMENT BANCAIRE', fontSize: 8, bold: true, color: GRIS, margin: [0, 0, 0, 4] },
              { text: 'Coordonnées non renseignées — Paramètres → Entreprise',
                fontSize: 8, color: GRIS, italics: true },
            ],
            border: [false, false, false, false],
            margin: [8, 6, 0, 4],
          },
        ]],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => BORDURE,
        vLineColor: () => BORDURE,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
    });
  }

  // ── Conditions, notes, pénalités
  content.push({ text: '', margin: [0, 12, 0, 0] });
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: BORDURE }] });
  content.push({ text: '', margin: [0, 8, 0, 0] });
  if (facture.conditions_paiement) {
    content.push({ text: [{ text: 'Conditions de paiement : ', bold: true }, facture.conditions_paiement], style: 'sous' });
  }
  if (facture.notes) {
    content.push({ text: [{ text: 'Notes : ', bold: true }, facture.notes], style: 'sous' });
  }
  // Pénalités (sauf pour les devis qui ne sont pas exigibles)
  if (facture.type !== 'devis' && facture.type !== 'proforma') {
    content.push({ text: mentionPenalites, style: 'sous', italics: true, margin: [0, 4, 0, 0] });
  }

  // ── Pied de page : raison sociale complète + identifiants légaux
  const footerLine1 = [
    facture.emetteur_forme_juridique,
    facture.emetteur_nom,
  ].filter(Boolean).join(' ');
  const footerLine2Parts = [
    facture.emetteur_adresse,
    facture.emetteur_ville,
    facture.emetteur_pays,
  ].filter(Boolean);
  const footerLine3Parts = [
    facture.emetteur_rccm ? `RCCM ${facture.emetteur_rccm}` : null,
    (facture.emetteur_ncc || facture.emetteur_ninea)
      ? `NCC ${facture.emetteur_ncc || facture.emetteur_ninea}` : null,
    facture.emetteur_idu ? `IDU ${facture.emetteur_idu}` : null,
    facture.emetteur_regime_fiscal ? `Régime ${facture.emetteur_regime_fiscal}` : null,
    facture.emetteur_centre_fiscal || null,
    facture.emetteur_email || null,
    facture.emetteur_tel || null,
  ].filter(Boolean);

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 100],
    content,
    footer: (currentPage, pageCount) => ({
      stack: [
        { canvas: [{ type: 'line', x1: 40, y1: 0, x2: 555, y2: 0, lineWidth: 0.5, lineColor: VERT }] },
        { text: footerLine1, alignment: 'center', fontSize: 8, bold: true, color: NOIR, margin: [0, 6, 0, 1] },
        footerLine2Parts.length
          ? { text: footerLine2Parts.join(' · '), alignment: 'center', fontSize: 7, color: GRIS, margin: [0, 0, 0, 1] }
          : { text: '' },
        footerLine3Parts.length
          ? { text: footerLine3Parts.join(' · '), alignment: 'center', fontSize: 7, color: GRIS, margin: [0, 0, 0, 2] }
          : { text: '' },
        {
          text: `Document généré par ApeX   ·   Page ${currentPage}/${pageCount}`,
          alignment: 'center',
          fontSize: 7,
          color: GRIS,
          italics: true,
        },
      ],
    }),
    defaultStyle: { font: 'Roboto', fontSize: 10, color: NOIR },
    styles: {
      titre: { fontSize: 16, bold: true, color: NOIR },
      sous: { fontSize: 9, color: GRIS, margin: [0, 0, 0, 2] },
      sousFort: { fontSize: 9, color: NOIR, bold: true, margin: [0, 1, 0, 2] },
      h2: { fontSize: 15, bold: true, color: VERT, margin: [0, 0, 0, 6] },
      label: { fontSize: 8, bold: true, color: GRIS, margin: [0, 0, 0, 3] },
      valeur: { fontSize: 10, color: NOIR, margin: [0, 0, 0, 2] },
      clientNom: { fontSize: 12, bold: true, color: NOIR, margin: [0, 0, 0, 3] },
      thead: { color: 'white', bold: true, fontSize: 9 },
      tcell: { fontSize: 9 },
      tcellCenter: { fontSize: 9, alignment: 'center' },
      tcellRight: { fontSize: 9, alignment: 'right' },
      totLabel: { fontSize: 10, color: GRIS, alignment: 'right' },
      totValue: { fontSize: 10, alignment: 'right' },
      totTotal: { fontSize: 12, bold: true, color: VERT, alignment: 'right', margin: [0, 4, 0, 0] },
      totReste: { fontSize: 11, bold: true, color: ROUGE, alignment: 'right' },
    },
  };
};

// GET /api/rapports/bilan
const getBilan = async (req, res) => {
  try {
    const { annee = new Date().getFullYear() } = req.query;
    const anneeNum = parseInt(annee);
    if (isNaN(anneeNum) || anneeNum < 2000 || anneeNum > 2100) {
      return res.status(400).json({ success: false, message: 'Année invalide' });
    }
    const eid = req.entrepriseId;

    const entRes = await pool.query('SELECT * FROM entreprises WHERE id=$1', [eid]);
    const entreprise = entRes.rows[0];

    const recettesRes = await pool.query(`
      SELECT EXTRACT(MONTH FROM date_emission) AS mois,
             COALESCE(SUM(total_ttc),0) AS total,
             COALESCE(SUM(montant_paye),0) AS encaisse
      FROM factures WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_emission)=$2 AND statut!='annulee'
        AND type='facture'
      GROUP BY mois ORDER BY mois
    `, [eid, anneeNum]);

    const depensesRes = await pool.query(`
      SELECT cd.nom AS categorie, cd.couleur, COALESCE(SUM(d.montant_ttc),0) AS total
      FROM categories_depenses cd
      LEFT JOIN depenses d ON d.categorie_id=cd.id AND EXTRACT(YEAR FROM d.date_depense)=$2 AND d.statut='payee'
      WHERE cd.entreprise_id=$1
      GROUP BY cd.id ORDER BY total DESC
    `, [eid, anneeNum]);

    const taxesRes = await pool.query(`
      SELECT type_taxe, COALESCE(SUM(montant_du),0) AS total_du, COALESCE(SUM(montant_paye),0) AS total_paye
      FROM declarations_taxes
      WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM periode_fin)=$2
      GROUP BY type_taxe ORDER BY total_du DESC
    `, [eid, anneeNum]);

    const totalRecettes = recettesRes.rows.reduce((s, r) => s + parseFloat(r.total), 0);
    const totalDepenses = depensesRes.rows.reduce((s, r) => s + parseFloat(r.total), 0);
    const totalTaxes = taxesRes.rows.reduce((s, r) => s + parseFloat(r.total_paye), 0);
    const resultatNet = totalRecettes - totalDepenses - totalTaxes;

    res.json({
      success: true,
      data: {
        entreprise: entreprise.nom,
        ninea: entreprise.ninea,
        regime_fiscal: entreprise.regime_fiscal,
        pays: entreprise.pays,
        devise: entreprise.devise || 'FCFA',
        annee: anneeNum,
        recettes_par_mois: recettesRes.rows,
        depenses_par_categorie: depensesRes.rows,
        taxes: taxesRes.rows,
        totaux: {
          recettes: totalRecettes,
          depenses: totalDepenses,
          taxes_payees: totalTaxes,
          resultat_net: resultatNet,
          marge: totalRecettes > 0 ? ((resultatNet / totalRecettes) * 100).toFixed(2) : 0,
        },
      },
    });
  } catch (err) {
    console.error('Erreur getBilan:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Construit le document pdfmake du rapport annuel (compte de résultat)
const buildBilanDoc = (data) => {
  const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                     'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const devise = data.devise || 'FCFA';
  const t = data.totaux;

  // ── Lignes par mois (12 lignes, comble les mois sans données)
  const recettesParMois = {};
  data.recettes_par_mois.forEach(r => { recettesParMois[parseInt(r.mois)] = r; });

  const moisRows = MOIS_NOMS.map((nom, i) => {
    const r = recettesParMois[i + 1];
    const total = parseFloat(r?.total || 0);
    const encaisse = parseFloat(r?.encaisse || 0);
    return [
      { text: `${nom} ${data.annee}`, style: 'tcell' },
      { text: total > 0 ? fmtMontant(total) : '—', style: 'tcellRight' },
      { text: encaisse > 0 ? fmtMontant(encaisse) : '—', style: 'tcellRight' },
      { text: total > 0 ? `${((encaisse / total) * 100).toFixed(0)}%` : '—', style: 'tcellCenter' },
    ];
  });

  // ── Dépenses par catégorie (ignorer les catégories à zéro)
  const categoriesActives = data.depenses_par_categorie.filter(d => parseFloat(d.total) > 0);
  const depensesRows = categoriesActives.length > 0
    ? categoriesActives.map(d => {
        const total = parseFloat(d.total);
        const pct = t.depenses > 0 ? ((total / t.depenses) * 100).toFixed(1) : 0;
        return [
          { text: d.categorie || '—', style: 'tcell' },
          { text: fmtMontant(total), style: 'tcellRight' },
          { text: `${pct}%`, style: 'tcellRight' },
        ];
      })
    : [[{ text: 'Aucune dépense enregistrée', colSpan: 3, style: 'tcellCenter', italics: true, color: GRIS }, {}, {}]];

  // ── Taxes par type
  const taxesActives = data.taxes.filter(tx => parseFloat(tx.total_du) > 0);
  const taxesRows = taxesActives.length > 0
    ? taxesActives.map(tx => [
        { text: tx.type_taxe || '—', style: 'tcell' },
        { text: fmtMontant(tx.total_du), style: 'tcellRight' },
        { text: fmtMontant(tx.total_paye), style: 'tcellRight' },
      ])
    : [[{ text: 'Aucune déclaration fiscale', colSpan: 3, style: 'tcellCenter', italics: true, color: GRIS }, {}, {}]];

  // ── Indicateurs clés (4 cases)
  const indicateurs = [
    { label: 'RECETTES HT',  val: t.recettes,     color: VERT },
    { label: 'DÉPENSES',     val: t.depenses,     color: ROUGE },
    { label: 'TAXES PAYÉES', val: t.taxes_payees, color: '#A855F7' },
    { label: 'RÉSULTAT NET', val: t.resultat_net, color: t.resultat_net >= 0 ? VERT : ROUGE },
  ];
  const indicateursTable = {
    columns: indicateurs.map((ind, i) => ({
      width: '*',
      margin: [i === 0 ? 0 : 4, 0, i === indicateurs.length - 1 ? 0 : 4, 0],
      table: {
        widths: ['*'],
        body: [
          [{
            stack: [
              { text: ind.label, fontSize: 7, bold: true, color: GRIS, margin: [0, 0, 0, 4] },
              { text: `${fmtMontant(ind.val)} ${devise}`, fontSize: 12, bold: true, color: ind.color },
            ],
            fillColor: GRIS_CLAIR,
            margin: [10, 10, 10, 10],
            border: [false, false, false, false],
          }],
        ],
      },
      layout: 'noBorders',
    })),
  };

  // ── En-tête entreprise
  const enTeteEntreprise = [
    { text: data.entreprise || '—', style: 'titre' },
  ];
  const idsLine = [
    data.ninea ? `NINEA : ${data.ninea}` : null,
    data.regime_fiscal ? `Régime : ${data.regime_fiscal}` : null,
    data.pays || null,
  ].filter(Boolean).join('  ·  ');
  if (idsLine) enTeteEntreprise.push({ text: idsLine, style: 'sous' });

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    content: [
      // En-tête
      {
        columns: [
          { stack: enTeteEntreprise, width: '*' },
          {
            stack: [
              { text: 'COMPTE DE RÉSULTAT', style: 'h2', alignment: 'right' },
              { text: `Exercice ${data.annee}`, style: 'sousFort', alignment: 'right' },
              { text: `Édité le ${fmtDate(new Date())}`, style: 'sous', alignment: 'right' },
            ],
            width: 'auto',
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: VERT }], margin: [0, 12, 0, 16] },

      // Indicateurs synthétiques
      indicateursTable,
      { text: '', margin: [0, 4, 0, 0] },
      {
        text: t.recettes > 0
          ? `Marge nette : ${t.marge}% du chiffre d'affaires`
          : 'Aucune recette enregistrée sur l\'exercice',
        fontSize: 9, italics: true, color: GRIS, alignment: 'right', margin: [0, 4, 0, 16],
      },

      // ── Recettes par mois
      { text: 'Recettes mensuelles', style: 'sectionTitre' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Mois', style: 'thead' },
              { text: `Facturé (${devise})`, style: 'thead', alignment: 'right' },
              { text: `Encaissé (${devise})`, style: 'thead', alignment: 'right' },
              { text: 'Taux', style: 'thead', alignment: 'center' },
            ],
            ...moisRows,
            [
              { text: 'TOTAL', style: 'tfoot' },
              { text: fmtMontant(t.recettes), style: 'tfootRight' },
              { text: fmtMontant(data.recettes_par_mois.reduce((s, r) => s + parseFloat(r.encaisse || 0), 0)), style: 'tfootRight' },
              { text: '', style: 'tfoot' },
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex) => rowIndex === 0 ? VERT : (rowIndex % 2 === 0 ? GRIS_CLAIR : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => BORDURE,
        },
      },

      // ── Dépenses par catégorie
      { text: 'Charges par catégorie', style: 'sectionTitre', margin: [0, 20, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            [
              { text: 'Catégorie', style: 'thead' },
              { text: `Montant (${devise})`, style: 'thead', alignment: 'right' },
              { text: 'Part', style: 'thead', alignment: 'right' },
            ],
            ...depensesRows,
            [
              { text: 'TOTAL CHARGES', style: 'tfoot' },
              { text: fmtMontant(t.depenses), style: 'tfootRight' },
              { text: '100%', style: 'tfootRight' },
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex) => rowIndex === 0 ? VERT : (rowIndex % 2 === 0 ? GRIS_CLAIR : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => BORDURE,
        },
      },

      // ── Taxes payées
      { text: 'Fiscalité et charges sociales', style: 'sectionTitre', margin: [0, 20, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            [
              { text: 'Type', style: 'thead' },
              { text: `Montant dû (${devise})`, style: 'thead', alignment: 'right' },
              { text: `Payé (${devise})`, style: 'thead', alignment: 'right' },
            ],
            ...taxesRows,
          ],
        },
        layout: {
          fillColor: (rowIndex) => rowIndex === 0 ? VERT : (rowIndex % 2 === 0 ? GRIS_CLAIR : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => BORDURE,
        },
      },

      // ── Synthèse finale
      { text: '', margin: [0, 20, 0, 0] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: BORDURE }] },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              widths: ['auto', 'auto'],
              body: [
                [{ text: 'Recettes', style: 'totLabel' }, { text: `${fmtMontant(t.recettes)} ${devise}`, style: 'totValue' }],
                [{ text: '− Dépenses', style: 'totLabel' }, { text: `${fmtMontant(t.depenses)} ${devise}`, style: 'totValue' }],
                [{ text: '− Taxes', style: 'totLabel' }, { text: `${fmtMontant(t.taxes_payees)} ${devise}`, style: 'totValue' }],
                [
                  { text: 'RÉSULTAT NET', style: 'totTotal' },
                  { text: `${fmtMontant(t.resultat_net)} ${devise}`, style: 'totTotal', color: t.resultat_net >= 0 ? VERT : ROUGE },
                ],
              ],
            },
            layout: 'noBorders',
            margin: [0, 12, 0, 0],
          },
        ],
      },
      { text: '', margin: [0, 8, 0, 0] },
      {
        text: [
          { text: 'Résultat arrêté à la somme de : ', italics: true, color: GRIS },
          { text: `${montantEnLettres(t.resultat_net)} ${devise}`, bold: true, color: NOIR },
        ],
        fontSize: 9,
      },
      { text: '', margin: [0, 6, 0, 0] },
      {
        text: 'Document à valeur informative — Comptabilité tenue selon le référentiel SYSCOHADA révisé.',
        fontSize: 8, italics: true, color: GRIS,
      },
    ],
    footer: (currentPage, pageCount) => ({
      stack: [
        { canvas: [{ type: 'line', x1: 40, y1: 0, x2: 555, y2: 0, lineWidth: 0.5, lineColor: VERT }] },
        {
          text: `${data.entreprise || ''}   ·   Compte de résultat ${data.annee}   ·   Page ${currentPage}/${pageCount}`,
          alignment: 'center', fontSize: 7, color: GRIS, italics: true, margin: [0, 6, 0, 0],
        },
      ],
    }),
    defaultStyle: { font: 'Roboto', fontSize: 10, color: NOIR },
    styles: {
      titre: { fontSize: 16, bold: true, color: NOIR },
      h2: { fontSize: 15, bold: true, color: VERT },
      sous: { fontSize: 9, color: GRIS, margin: [0, 0, 0, 2] },
      sousFort: { fontSize: 10, color: NOIR, bold: true, margin: [0, 2, 0, 2] },
      sectionTitre: { fontSize: 12, bold: true, color: NOIR, margin: [0, 0, 0, 8] },
      thead: { color: 'white', bold: true, fontSize: 9, margin: [4, 4, 4, 4] },
      tcell: { fontSize: 9, margin: [4, 4, 4, 4] },
      tcellRight: { fontSize: 9, alignment: 'right', margin: [4, 4, 4, 4] },
      tcellCenter: { fontSize: 9, alignment: 'center', margin: [4, 4, 4, 4] },
      tfoot: { fontSize: 10, bold: true, color: NOIR, margin: [4, 5, 4, 5] },
      tfootRight: { fontSize: 10, bold: true, color: NOIR, alignment: 'right', margin: [4, 5, 4, 5] },
      totLabel: { fontSize: 10, color: GRIS, alignment: 'right', margin: [0, 2, 8, 2] },
      totValue: { fontSize: 10, alignment: 'right', margin: [0, 2, 0, 2] },
      totTotal: { fontSize: 13, bold: true, alignment: 'right', margin: [0, 6, 0, 0] },
    },
  };
};

// GET /api/rapports/bilan/pdf?annee=YYYY
const getBilanPDF = async (req, res) => {
  try {
    const { annee = new Date().getFullYear() } = req.query;
    const anneeNum = parseInt(annee);
    if (isNaN(anneeNum) || anneeNum < 2000 || anneeNum > 2100) {
      return res.status(400).json({ success: false, message: 'Année invalide' });
    }
    const eid = req.entrepriseId;

    const entRes = await pool.query('SELECT * FROM entreprises WHERE id=$1', [eid]);
    const entreprise = entRes.rows[0];
    if (!entreprise) {
      return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    }

    const recettesRes = await pool.query(`
      SELECT EXTRACT(MONTH FROM date_emission) AS mois,
             COALESCE(SUM(total_ttc),0) AS total,
             COALESCE(SUM(montant_paye),0) AS encaisse
      FROM factures WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM date_emission)=$2 AND statut!='annulee'
        AND type='facture'
      GROUP BY mois ORDER BY mois
    `, [eid, anneeNum]);

    const depensesRes = await pool.query(`
      SELECT cd.nom AS categorie, cd.couleur, COALESCE(SUM(d.montant_ttc),0) AS total
      FROM categories_depenses cd
      LEFT JOIN depenses d ON d.categorie_id=cd.id AND EXTRACT(YEAR FROM d.date_depense)=$2 AND d.statut='payee'
      WHERE cd.entreprise_id=$1
      GROUP BY cd.id ORDER BY total DESC
    `, [eid, anneeNum]);

    const taxesRes = await pool.query(`
      SELECT type_taxe, COALESCE(SUM(montant_du),0) AS total_du, COALESCE(SUM(montant_paye),0) AS total_paye
      FROM declarations_taxes
      WHERE entreprise_id=$1 AND EXTRACT(YEAR FROM periode_fin)=$2
      GROUP BY type_taxe ORDER BY total_du DESC
    `, [eid, anneeNum]);

    const totalRecettes = recettesRes.rows.reduce((s, r) => s + parseFloat(r.total), 0);
    const totalDepenses = depensesRes.rows.reduce((s, r) => s + parseFloat(r.total), 0);
    const totalTaxes = taxesRes.rows.reduce((s, r) => s + parseFloat(r.total_paye), 0);
    const resultatNet = totalRecettes - totalDepenses - totalTaxes;

    const data = {
      entreprise: entreprise.nom,
      ninea: entreprise.ninea,
      regime_fiscal: entreprise.regime_fiscal,
      pays: entreprise.pays,
      devise: entreprise.devise || 'FCFA',
      annee: anneeNum,
      recettes_par_mois: recettesRes.rows,
      depenses_par_categorie: depensesRes.rows,
      taxes: taxesRes.rows,
      totaux: {
        recettes: totalRecettes,
        depenses: totalDepenses,
        taxes_payees: totalTaxes,
        resultat_net: resultatNet,
        marge: totalRecettes > 0 ? ((resultatNet / totalRecettes) * 100).toFixed(2) : 0,
      },
    };

    const docDefinition = buildBilanDoc(data);
    const buffer = await pdfmake.createPdf(docDefinition).getBuffer();

    const slug = (entreprise.nom || 'entreprise').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Bilan_${slug}_${anneeNum}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Erreur getBilanPDF:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Erreur génération PDF' });
    }
  }
};

// GET /api/rapports/facture/:id/pdf
const getFacturePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    // SELECT enrichi (mai 2026) : ajout des champs DGI obligatoires
    // (centre_fiscal, idu, banque/rib/swift) + jointure sur la
    // certification FNE pour récupérer numero_fne + qr_data (URL DGI
    // de vérification publique) à apposer en sticker sur le PDF.
    const factureRes = await pool.query(`
      SELECT f.*,
        c.nom AS client_nom, c.email AS client_email, c.telephone AS client_tel,
        c.adresse AS client_adresse, c.ville AS client_ville, c.pays AS client_pays,
        c.ninea AS client_ninea, c.rccm AS client_rccm, c.code AS client_code,
        e.nom AS emetteur_nom, e.sigle AS emetteur_sigle, e.forme_juridique AS emetteur_forme_juridique,
        e.email AS emetteur_email, e.telephone AS emetteur_tel,
        e.adresse AS emetteur_adresse, e.ville AS emetteur_ville, e.pays AS emetteur_pays,
        e.ninea AS emetteur_ninea, e.ncc AS emetteur_ncc, e.idu AS emetteur_idu,
        e.rccm AS emetteur_rccm,
        e.regime_fiscal AS emetteur_regime_fiscal,
        e.centre_fiscal AS emetteur_centre_fiscal,
        e.banque AS emetteur_banque, e.rib AS emetteur_rib, e.swift AS emetteur_swift,
        e.logo_url AS emetteur_logo_url, e.devise,
        forig.numero AS origine_numero,
        fne.numero_fne AS fne_numero, fne.qr_data AS fne_qr_url, fne.mode AS fne_mode
      FROM factures f
      LEFT JOIN clients c ON c.id=f.client_id
      LEFT JOIN entreprises e ON e.id=f.entreprise_id
      LEFT JOIN factures forig ON forig.id=f.facture_origine_id
      LEFT JOIN factures_certifications_fne fne ON fne.facture_id=f.id
      WHERE f.id=$1 AND f.entreprise_id=$2
    `, [id, eid]);

    if (factureRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }

    const facture = factureRes.rows[0];
    const lignesRes = await pool.query('SELECT * FROM lignes_facture WHERE facture_id=$1 ORDER BY ordre', [id]);

    // QR codes générés en PNG dataURL (consommés par pdfmake comme `image`)
    const qrFne = facture.fne_qr_url
      ? await QRCode.toDataURL(facture.fne_qr_url, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
      : null;
    // QR de paiement Mobile Money : URL apex.ci/p/{numero} pointant vers
    // une page publique de règlement (les opérateurs configurés par
    // l'entreprise déterminent les méthodes proposées).
    const urlPaiement = `https://apex.ci/p/${facture.numero}`;
    const qrPaiement = await QRCode.toDataURL(urlPaiement, { width: 110, margin: 1, errorCorrectionLevel: 'M' });

    const docDefinition = buildFactureDoc(facture, lignesRes.rows, { qrFne, qrPaiement, urlPaiement });
    const buffer = await pdfmake.createPdf(docDefinition).getBuffer();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${facture.numero}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Erreur PDF:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Erreur génération PDF' });
    }
  }
};

module.exports = { getBilan, getBilanPDF, getFacturePDF };
