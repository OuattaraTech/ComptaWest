import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal, Input, StatutBadge } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import { Plus, AlertTriangle, CheckCircle, Clock, Calculator } from 'lucide-react';

const STATUT_CFG = {
  a_payer:   { label: 'À payer',   bg: '#F5A62322', color: '#F5A623', border: '#F5A62350' },
  payee:     { label: 'Payée',     bg: '#00D4AA22', color: '#00A882', border: '#00D4AA50' },
  en_retard: { label: 'En retard', bg: '#FF5C6B22', color: '#C01833', border: '#FF5C6B50' },
  annulee:   { label: 'Annulée',   bg: '#6B7A9922', color: '#6B7A99', border: '#6B7A9950' },
  exoneree:  { label: 'Exonérée',  bg: '#4E8BF522', color: '#1A52B0', border: '#4E8BF550' },
};

const TYPE_CFG = {
  TVA:     { color: '#00D4AA', label: 'TVA',     desc: 'Taxe sur la Valeur Ajoutée' },
  IS:      { color: '#4E8BF5', label: 'IS',      desc: "Impôt sur les Sociétés" },
  BIC:     { color: '#4E8BF5', label: 'BIC',     desc: 'Bénéfices Industriels et Commerciaux' },
  CNSS:    { color: '#A855F7', label: 'CNSS',    desc: 'Cotisations Sociales' },
  CMU:     { color: '#EC4899', label: 'CMU',     desc: 'Couverture Maladie Universelle' },
  IRVM:    { color: '#F97316', label: 'IRVM',    desc: 'Impôt sur le Revenu des Valeurs Mobilières' },
  Patente: { color: '#84CC16', label: 'Patente', desc: 'Contribution des Patentes' },
  Autre:   { color: '#6B7A99', label: 'Autre',   desc: 'Autre taxe ou contribution' },
};

const TAUX_DEFAUTS = { TVA: 18, IS: 25, BIC: 20, CNSS: 14, CMU: 3.5, IRVM: 15, Patente: 0.5 };
const ORGANISMES   = { TVA: 'DGI', IS: 'DGI', BIC: 'DGI', CNSS: 'CNSS', CMU: 'CNSS', IRVM: 'DGI', Patente: 'DGI', Autre: '' };

export default function TaxesPage() {
  const { dark } = useTheme();
  const C = getC(dark);

  const [taxes, setTaxes] = useState([]);
  const [tdb, setTdb] = useState(null);
  const [tvaCalc, setTvaCalc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [showPaiement, setShowPaiement] = useState(null);
  const [showTvaCalc, setShowTvaCalc] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type_taxe: 'TVA', organisme: 'DGI', periode_debut: '',
    periode_fin: '', date_echeance: '', montant_base: '', taux: 18, notes: '',
  });
  const [paiementForm, setPaiementForm] = useState({
    montant_paye: '', date_paiement: new Date().toISOString().split('T')[0], reference_paiement: '',
  });
  const [tvaForm, setTvaForm] = useState({
    periode_debut: `${new Date().getFullYear()}-01-01`,
    periode_fin:   `${new Date().getFullYear()}-12-31`,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, tdbRes] = await Promise.all([
        api.get(`/taxes?statut=${filtreStatut}&type_taxe=${filtreType}&annee=${annee}&page=${page}&limit=15`),
        api.get(`/taxes/tableau-de-bord?annee=${annee}`),
      ]);
      setTaxes(tRes.data.data);
      setPagination(tRes.data.pagination);
      setTdb(tdbRes.data.data);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [filtreStatut, filtreType, annee, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const montantDu = (parseFloat(form.montant_base) || 0) * (parseFloat(form.taux) || 0) / 100;

  const handleTypeChange = (type) => {
    setForm(f => ({ ...f, type_taxe: type, taux: TAUX_DEFAUTS[type] || 0, organisme: ORGANISMES[type] || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/taxes', { ...form, montant_du: montantDu });
      toast.success('Déclaration créée');
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handlePaiement = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/taxes/${showPaiement.id}/paiement`, paiementForm);
      toast.success('Paiement enregistré');
      setShowPaiement(null); fetchData();
    } catch { toast.error('Erreur paiement'); }
    finally { setSaving(false); }
  };

  const calculerTVA = async () => {
    try {
      const res = await api.get(`/taxes/calculer-tva?periode_debut=${tvaForm.periode_debut}&periode_fin=${tvaForm.periode_fin}`);
      setTvaCalc(res.data.data);
    } catch { toast.error('Erreur calcul TVA'); }
  };

  const s = tdb?.synthese || {};

  const selectStyle = {
    background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
    padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer', width: '100%',
  };

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Taxes & Impôts</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>DGI · CNSS · Déclarations fiscales — {annee}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.purple} />
          <button onClick={() => setShowTvaCalc(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10,
            border: `1.5px solid ${C.accent}50`, background: `${C.accent}12`,
            color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Calculator size={14} /> Calculer TVA
          </button>
          <button onClick={() => setShowModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10,
            border: 'none', background: C.purple, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            <Plus size={15} /> Nouvelle déclaration
          </button>
        </div>
      </div>

      {/* KPIs fiscaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total à payer', val: formatFCFA(s.a_payer, true), sub: 'FCFA restants',       color: C.gold,   icon: Clock },
          { label: 'En retard',     val: formatFCFA(s.en_retard, true), sub: `${s.nb_en_retard || 0} déclaration(s)`, color: C.red, icon: AlertTriangle },
          { label: 'TVA collectée', val: formatFCFA(s.tva_collectee, true), sub: 'sur factures',   color: C.accent, icon: CheckCircle },
          { label: 'TVA nette',     val: formatFCFA(s.tva_nette > 0 ? s.tva_nette : 0, true),
            sub: s.tva_nette < 0 ? `Crédit: ${formatFCFA(Math.abs(s.tva_nette), true)}` : 'À verser DGI',
            color: C.blue, icon: Calculator },
        ].map(({ label, val, sub, color, icon: Icon }, i) => (
          <div key={i} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: '18px 20px', position: 'relative', overflow: 'hidden',
            boxShadow: C.shadow, transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0, width: 55, height: 55,
              background: `radial-gradient(circle at top right, ${color}25, transparent 70%)`,
              borderRadius: '0 14px 0 55px',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
              <Icon size={15} color={color} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
              {val} <span style={{ fontSize: 10, color: C.muted }}>FCFA</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Répartition par type */}
      {tdb?.par_type?.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, marginBottom: 22, boxShadow: C.shadow }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: C.text }}>Répartition par type — {annee}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {tdb.par_type.map((t, i) => {
              const cfg = TYPE_CFG[t.type_taxe] || TYPE_CFG.Autre;
              return (
                <div key={i} style={{
                  background: dark ? '#161F2E' : C.cardAlt, borderRadius: 12,
                  padding: '14px 16px', border: `1px solid ${cfg.color}30`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: 10, color: C.muted }}>{t.organisme}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{cfg.desc}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{formatFCFA(t.total_du, true)} FCFA</div>
                  <div style={{ height: 3, background: C.hover, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: t.total_du > 0 ? `${Math.min((t.total_paye / t.total_du) * 100, 100)}%` : '0%', height: '100%', background: cfg.color, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Payé: {formatFCFA(t.total_paye, true)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prochaines échéances */}
      {tdb?.prochaines_echeances?.length > 0 && (
        <div style={{
          background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 12,
          padding: '14px 18px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <AlertTriangle size={15} color={C.gold} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: C.gold, fontWeight: 600 }}>Échéances dans 30 jours :</span>
          {tdb.prochaines_echeances.map((t, i) => (
            <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: `${C.gold}20`, color: C.gold }}>
              {t.type_taxe} · {formatDate(t.date_echeance)} · {formatFCFA(t.montant_du - t.montant_paye, true)} FCFA
            </span>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['','a_payer','en_retard','payee'].map(f => (
          <button key={f} onClick={() => { setFiltreStatut(f); setPage(1); }} style={{
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${filtreStatut === f ? C.purple : C.border}`,
            background: filtreStatut === f ? `${C.purple}15` : 'transparent',
            color: filtreStatut === f ? C.purple : C.muted, transition: 'all 0.15s',
          }}>{{ '': 'Tous', a_payer: 'À payer', en_retard: 'En retard', payee: 'Payées' }[f]}</button>
        ))}
        <select value={filtreType} onChange={e => { setFiltreType(e.target.value); setPage(1); }}
          style={{ ...selectStyle, width: 'auto' }}>
          <option value="">Tous les types</option>
          {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {['Type','Organisme','Période','Échéance','Base','Montant dû','Payé','Statut','Action'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement...</td></tr>
            ) : taxes.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucune déclaration trouvée</td></tr>
            ) : taxes.map(t => {
              const sc = STATUT_CFG[t.statut] || STATUT_CFG.a_payer;
              const tc = TYPE_CFG[t.type_taxe] || TYPE_CFG.Autre;
              const reste = parseFloat(t.montant_du) - parseFloat(t.montant_paye);
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: `${tc.color}20`, color: tc.color }}>{tc.label}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: C.text }}>{t.organisme}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.sub }}>{formatDate(t.periode_debut)} → {formatDate(t.periode_fin)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: t.statut === 'en_retard' ? C.red : C.muted, fontWeight: t.statut === 'en_retard' ? 700 : 400 }}>
                    {formatDate(t.date_echeance)}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{formatFCFA(t.montant_base, true)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{formatFCFA(t.montant_du)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', color: parseFloat(t.montant_paye) > 0 ? C.accent : C.muted }}>
                    {parseFloat(t.montant_paye) > 0 ? formatFCFA(t.montant_paye) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {['a_payer','en_retard'].includes(t.statut) && (
                      <button onClick={() => { setShowPaiement(t); setPaiementForm(p => ({ ...p, montant_paye: reste.toFixed(0) })); }}
                        style={{
                          padding: '6px 12px', background: `${C.accent}15`, border: `1.5px solid ${C.accent}50`,
                          borderRadius: 7, cursor: 'pointer', color: C.accent, fontSize: 11, fontWeight: 600,
                        }}>
                        Payer
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pagination.pages > 1 && (
          <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 5, justifyContent: 'flex-end', background: dark ? 'transparent' : C.cardAlt }}>
            {[...Array(Math.min(pagination.pages, 8))].map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} style={{
                width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${page === i + 1 ? C.purple : C.border}`,
                background: page === i + 1 ? `${C.purple}15` : 'transparent',
                color: page === i + 1 ? C.purple : C.muted,
              }}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>

      {/* Modal nouvelle déclaration */}
      {showModal && (
        <Modal title="Nouvelle déclaration fiscale" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Type de taxe *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(TYPE_CFG).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => handleTypeChange(k)} style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: `1.5px solid ${form.type_taxe === k ? v.color : C.border}`,
                    background: form.type_taxe === k ? `${v.color}18` : 'transparent',
                    color: form.type_taxe === k ? v.color : C.muted,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{v.label}</button>
                ))}
              </div>
              {form.type_taxe && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{TYPE_CFG[form.type_taxe]?.desc}</div>}
            </div>
            <Input label="Organisme" value={form.organisme} onChange={set('organisme')} placeholder="DGI, CNSS..." required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Période début" type="date" value={form.periode_debut} onChange={set('periode_debut')} required />
              <Input label="Période fin" type="date" value={form.periode_fin} onChange={set('periode_fin')} required />
            </div>
            <Input label="Date d'échéance" type="date" value={form.date_echeance} onChange={set('date_echeance')} required />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Input label="Montant base (FCFA)" type="number" value={form.montant_base} onChange={set('montant_base')} placeholder="Ex: 10000000" required />
              <Input label="Taux (%)" type="number" value={form.taux} onChange={set('taux')} placeholder="18" />
            </div>
            {parseFloat(form.montant_base) > 0 && (
              <div style={{ background: dark ? '#0D1525' : C.cardAlt, borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.muted }}>Montant dû :</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.purple, fontFamily: 'monospace' }}>{formatFCFA(montantDu)} FCFA</span>
              </div>
            )}
            <Input label="Notes" value={form.notes} onChange={set('notes')} placeholder="Références, observations..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setShowModal(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
                background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Annuler</button>
              <button type="submit" disabled={saving} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: saving ? C.border : C.purple, color: saving ? C.muted : '#fff',
                fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Enregistrement...' : 'Créer la déclaration'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal paiement */}
      {showPaiement && (
        <Modal title={`Payer — ${showPaiement.type_taxe} (${showPaiement.organisme})`} onClose={() => setShowPaiement(null)} width={400}>
          <div style={{ background: dark ? '#0D1525' : C.cardAlt, borderRadius: 10, padding: '12px 14px', marginBottom: 18, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reste à payer</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, fontFamily: 'monospace' }}>
              {formatFCFA(parseFloat(showPaiement.montant_du) - parseFloat(showPaiement.montant_paye))} FCFA
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Échéance : {formatDate(showPaiement.date_echeance)}</div>
          </div>
          <form onSubmit={handlePaiement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Montant payé (FCFA)" type="number" value={paiementForm.montant_paye} onChange={e => setPaiementForm(p => ({ ...p, montant_paye: e.target.value }))} required />
            <Input label="Date de paiement" type="date" value={paiementForm.date_paiement} onChange={e => setPaiementForm(p => ({ ...p, date_paiement: e.target.value }))} required />
            <Input label="Référence / Quittance" value={paiementForm.reference_paiement} onChange={e => setPaiementForm(p => ({ ...p, reference_paiement: e.target.value }))} placeholder="N° de quittance DGI..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setShowPaiement(null)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
                background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Annuler</button>
              <button type="submit" disabled={saving} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
                fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? '...' : 'Confirmer le paiement'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal calcul TVA */}
      {showTvaCalc && (
        <Modal title="Calculateur de TVA" onClose={() => { setShowTvaCalc(false); setTvaCalc(null); }} width={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Période début" type="date" value={tvaForm.periode_debut} onChange={e => setTvaForm(f => ({ ...f, periode_debut: e.target.value }))} />
              <Input label="Période fin" type="date" value={tvaForm.periode_fin} onChange={e => setTvaForm(f => ({ ...f, periode_fin: e.target.value }))} />
            </div>
            <button onClick={calculerTVA} style={{
              padding: '11px 0', borderRadius: 10, border: 'none',
              background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Calculer</button>
            {tvaCalc && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'TVA collectée (factures)',  val: tvaCalc.tva_collectee, color: C.accent },
                  { label: 'TVA déductible (dépenses)', val: tvaCalc.tva_deductible, color: C.blue },
                  { label: tvaCalc.tva_nette >= 0 ? 'TVA nette à verser DGI' : 'Crédit de TVA', val: Math.abs(tvaCalc.tva_nette), color: tvaCalc.tva_nette >= 0 ? C.red : C.gold },
                ].map(({ label, val, color }, i) => (
                  <div key={i} style={{
                    background: dark ? '#0D1525' : C.cardAlt, borderRadius: 10, padding: '12px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: i === 2 ? `1.5px solid ${color}40` : `1px solid ${C.border}`,
                  }}>
                    <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
                    <span style={{ fontSize: i === 2 ? 16 : 13, fontWeight: i === 2 ? 800 : 700, color, fontFamily: 'monospace' }}>
                      {formatFCFA(val)} FCFA
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
                  Période : {formatDate(tvaCalc.periode.debut)} → {formatDate(tvaCalc.periode.fin)}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
