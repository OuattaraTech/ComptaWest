import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Metric, CustomTooltip } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import Onboarding from '../components/Onboarding.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, Calculator, Download } from 'lucide-react';

const MOIS_NOMS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MOIS_NOMS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function RapportsPage() {
  const { t, i18n } = useTranslation();
  const { actuelle } = useEntreprise();
  const { dark } = useTheme();
  const C = getC(dark);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const downloadPDF = async () => {
    setExporting(true);
    const toastId = toast.loading(t('rapports.export_loading'));
    try {
      const res = await api.get(`/rapports/bilan/pdf?annee=${annee}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bilan_${annee}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.dismiss(toastId);
      toast.success(t('rapports.exported', { year: annee }));
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.response?.data?.message || t('rapports.error_export'));
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!actuelle) return;
    setLoading(true);
    api.get(`/rapports/bilan?annee=${annee}`)
      .then(r => setBilan(r.data.data))
      .catch(() => toast.error(t('rapports.error_load')))
      .finally(() => setLoading(false));
  }, [annee, actuelle?.id, t]);

  // Choix des libellés de mois selon la langue active
  const moisNoms = i18n.language?.startsWith('en') ? MOIS_NOMS_EN : MOIS_NOMS_FR;

  const evolutionData = bilan ? moisNoms.map((nom, i) => {
    const row = bilan.recettes_par_mois.find(r => parseInt(r.mois) === i + 1);
    return { mois: nom, recettes: parseFloat(row?.total || 0), encaisse: parseFloat(row?.encaisse || 0) };
  }) : [];

  const chargesData = bilan?.depenses_par_categorie?.filter(d => parseFloat(d.total) > 0).map(d => ({
    name: d.categorie, value: parseFloat(d.total), color: d.couleur || '#6B7A99',
  })) || [];

  const totaux = bilan?.totaux || {};

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>{t('rapports.title')}</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {bilan?.entreprise || actuelle?.nom} · {bilan?.regime_fiscal} · {annee}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div data-onboarding="periode-selector">
            <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.accent} />
          </div>
          <button data-onboarding="btn-export" onClick={downloadPDF} disabled={exporting || loading || !bilan} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: (exporting || loading || !bilan) ? C.border : C.accent,
            color: (exporting || loading || !bilan) ? C.muted : (dark ? '#000' : '#fff'),
            fontSize: 13, fontWeight: 700,
            cursor: (exporting || loading || !bilan) ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}>
            <Download size={15} /> {exporting ? t('rapports.export_running') : t('rapports.export_pdf')}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>{t('common.loading')}</div>
      ) : (
        <>
          <div data-onboarding="metriques" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
            <Metric label={t('rapports.metric_revenues_ht')} value={`${formatFCFA(totaux.recettes, true)} ${t('common.currency')}`} sub={t('rapports.metric_revenues_sub')} icon={TrendingUp} color={C.accent} />
            <Metric label={t('rapports.metric_expenses')}    value={`${formatFCFA(totaux.depenses, true)} ${t('common.currency')}`} sub={t('rapports.metric_expenses_sub')} icon={TrendingDown} color={C.red} />
            <Metric label={t('rapports.metric_taxes_paid')}  value={`${formatFCFA(totaux.taxes_payees, true)} ${t('common.currency')}`} sub={t('rapports.metric_taxes_sub')} icon={Calculator} color={C.purple} />
            <Metric label={t('rapports.metric_result')}      value={`${formatFCFA(totaux.resultat_net, true)} ${t('common.currency')}`} sub={t('rapports.metric_result_sub')} icon={DollarSign} color={C.gold} />
            <Metric label={t('rapports.metric_margin')}      value={`${totaux.marge}%`} sub={t('rapports.metric_margin_sub')} icon={Percent} color={C.blue} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>{t('rapports.chart_monthly_title', { year: annee })}</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>{t('rapports.chart_monthly_sub')}</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={evolutionData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="mois" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => formatFCFA(v, true)} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="recettes" name={t('rapports.chart_legend_billed')} fill={C.accent} radius={[5,5,0,0]} opacity={0.8} />
                  <Bar dataKey="encaisse" name={t('rapports.chart_legend_collected')} fill={C.blue} radius={[5,5,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>{t('rapports.chart_charges_title', { year: annee })}</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{t('rapports.chart_charges_sub')}</div>
              {chargesData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={chargesData} cx="50%" cy="50%" outerRadius={65} dataKey="value" stroke="none">
                        {chargesData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={v => `${formatFCFA(v)} ${t('common.currency')}`} contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {chargesData.slice(0, 5).map((c, i) => {
                      const pct = totaux.depenses > 0 ? ((c.value / totaux.depenses) * 100).toFixed(0) : 0;
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />
                            <span style={{ fontSize: 11, color: C.sub }}>{c.name}</span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: c.color }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 12 }}>{t('rapports.chart_charges_empty')}</div>
              )}
            </div>
          </div>

          {/* Tableau mensuel */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 24, boxShadow: C.shadow }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, background: dark ? 'transparent' : C.cardAlt }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t('rapports.monthly_title', { year: annee })}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: dark ? '#0D1220' : C.cardAlt }}>
                  {[
                    t('rapports.monthly_col_month'),
                    t('rapports.monthly_col_revenue'),
                    t('rapports.monthly_col_collected'),
                    t('rapports.monthly_col_collection_rate'),
                  ].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evolutionData.map((m, i) => {
                  const taux = m.recettes > 0 ? ((m.encaisse / m.recettes) * 100).toFixed(0) : 0;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = C.hover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: C.text }}>{m.mois} {annee}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', color: m.recettes > 0 ? C.accent : C.muted }}>
                        {m.recettes > 0 ? `${formatFCFA(m.recettes)} ${t('common.currency')}` : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', color: m.encaisse > 0 ? C.text : C.muted }}>
                        {m.encaisse > 0 ? `${formatFCFA(m.encaisse)} ${t('common.currency')}` : '—'}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        {m.recettes > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ height: 5, width: 80, background: C.hover, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(taux, 100)}%`, height: '100%', background: parseInt(taux) >= 100 ? C.accent : C.gold, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: parseInt(taux) >= 100 ? C.accent : C.gold }}>{taux}%</span>
                          </div>
                        ) : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: dark ? '#0D1220' : C.cardAlt, borderTop: `2px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 800, color: C.text }}>{t('rapports.monthly_total', { year: annee })}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 800, color: C.accent }}>{formatFCFA(totaux.recettes)} {t('common.currency')}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 800, color: C.text }}>
                    {formatFCFA(evolutionData.reduce((s, m) => s + m.encaisse, 0))} {t('common.currency')}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Synthèse taxes */}
          {bilan?.taxes?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: C.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.text }}>{t('rapports.fiscal_title', { year: annee })}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {bilan.taxes.map((tax, i) => (
                  <div key={i} style={{ background: dark ? '#161F2E' : C.cardAlt, borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.purple}30` }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.purple, marginBottom: 6 }}>{tax.type_taxe}</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{formatFCFA(tax.total_du, true)} {t('common.currency')}</div>
                    <div style={{ fontSize: 10, color: C.accent, marginTop: 4 }}>{t('rapports.fiscal_paid', { amount: formatFCFA(tax.total_paye, true) })}</div>
                    <div style={{ height: 3, background: C.hover, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((tax.total_paye / tax.total_du) * 100, 100)}%`, height: '100%', background: C.purple, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Résultat final */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.text }}>{t('rapports.result_title', { year: annee })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: t('rapports.result_total_revenue'),  val: totaux.recettes,    color: C.accent },
                { label: t('rapports.result_total_expenses'), val: totaux.depenses,    color: C.red },
                { label: t('rapports.result_taxes_paid'),     val: totaux.taxes_payees, color: C.purple },
                { label: t('rapports.result_net'),            val: totaux.resultat_net, color: parseFloat(totaux.resultat_net) >= 0 ? C.gold : C.red },
              ].map((item, i) => (
                <div key={i} style={{ background: dark ? '#161F2E' : C.cardAlt, borderRadius: 12, padding: '16px 18px', border: `1px solid ${item.color}30` }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>
                    {formatFCFA(item.val)} <span style={{ fontSize: 10, fontWeight: 400, color: C.muted }}>{t('common.currency')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Onboarding pageKey="rapports" />
    </div>
  );
}
