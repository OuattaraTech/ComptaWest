const pool = require('../../config/database');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

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

// GET /api/rapports/facture/:id/pdf
const getFacturePDF = async (req, res) => {
  const tmpDir = os.tmpdir();
  // Noms de fichiers avec token aléatoire pour éviter les collisions
  const token = crypto.randomBytes(8).toString('hex');
  const dataFile = path.join(tmpDir, `cw_data_${token}.json`);
  const outFile = path.join(tmpDir, `cw_pdf_${token}.pdf`);
  const scriptFile = path.join(tmpDir, `cw_gen_${token}.py`);

  try {
    const { id } = req.params;
    const eid = req.entrepriseId;

    const factureRes = await pool.query(`
      SELECT f.*,
        c.nom AS client_nom, c.email AS client_email, c.telephone AS client_tel,
        c.adresse AS client_adresse, c.ville AS client_ville, c.ninea AS client_ninea,
        e.nom AS emetteur_nom, e.adresse AS emetteur_adresse, e.telephone AS emetteur_tel,
        e.ninea AS emetteur_ninea, e.rccm AS emetteur_rccm, e.ville AS emetteur_ville, e.devise
      FROM factures f
      LEFT JOIN clients c ON c.id=f.client_id
      LEFT JOIN entreprises e ON e.id=f.entreprise_id
      WHERE f.id=$1 AND f.entreprise_id=$2
    `, [id, eid]);

    if (factureRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Facture introuvable' });
    }

    const facture = factureRes.rows[0];
    const lignesRes = await pool.query('SELECT * FROM lignes_facture WHERE facture_id=$1 ORDER BY ordre', [id]);

    fs.writeFileSync(dataFile, JSON.stringify({ facture, lignes: lignesRes.rows }));

    const pythonScript = `
import json, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)

facture = data['facture']
lignes = data['lignes']

doc = SimpleDocTemplate(sys.argv[2], pagesize=A4,
    rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

styles = getSampleStyleSheet()
VERT = colors.HexColor('#00D4AA')
GRIS = colors.HexColor('#6B7A99')
GRIS_CLAIR = colors.HexColor('#F5F7FA')
NOIR = colors.HexColor('#0B0F1A')

titre_style = ParagraphStyle('titre', fontSize=18, fontName='Helvetica-Bold', textColor=NOIR)
sous_style = ParagraphStyle('sous', fontSize=9, textColor=GRIS, spaceAfter=2)
label_style = ParagraphStyle('label', fontSize=8, textColor=GRIS, fontName='Helvetica-Bold')
valeur_style = ParagraphStyle('valeur', fontSize=10, textColor=NOIR, spaceAfter=2)

story = []
entreprise = facture.get('emetteur_nom', '')
story.append(Paragraph(entreprise, titre_style))
if facture.get('emetteur_ville'):
    story.append(Paragraph(facture['emetteur_ville'] + ((' — NINEA: ' + facture['emetteur_ninea']) if facture.get('emetteur_ninea') else ''), sous_style))
if facture.get('emetteur_tel'):
    story.append(Paragraph('Tel: ' + facture['emetteur_tel'], sous_style))
story.append(Spacer(1, 0.3*cm))
story.append(HRFlowable(width='100%', thickness=2, color=VERT))
story.append(Spacer(1, 0.5*cm))

type_map = {'facture':'FACTURE','devis':'DEVIS','avoir':'AVOIR','proforma':'PROFORMA'}
type_label = type_map.get(facture.get('type','facture'), 'FACTURE')
num = facture.get('numero','')
date_em = str(facture.get('date_emission',''))[:10]
date_ech = str(facture.get('date_echeance',''))[:10] if facture.get('date_echeance') else 'N/A'
client_nom = facture.get('client_nom','—')

hdr_data = [
    [Paragraph(f'<b>{type_label} N\u00b0{num}</b>', ParagraphStyle('h2',fontSize=15,fontName='Helvetica-Bold',textColor=VERT)),
     Paragraph('<b>FACTUR\u00c9 \u00c0</b>', label_style)],
    [Paragraph(f'Date : {date_em}', valeur_style), Paragraph(f'<b>{client_nom}</b>', ParagraphStyle('cn',fontSize=12,fontName='Helvetica-Bold'))],
    [Paragraph(f'\u00c9ch\u00e9ance : {date_ech}', valeur_style), Paragraph(facture.get('client_email','') or '', sous_style)],
    [Paragraph(f'Statut : {facture.get("statut","").upper()}', valeur_style), Paragraph(facture.get('client_tel','') or '', sous_style)],
]
if facture.get('client_ninea'):
    hdr_data.append(['', Paragraph(f'NINEA: {facture["client_ninea"]}', sous_style)])

t_hdr = Table(hdr_data, colWidths=[9*cm, 8*cm])
t_hdr.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),2)]))
story.append(t_hdr)
story.append(Spacer(1, 0.8*cm))

headers = ['Description','Qt\u00e9','Unit\u00e9','P.U. (FCFA)','Remise','Total (FCFA)']
tdata = [headers]
for l in lignes:
    rem = f"{l.get('remise',0)}%" if l.get('remise',0) else '-'
    tdata.append([l.get('description',''), str(l.get('quantite',1)), l.get('unite','unit\u00e9'),
        f"{float(l.get('prix_unitaire',0)):,.0f}", rem, f"{float(l.get('total',0)):,.0f}"])

tt = Table(tdata, colWidths=[6.5*cm,1.5*cm,1.5*cm,2.5*cm,1.5*cm,3.5*cm], repeatRows=1)
tt.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,0),VERT), ('TEXTCOLOR',(0,0),(-1,0),colors.white),
    ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'), ('FONTSIZE',(0,0),(-1,-1),9),
    ('ALIGN',(1,0),(-1,-1),'CENTER'), ('ALIGN',(-1,0),(-1,-1),'RIGHT'), ('ALIGN',(3,0),(3,-1),'RIGHT'),
    ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,GRIS_CLAIR]),
    ('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#E2E8F0')),
    ('TOPPADDING',(0,0),(-1,-1),6), ('BOTTOMPADDING',(0,0),(-1,-1),6),
    ('LEFTPADDING',(0,0),(-1,-1),8), ('RIGHTPADDING',(0,0),(-1,-1),8),
]))
story.append(tt)
story.append(Spacer(1, 0.7*cm))

sous_total = float(facture.get('sous_total',0))
taux_tva = float(facture.get('taux_tva',18))
montant_tva = float(facture.get('montant_tva',0))
total_ttc = float(facture.get('total_ttc',0))
montant_paye = float(facture.get('montant_paye',0))
reste = total_ttc - montant_paye

totaux = [['','Sous-total HT',f"{sous_total:,.0f} FCFA"],
          ['',f'TVA ({taux_tva:.0f}%)',f"{montant_tva:,.0f} FCFA"],
          ['','TOTAL TTC',f"{total_ttc:,.0f} FCFA"]]
if montant_paye > 0:
    totaux += [['',f'D\u00e9j\u00e0 pay\u00e9',f"{montant_paye:,.0f} FCFA"],['','RESTE \u00c0 PAYER',f"{reste:,.0f} FCFA"]]

t_tot = Table(totaux, colWidths=[9*cm,4*cm,4*cm])
ts = [('ALIGN',(1,0),(2,-1),'RIGHT'),('FONTNAME',(0,0),(-1,-1),'Helvetica'),('FONTSIZE',(0,0),(-1,-1),10),
      ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
      ('LINEABOVE',(1,2),(2,2),1,GRIS),('FONTNAME',(1,2),(2,2),'Helvetica-Bold'),
      ('TEXTCOLOR',(1,2),(2,2),VERT),('FONTSIZE',(1,2),(2,2),12)]
if montant_paye > 0:
    ts += [('FONTNAME',(1,4),(2,4),'Helvetica-Bold'),('TEXTCOLOR',(1,4),(2,4),colors.HexColor('#FF5C6B'))]
t_tot.setStyle(TableStyle(ts))
story.append(t_tot)

if facture.get('notes') or facture.get('conditions_paiement'):
    story.append(Spacer(1, 0.8*cm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#E2E8F0')))
    story.append(Spacer(1, 0.3*cm))
    if facture.get('conditions_paiement'):
        story.append(Paragraph(f"<b>Conditions :</b> {facture['conditions_paiement']}", sous_style))
    if facture.get('notes'):
        story.append(Paragraph(f"<b>Notes :</b> {facture['notes']}", sous_style))

story.append(Spacer(1, 1.2*cm))
story.append(HRFlowable(width='100%', thickness=0.5, color=VERT))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(f"<i>Document g\u00e9n\u00e9r\u00e9 par ComptaWest \u2014 {entreprise}</i>",
    ParagraphStyle('footer',fontSize=8,textColor=GRIS,alignment=TA_CENTER)))

doc.build(story)
print("OK")
`;

    fs.writeFileSync(scriptFile, pythonScript);

    // SÉCURISÉ : execFileSync avec tableau d'arguments (pas d'injection shell)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    execFileSync(pythonCmd, [scriptFile, dataFile, outFile], { timeout: 30000 });

    if (!fs.existsSync(outFile)) {
      return res.status(500).json({ success: false, message: 'Erreur génération PDF' });
    }

    const pdfBuffer = fs.readFileSync(outFile);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${facture.numero}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erreur PDF:', err.message);
    const pyErr = err.stderr ? err.stderr.toString().slice(0, 300) : '';
    res.status(500).json({
      success: false,
      message: 'Erreur génération PDF',
      detail: process.env.NODE_ENV !== 'production' ? pyErr : undefined,
    });
  } finally {
    // Nettoyage systématique des fichiers temporaires
    [dataFile, outFile, scriptFile].forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    });
  }
};

module.exports = { getBilan, getFacturePDF };
