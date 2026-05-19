import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Modal, Input, StatutBadge } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import Onboarding from '../components/Onboarding.jsx';
import { Can, ReadOnlyBanner } from '../components/Can.jsx';
import { Plus, AlertTriangle, CheckCircle, Clock, Calculator } from 'lucide-react';

// Couleurs des types de taxe ; les libellés sont résolus via t('taxes.type_*') au rendu.
const TYPE_COLORS = {
  TVA:     '#00D4AA',
  IS:      '#4E8BF5',
  BIC:     '#4E8BF5',
  CNSS:    '#A855F7',
  CMU:     '#EC4899',
  IRVM:    '#F97316',
  Patente: '#84CC16',
  Autre:   '#6B7A99',
};

const TAUX_DEFAUTS = { TVA: 18, IS: 25, BIC: 20, CNSS: 14, CMU: 3.5, IRVM: 15, Patente: 0.5 };
const ORGANISMES   = { TVA: 'DGI', IS: 'DGI', BIC: 'DGI', CNSS: 'CNSS', CMU: 'CNSS', IRVM: 'DGI', Patente: 'DGI', Autre: '' };

export default function TaxesPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  // Helper pour récupérer la config d'un type de taxe avec libellé i18n
  const typeCfg = (code) => ({
    color: TYPE_COLORS[code] || '#6B7A99',
    label: t(`taxes.type_${code.toLowerCase()}`, { defaultValue: code }),
  });

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
    } catch { toast.error(t('taxes.error_load')); }
    finally { setLoading(false); }
  }, [filtreStatut, filtreType, annee, page, t]);

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
      toast.success(t('taxes.success_created'));
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || t('common.error_generic')); }
    finally { setSaving(false); }
  };

  const handlePaiement = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/taxes/${showPaiement.id}/paiement`, paiementForm);
      toast.success(t('taxes.success_paid'));
      setShowPaiement(null); fetchData();
    } catch { toast.error(t('factures.error_paiement')); }
    finally { setSaving(false); }
  };

  const calculerTVA = async () => {
    try {
      const res = await api.get(`/taxes/calculer-tva?periode_debut=${tvaForm.periode_debut}&periode_fin=${tvaForm.periode_fin}`);
      setTvaCalc(res.data.data);
    } catch { toast.error(t('common.error_generic')); }
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
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{t('taxes.title')}</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{t('taxes.subtitle')} — {annee}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.purple} />
          <button data-onboarding="btn-calc-tva" onClick={() => setShowTvaCalc(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10,
            border: `1.5px solid ${C.accent}50`, background: `${C.accent}12`,
            color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Calculator size={14} /> {t('taxes.calc_tva_button')}
          </button>
          <Can module="taxes" action="create">
            <button data-onboarding="btn-nouveau" onClick={() => setShowModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10,
              border: 'none', background: C.purple, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              <Plus size={15} /> {t('taxes.new_declaration')}
            </button>
          </Can>
        </div>
      </div>

      <ReadOnlyBanner module="taxes" />

      {/* KPIs fiscaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('taxes.col_amount_due'),    val: formatFCFA(s.a_payer, true),       sub: t('common.remaining'),                                  color: C.gold,   icon: Clock },
          { label: t('taxes.overdue'),           val: formatFCFA(s.en_retard, true),     sub: `${s.nb_en_retard || 0} ${t('taxes.tab_declarations').toLowerCase()}`, color: C.red, icon: AlertTriangle },
          { label: t('taxes.calc_tva_collected'), val: formatFCFA(s.tva_collectee, true), sub: t('factures.title').toLowerCase(),                      color: C.accent, icon: CheckCircle },
          { label: t('taxes.calc_tva_net'),       val: formatFCFA(s.tva_nette > 0 ? s.tva_nette : 0, true),
            sub: s.tva_nette < 0 ? `${t('common.encours')}: ${formatFCFA(Math.abs(s.tva_nette), true)}` : 'DGI',
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
              {val} <span style={{ fontSize: 10, color: C.muted }}>{t('common.currency')}</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Répartition par type */}
      {tdb?.par_type?.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, marginBottom: 22, boxShadow: C.shadow }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: C.text }}>{t('rapports.fiscal_title', { year: annee })}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {tdb.par_type.map((row, i) => {
              const cfg = typeCfg(row.type_taxe);
              return (
                <div key={i} style={{
                  background: dark ? '#161F2E' : C.cardAlt, borderRadius: 12,
                  padding: '14px 16px', border: `1px solid ${cfg.color}30`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: 10, color: C.muted }}>{row.organisme}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{formatFCFA(row.total_du, true)} {t('common.currency')}</div>
                  <div style={{ height: 3, background: C.hover, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: row.total_du > 0 ? `${Math.min((row.total_paye / row.total_du) * 100, 100)}%` : '0%', height: '100%', background: cfg.color, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{t('rapports.fiscal_paid', { amount: formatFCFA(row.total_paye, true) })}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prochaines échéances — n'a de sens qu'en consultation de
          l'année courante : si l'utilisateur navigue sur un exercice
          antérieur ou postérieur, la bannière « À venir 30 j » serait
          trompeuse (l'info reste toujours datée d'aujourd'hui). */}
      {String(annee) === String(new Date().getFullYear()) && tdb?.prochaines_echeances?.length > 0 && (
        <div style={{
          background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 12,
          padding: '14px 18px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <AlertTriangle size={15} color={C.gold} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: C.gold, fontWeight: 600 }}>{t('taxes.upcoming')} (30 j) :</span>
          {tdb.prochaines_echeances.map((row, i) => (
            <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: `${C.gold}20`, color: C.gold }}>
              {row.type_taxe} · {formatDate(row.date_echeance)} · {formatFCFA(row.montant_du - row.montant_paye, true)} {t('common.currency')}
            </span>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { v: '',          label: t('common.all') },
          { v: 'a_payer',   label: t('statut.a_payer') },
          { v: 'en_retard', label: t('statut.en_retard') },
          { v: 'payee',     label: t('statut.payee') },
        ].map(({ v, label }) => (
          <button key={v} onClick={() => { setFiltreStatut(v); setPage(1); }} style={{
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${filtreStatut === v ? C.purple : C.border}`,
            background: filtreStatut === v ? `${C.purple}15` : 'transparent',
            color: filtreStatut === v ? C.purple : C.muted, transition: 'all 0.15s',
          }}>{label}</button>
        ))}
        <select value={filtreType} onChange={e => { setFiltreType(e.target.value); setPage(1); }}
          style={{ ...selectStyle, width: 'auto' }}>
          <option value="">{t('common.all')}</option>
          {Object.keys(TYPE_COLORS).map(k => <option key={k} value={k}>{typeCfg(k).label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div data-onboarding="liste-taxes" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {[
                t('taxes.col_type'),
                t('taxes.field_organisation'),
                t('taxes.col_period'),
                t('taxes.col_due_date'),
                t('taxes.col_base'),
                t('taxes.col_amount_due'),
                t('taxes.col_amount_paid'),
                t('taxes.col_status'),
                t('common.actions'),
              ].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('common.loading')}</td></tr>
            ) : taxes.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>{t('taxes.tab_declarations')} : {t('common.no_data')}</td></tr>
            ) : taxes.map(tax => {
              const tc = typeCfg(tax.type_taxe);
              const reste = parseFloat(tax.montant_du) - parseFloat(tax.montant_paye);
              return (
                <tr key={tax.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: `${tc.color}20`, color: tc.color }}>{tc.label}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: C.text }}>{tax.organisme}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: C.sub }}>{formatDate(tax.periode_debut)} → {formatDate(tax.periode_fin)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: tax.statut === 'en_retard' ? C.red : C.muted, fontWeight: tax.statut === 'en_retard' ? 700 : 400 }}>
                    {formatDate(tax.date_echeance)}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{formatFCFA(tax.montant_base, true)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{formatFCFA(tax.montant_du)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', color: parseFloat(tax.montant_paye) > 0 ? C.accent : C.muted }}>
                    {parseFloat(tax.montant_paye) > 0 ? formatFCFA(tax.montant_paye) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatutBadge statut={tax.statut} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {['a_payer','en_retard'].includes(tax.statut) && (
                      <button onClick={() => { setShowPaiement(tax); setPaiementForm(p => ({ ...p, montant_paye: reste.toFixed(0) })); }}
                        style={{
                          padding: '6px 12px', background: `${C.accent}15`, border: `1.5px solid ${C.accent}50`,
                          borderRadius: 7, cursor: 'pointer', color: C.accent, fontSize: 11, fontWeight: 600,
                        }}>
                        {t('taxes.pay_button')}
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
        <Modal title={t('taxes.new_declaration')} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>{t('taxes.col_type')} *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.keys(TYPE_COLORS).map(k => {
                  const v = typeCfg(k);
                  return (
                    <button key={k} type="button" onClick={() => handleTypeChange(k)} style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: `1.5px solid ${form.type_taxe === k ? v.color : C.border}`,
                      background: form.type_taxe === k ? `${v.color}18` : 'transparent',
                      color: form.type_taxe === k ? v.color : C.muted,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    }}>{v.label}</button>
                  );
                })}
              </div>
            </div>
            <Input label={t('taxes.field_organisation')} value={form.organisme} onChange={set('organisme')} placeholder="DGI, CNSS..." required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('taxes.field_period_start')} type="date" value={form.periode_debut} onChange={set('periode_debut')} required />
              <Input label={t('taxes.field_period_end')} type="date" value={form.periode_fin} onChange={set('periode_fin')} required />
            </div>
            <Input label={t('taxes.field_due_date')} type="date" value={form.date_echeance} onChange={set('date_echeance')} required />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Input label={t('taxes.field_amount_base')} type="number" value={form.montant_base} onChange={set('montant_base')} required />
              <Input label={t('taxes.field_rate')} type="number" value={form.taux} onChange={set('taux')} placeholder="18" />
            </div>
            {parseFloat(form.montant_base) > 0 && (
              <div style={{ background: dark ? '#0D1525' : C.cardAlt, borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.muted }}>{t('taxes.col_amount_due')} :</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.purple, fontFamily: 'monospace' }}>{formatFCFA(montantDu)} {t('common.currency')}</span>
              </div>
            )}
            <Input label={t('common.notes')} value={form.notes} onChange={set('notes')} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setShowModal(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
                background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{t('common.cancel')}</button>
              <button type="submit" disabled={saving} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: saving ? C.border : C.purple, color: saving ? C.muted : '#fff',
                fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? t('common.saving') : t('taxes.create_button')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal paiement */}
      {showPaiement && (
        <Modal title={`${t('taxes.pay_modal_title')} — ${typeCfg(showPaiement.type_taxe).label} (${showPaiement.organisme})`} onClose={() => setShowPaiement(null)} width={400}>
          <div style={{ background: dark ? '#0D1525' : C.cardAlt, borderRadius: 10, padding: '12px 14px', marginBottom: 18, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('factures.paiement_remaining')}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, fontFamily: 'monospace' }}>
              {formatFCFA(parseFloat(showPaiement.montant_du) - parseFloat(showPaiement.montant_paye))} {t('common.currency')}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t('common.due_date')} : {formatDate(showPaiement.date_echeance)}</div>
          </div>
          <form onSubmit={handlePaiement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label={t('taxes.pay_amount')} type="number" value={paiementForm.montant_paye} onChange={e => setPaiementForm(p => ({ ...p, montant_paye: e.target.value }))} required />
            <Input label={t('taxes.pay_date')} type="date" value={paiementForm.date_paiement} onChange={e => setPaiementForm(p => ({ ...p, date_paiement: e.target.value }))} required />
            <Input label={t('taxes.pay_reference')} value={paiementForm.reference_paiement} onChange={e => setPaiementForm(p => ({ ...p, reference_paiement: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setShowPaiement(null)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: `1.5px solid ${C.border}`,
                background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{t('common.cancel')}</button>
              <button type="submit" disabled={saving} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: saving ? C.border : C.accent, color: saving ? C.muted : (dark ? '#000' : '#fff'),
                fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? '...' : t('factures.paiement_confirm')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal calcul TVA */}
      {showTvaCalc && (
        <Modal title={t('taxes.tab_calc_tva')} onClose={() => { setShowTvaCalc(false); setTvaCalc(null); }} width={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label={t('taxes.field_period_start')} type="date" value={tvaForm.periode_debut} onChange={e => setTvaForm(f => ({ ...f, periode_debut: e.target.value }))} />
              <Input label={t('taxes.field_period_end')} type="date" value={tvaForm.periode_fin} onChange={e => setTvaForm(f => ({ ...f, periode_fin: e.target.value }))} />
            </div>
            <button onClick={calculerTVA} style={{
              padding: '11px 0', borderRadius: 10, border: 'none',
              background: C.accent, color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{t('taxes.calc_tva_button')}</button>
            {tvaCalc && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: t('taxes.calc_tva_collected'),  val: tvaCalc.tva_collectee, color: C.accent },
                  { label: t('taxes.calc_tva_deductible'), val: tvaCalc.tva_deductible, color: C.blue },
                  { label: tvaCalc.tva_nette >= 0 ? t('taxes.calc_tva_net') : t('common.encours'), val: Math.abs(tvaCalc.tva_nette), color: tvaCalc.tva_nette >= 0 ? C.red : C.gold },
                ].map(({ label, val, color }, i) => (
                  <div key={i} style={{
                    background: dark ? '#0D1525' : C.cardAlt, borderRadius: 10, padding: '12px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: i === 2 ? `1.5px solid ${color}40` : `1px solid ${C.border}`,
                  }}>
                    <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
                    <span style={{ fontSize: i === 2 ? 16 : 13, fontWeight: i === 2 ? 800 : 700, color, fontFamily: 'monospace' }}>
                      {formatFCFA(val)} {t('common.currency')}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
                  {t('common.period')} : {formatDate(tvaCalc.periode.debut)} → {formatDate(tvaCalc.periode.fin)}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <Onboarding pageKey="taxes" />
    </div>
  );
}
