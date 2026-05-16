import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA } from '../utils/helpers.jsx';
import { getC, KpiCard } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Users, TrendingUp, Wallet, AlertCircle, FileText, CheckCircle } from 'lucide-react';

const MOIS_KEYS = [
  'rh.month_january','rh.month_february','rh.month_march','rh.month_april','rh.month_may','rh.month_june',
  'rh.month_july','rh.month_august','rh.month_september','rh.month_october','rh.month_november','rh.month_december',
];

const STATUT_CFG = {
  brouillon: { labelKey: 'rh.statut_brouillon', color: '#6B7A99' },
  valide:    { labelKey: 'rh.statut_valide',    color: '#4E8BF5' },
  paye:      { labelKey: 'rh.statut_paye',      color: '#00D4AA' },
  annule:    { labelKey: 'rh.statut_annule',    color: '#FF5C6B' },
};

export default function DashboardRH() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { actuelle } = useEntreprise();
  const { dark } = useTheme();
  const C = getC(dark);

  const now = new Date();
  const moisCourant = now.getMonth() + 1;
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [stats, setStats] = useState(null);
  const [bulletinsMois, setBulletinsMois] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actuelle) return;
    setLoading(true);
    Promise.all([
      api.get(`/paie/stats?annee=${annee}`),
      api.get(`/paie/bulletins?annee=${annee}&mois=${moisCourant}&limit=200`),
    ]).then(([s, b]) => {
      setStats(s.data.data);
      setBulletinsMois(b.data.data || []);
    }).catch((err) => {
      console.error('Erreur dashboard RH:', err?.response?.data?.message || err.message);
    }).finally(() => setLoading(false));
  }, [annee, moisCourant, actuelle?.id]);

  // Répartition des bulletins du mois par statut (pie chart)
  const repartitionStatuts = useMemo(() => {
    const m = {};
    for (const b of bulletinsMois) m[b.statut] = (m[b.statut] || 0) + 1;
    return Object.entries(m).map(([statut, count]) => ({
      statut,
      count,
      label: STATUT_CFG[statut] ? t(STATUT_CFG[statut].labelKey) : statut,
      color: STATUT_CFG[statut]?.color || '#6B7A99',
    }));
  }, [bulletinsMois, t]);

  // Alertes : bulletins du mois encore en brouillon ou pas générés
  const nbBrouillons = bulletinsMois.filter(b => b.statut === 'brouillon').length;
  const nbValides   = bulletinsMois.filter(b => b.statut === 'valide').length;
  const aucunBulletin = bulletinsMois.length === 0;
  const moisLabel = t(MOIS_KEYS[moisCourant - 1]);

  // Évolution mensuelle (12 mois)
  const evolution = useMemo(() => {
    if (!stats?.par_mois) return [];
    return stats.par_mois.map(m => ({
      mois: t(MOIS_KEYS[parseInt(m.mois) - 1]).slice(0, 3),
      brut: parseFloat(m.brut) || 0,
      net: parseFloat(m.net) || 0,
      cout: parseFloat(m.cout) || 0,
    }));
  }, [stats, t]);

  if (loading || !stats) {
    return (
      <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg }}>
        <div style={{ color: C.muted, fontSize: 14 }}>{t('rh.loading')}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>
            {t('dashboard_rh.title')}
          </h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {t('dashboard_rh.subtitle', { name: user?.nom || '', company: actuelle?.nom || '' })}
          </p>
        </div>
        <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.accent} />
      </div>

      {/* Alertes */}
      {aucunBulletin && (
        <div style={{
          background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 11,
          padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} color={C.gold} />
          <span style={{ fontSize: 13, color: C.text }}>
            {t('dashboard_rh.alert_no_bulletins', { month: moisLabel, year: annee })}
          </span>
        </div>
      )}
      {!aucunBulletin && (nbBrouillons > 0 || nbValides > 0) && (
        <div style={{
          background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 11,
          padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <FileText size={16} color={C.blue} />
          <span style={{ fontSize: 13, color: C.text }}>
            {t('dashboard_rh.alert_pending', { brouillons: nbBrouillons, valides: nbValides, month: moisLabel })}
          </span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard
          label={t('dashboard_rh.kpi_effectif')}
          value={stats.effectif}
          sub={t('dashboard_rh.kpi_effectif_sub')}
          icon={Users}
          color={C.blue}
        />
        <KpiCard
          label={t('dashboard_rh.kpi_masse_salariale')}
          value={stats.total_brut}
          sub={t('dashboard_rh.kpi_year_sub', { year: annee })}
          icon={TrendingUp}
          color={C.accent}
        />
        <KpiCard
          label={t('dashboard_rh.kpi_net_verse')}
          value={stats.total_net}
          sub={t('dashboard_rh.kpi_year_sub', { year: annee })}
          icon={Wallet}
          color={C.gold}
        />
        <KpiCard
          label={t('dashboard_rh.kpi_cout_employeur')}
          value={stats.cout_total}
          sub={t('dashboard_rh.kpi_cout_sub')}
          icon={AlertCircle}
          color={C.red}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, marginBottom: 24 }}>
        {/* Évolution mensuelle */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', boxShadow: C.shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {t('dashboard_rh.evolution_title', { year: annee })}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {t('dashboard_rh.evolution_legend')}
            </div>
          </div>
          {evolution.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              {t('rh.no_bulletin_year')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="mois" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatFCFA(v, true)} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={v => `${formatFCFA(v)} ${t('common.currency')}`}
                  contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }}
                />
                <Bar dataKey="brut"  fill={C.accent} radius={[3, 3, 0, 0]} name={t('rh.kpi_brut_total')} />
                <Bar dataKey="net"   fill={C.gold}   radius={[3, 3, 0, 0]} name={t('rh.kpi_net_payer')} />
                <Bar dataKey="cout"  fill={C.red}    radius={[3, 3, 0, 0]} name={t('rh.kpi_cout_employeur')} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Répartition statuts bulletins du mois */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>
            {t('dashboard_rh.bulletins_month_title', { month: moisLabel, year: annee })}
          </div>
          {repartitionStatuts.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              {t('rh.no_bulletin_period', { month: moisLabel, year: annee })}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={repartitionStatuts} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={65} stroke="none">
                    {repartitionStatuts.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {repartitionStatuts.map(s => (
                  <div key={s.statut} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.sub }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
                      {s.label}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cotisations sociales */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', boxShadow: C.shadow }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          {t('dashboard_rh.cotisations_title')}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          {t('dashboard_rh.cotisations_sub', { year: annee })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {[
            { label: t('rh.stats_cot_sal'), val: stats.total_cot_sal, color: C.purple, sub: t('dashboard_rh.cnps_its') },
            { label: t('rh.stats_cot_pat'), val: stats.total_cot_pat, color: C.gold,   sub: t('dashboard_rh.cnps_employeur') },
            { label: t('rh.stats_impots'),  val: stats.total_impots,  color: C.red,    sub: t('dashboard_rh.its_dgi') },
          ].map((k, i) => (
            <div key={i} style={{
              background: dark ? '#0D1220' : C.cardAlt, borderRadius: 11, padding: '14px 16px',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {k.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'monospace', marginTop: 6 }}>
                {formatFCFA(k.val)} <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>{t('common.currency')}</span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bandeau bulletins émis */}
      <div style={{
        marginTop: 18, background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 11,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <CheckCircle size={15} color={C.accent} />
        <span style={{ fontSize: 12, color: C.sub }}>
          {t('dashboard_rh.bulletins_emis', { count: stats.nb_bulletins, year: annee })}
        </span>
      </div>
    </div>
  );
}
