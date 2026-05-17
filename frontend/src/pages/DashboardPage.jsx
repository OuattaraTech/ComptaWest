import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { usePermissions } from '../hooks/usePermissions.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import { getC, KpiCard, CustomTooltip, StatutBadge } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import Onboarding from '../components/Onboarding.jsx';
import ScannerFacture from '../components/ScannerFacture.jsx';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, AlertTriangle, DollarSign, Calculator,
  Camera, Smartphone, ShieldCheck, Settings, ArrowRight, Sparkles } from 'lucide-react';

// Salutation selon l'heure locale : renvoie une clé i18n + emoji + clé moment.
// Les libellés sont résolus dans le composant via t().
const getSalutationKeys = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return { greeting: 'greeting_morning',   moment: 'moment_morning',   emoji: '☀️' };
  if (h >= 12 && h < 17) return { greeting: 'greeting_afternoon', moment: 'moment_afternoon', emoji: '🌤️' };
  if (h >= 17 && h < 22) return { greeting: 'greeting_evening',   moment: 'moment_evening',   emoji: '🌆' };
  return                        { greeting: 'greeting_night',     moment: 'moment_night',     emoji: '🌙' };
};

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { actuelle } = useEntreprise();
  const { can } = usePermissions();
  const { dark } = useTheme();
  const C = getC(dark);
  const navigate = useNavigate();

  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!actuelle) return;
    setLoading(true);
    Promise.all([
      api.get(`/dashboard/stats?annee=${annee}`),
      api.get('/dashboard/transactions-recentes?limit=8'),
    ]).then(([s, t]) => {
      setStats(s.data.data);
      setTransactions(t.data.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [annee, actuelle?.id]);

  if (!actuelle) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>🏢</div>
      <div style={{ color: C.muted, fontSize: 14 }}>{t('dashboard.no_company_selected')}</div>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: C.muted, fontSize: 13 }}>
      {t('dashboard.loading')}
    </div>
  );

  const kpis = stats?.kpis || {};
  const evolution = stats?.evolution_mensuelle || [];
  const charges = stats?.repartition_charges || [];
  const topClients = stats?.top_clients || [];

  const salutKeys = getSalutationKeys();
  const prenom = user?.nom?.split(' ')[0];
  // Date locale formatée selon la langue active (fr-FR ou en-US)
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR';
  const dateStr = (() => {
    const d = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return d.charAt(0).toUpperCase() + d.slice(1);
  })();

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>

      {/* Header — accueil */}
      <div data-onboarding="header" style={{
        position: 'relative', overflow: 'hidden',
        background: dark
          ? `linear-gradient(135deg, ${C.card} 0%, ${C.card} 58%, ${C.accent}14 100%)`
          : `linear-gradient(135deg, ${C.card} 0%, ${C.card} 55%, ${C.accent}12 100%)`,
        border: `1px solid ${C.border}`, borderRadius: 18,
        padding: '22px 26px', marginBottom: 24, boxShadow: C.shadow,
      }}>
        {/* halo décoratif */}
        <div style={{
          position: 'absolute', top: -100, right: -50, width: 260, height: 260,
          borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}22, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'relative', zIndex: 1, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: `${C.accent}18`, border: `1px solid ${C.accent}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>{salutKeys.emoji}</div>
            <div>
              <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, margin: 0 }}>
                {t(`dashboard.${salutKeys.greeting}`)}{prenom ? `, ${prenom}` : ''} <span style={{ fontSize: 20 }}>👋</span>
              </h1>
              <p style={{ fontSize: 12.5, color: C.sub, margin: '5px 0 0' }}>
                {dateStr} · <span style={{ color: C.muted }}>{t(`dashboard.${salutKeys.moment}`)}</span>
              </p>
            </div>
          </div>
          <div data-onboarding="annee-selector" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
            <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.accent} />
            <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />
              {actuelle.nom} · {actuelle.regime_fiscal} · {annee}
            </div>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {(kpis.nb_retard > 0 || kpis.total_taxes_dues > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {kpis.nb_retard > 0 && (
            <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}50`, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={15} color={C.red} />
              <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>
                {t(kpis.nb_retard > 1 ? 'dashboard.alert_overdue_other' : 'dashboard.alert_overdue_one', { count: kpis.nb_retard, amount: formatFCFA(kpis.en_retard) })}
              </span>
            </div>
          )}
          {kpis.total_taxes_dues > 0 && (
            <div style={{ background: `${C.purple}15`, border: `1px solid ${C.purple}50`, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calculator size={15} color={C.purple} />
              <span style={{ fontSize: 13, color: C.purple, fontWeight: 600 }}>
                {t('dashboard.alert_taxes_due', { amount: formatFCFA(kpis.total_taxes_dues) })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Raccourcis productifs : accès direct aux fonctionnalités phares
          (scanner OCR, Mobile Money, certification DGI, configuration).
          Chaque carte n'apparaît que si l'utilisateur a la permission. */}
      {(can('depenses', 'create') || can('factures', 'update') || can('entreprise', 'update')) && (
        <div data-onboarding="raccourcis" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12, marginBottom: 22,
        }}>
          {can('depenses', 'create') && (
            <RaccourciCarte
              icon={Camera}
              titre={t('dashboard.shortcut_scan_title')}
              sousTitre={t('dashboard.shortcut_scan_sub')}
              couleur={C.accent} dark={dark} C={C}
              onClick={() => setShowScanner(true)}
            />
          )}
          {can('factures', 'update') && (
            <RaccourciCarte
              icon={Smartphone}
              titre={t('dashboard.shortcut_mobile_money_title')}
              sousTitre={t('dashboard.shortcut_mobile_money_sub')}
              couleur={C.blue} dark={dark} C={C}
              onClick={() => navigate('/factures')}
            />
          )}
          {can('factures', 'update') && (
            <RaccourciCarte
              icon={ShieldCheck}
              titre={t('dashboard.shortcut_fne_title')}
              sousTitre={t('dashboard.shortcut_fne_sub')}
              couleur={C.gold} dark={dark} C={C}
              onClick={() => navigate('/factures')}
            />
          )}
          {can('entreprise', 'update') && (
            <RaccourciCarte
              icon={Settings}
              titre={t('dashboard.shortcut_config_title')}
              sousTitre={t('dashboard.shortcut_config_sub')}
              couleur={C.purple} dark={dark} C={C}
              onClick={() => navigate('/parametres')}
            />
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div data-onboarding="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label={t('dashboard.kpi_revenue')}        value={kpis.ca_total}          sub={t('dashboard.kpi_revenue_sub', { value: kpis.marge })}     icon={TrendingUp}   color={C.accent} />
        <KpiCard label={t('dashboard.kpi_expenses')}       value={kpis.total_depenses}    sub={t('dashboard.kpi_expenses_sub')}                          icon={TrendingDown} color={C.red} />
        <KpiCard label={t('dashboard.kpi_taxes_due')}      value={kpis.total_taxes_dues}  sub={t('dashboard.kpi_taxes_due_sub')}                         icon={Calculator}   color={C.purple} alert={kpis.total_taxes_dues > 0} />
        <KpiCard label={t('dashboard.kpi_profit')}         value={kpis.benefice_net}      sub={t('dashboard.kpi_profit_sub', { count: kpis.nb_factures })} icon={DollarSign}  color={C.gold} />
        <KpiCard label={t('dashboard.kpi_clients_count')}  value={kpis.nb_clients}        sub={t('dashboard.kpi_clients_sub')}                           icon={Users}        color={C.blue} currency={false} />
      </div>

      {/* Graphiques */}
      <div data-onboarding="graphiques" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 22 }}>
        {/* Évolution mensuelle */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>{t('dashboard.chart_evolution_title', { year: annee })}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>{t('dashboard.chart_evolution_sub')}</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evolution}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.gold} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="mois" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => formatFCFA(v, true)} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="recettes" name={t('dashboard.chart_legend_revenue')} stroke={C.accent} fill="url(#gR)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="benefice" name={t('dashboard.chart_legend_profit')} stroke={C.gold} fill="url(#gB)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="depenses" name={t('dashboard.chart_legend_expenses')} stroke={C.red} fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition charges */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>{t('dashboard.chart_charges_title')}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{t('dashboard.chart_charges_sub')}</div>
          {charges.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={charges} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="total" stroke="none">
                    {charges.map((e, i) => <Cell key={i} fill={e.couleur || '#6B7A99'} />)}
                  </Pie>
                  <Tooltip
                    formatter={v => `${formatFCFA(v)} ${t('common.currency')}`}
                    contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {charges.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.couleur || '#6B7A99', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.sub }}>{c.categorie}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: c.couleur || C.muted }}>{c.pourcentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 12 }}>{t('dashboard.chart_charges_empty')}</div>
          )}
        </div>
      </div>

      {/* Transactions + Top clients */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        {/* Transactions */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>{t('dashboard.transactions_title')}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>{t('dashboard.transactions_sub')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[
                  t('dashboard.transactions_col_num'),
                  t('dashboard.transactions_col_party'),
                  t('dashboard.transactions_col_amount'),
                  t('dashboard.transactions_col_date'),
                  t('dashboard.transactions_col_status'),
                ].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}30` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px', fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{t.numero || '—'}</td>
                  <td style={{ padding: '10px', fontSize: 12, fontWeight: 600, color: C.text, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.tiers || '—'}</td>
                  <td style={{ padding: '10px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: t.sens === 'recette' ? C.accent : C.red }}>
                    {t.sens === 'recette' ? '+' : '-'}{formatFCFA(t.total_ttc, true)}
                  </td>
                  <td style={{ padding: '10px', fontSize: 11, color: C.muted }}>{formatDate(t.date_emission)}</td>
                  <td style={{ padding: '10px' }}><StatutBadge statut={t.statut} /></td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: C.muted, fontSize: 12 }}>{t('dashboard.transactions_empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top clients */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>{t('dashboard.top_clients_title')}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>{t('dashboard.top_clients_sub', { year: annee })}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topClients.map((c, i) => {
              const maxCA = topClients[0]?.ca_total || 1;
              const pct = ((c.ca_total / maxCA) * 100).toFixed(0);
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${C.accent}80, ${C.blue}80)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, color: dark ? '#000' : '#fff',
                      }}>{i + 1}</div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{c.nom}</span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{formatFCFA(c.ca_total, true)}</span>
                  </div>
                  <div style={{ height: 4, background: C.hover, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${C.accent}, ${C.blue})`, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
            {topClients.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 12 }}>{t('dashboard.top_clients_empty')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Scanner OCR depuis l'accueil : à validation des champs, on bascule
          sur la page Dépenses qui pré-remplira son formulaire via
          sessionStorage (consommé puis effacé à l'arrivée). */}
      <ScannerFacture
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onExtraction={(data) => {
          sessionStorage.setItem('cw_ocr_prefill', JSON.stringify(data));
          setShowScanner(false);
          navigate('/depenses');
        }}
      />

      <Onboarding pageKey="dashboard" />
    </div>
  );
}

// ─── Carte « Raccourci » — accès rapide aux fonctionnalités phares ───────
// Carte cliquable avec icône colorée, titre, sous-titre et flèche.
// Reste sobre pour ne pas concurrencer visuellement les KPIs.
function RaccourciCarte({ icon: Icon, titre, sousTitre, couleur, dark, C, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', borderRadius: 14,
      background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow,
      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = `${couleur}80`;
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = C.border;
      e.currentTarget.style.transform = 'translateY(0)';
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${couleur}18`, border: `1px solid ${couleur}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={couleur} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{titre}</div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.35 }}>{sousTitre}</div>
      </div>
      <ArrowRight size={14} color={C.muted} style={{ flexShrink: 0 }} />
    </button>
  );
}
