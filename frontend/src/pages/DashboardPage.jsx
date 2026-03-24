import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA, formatDate } from '../utils/helpers.jsx';
import { getC, KpiCard, CustomTooltip, StatutBadge } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, AlertTriangle, DollarSign, Calculator } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { actuelle } = useEntreprise();
  const { dark } = useTheme();
  const C = getC(dark);

  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <div style={{ color: C.muted, fontSize: 14 }}>Sélectionnez une entreprise dans la sidebar</div>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: C.muted, fontSize: 13 }}>
      Chargement du tableau de bord...
    </div>
  );

  const kpis = stats?.kpis || {};
  const evolution = stats?.evolution_mensuelle || [];
  const charges = stats?.repartition_charges || [];
  const topClients = stats?.top_clients || [];

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>
            Bonjour, {user?.nom?.split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {actuelle.nom} · {actuelle.regime_fiscal} · {annee}
          </p>
        </div>
        <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.accent} />
      </div>

      {/* Alertes */}
      {(kpis.nb_retard > 0 || kpis.total_taxes_dues > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {kpis.nb_retard > 0 && (
            <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}50`, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={15} color={C.red} />
              <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>
                {kpis.nb_retard} facture{kpis.nb_retard > 1 ? 's' : ''} en retard · {formatFCFA(kpis.en_retard)} FCFA
              </span>
            </div>
          )}
          {kpis.total_taxes_dues > 0 && (
            <div style={{ background: `${C.purple}15`, border: `1px solid ${C.purple}50`, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calculator size={15} color={C.purple} />
              <span style={{ fontSize: 13, color: C.purple, fontWeight: 600 }}>
                {formatFCFA(kpis.total_taxes_dues)} FCFA de taxes dues (DGI/CNSS)
              </span>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Chiffre d'affaires" value={kpis.ca_total} sub={`marge ${kpis.marge}%`} icon={TrendingUp} color={C.accent} />
        <KpiCard label="Dépenses" value={kpis.total_depenses} sub="charges payées" icon={TrendingDown} color={C.red} />
        <KpiCard label="Taxes dues" value={kpis.total_taxes_dues} sub="DGI · CNSS" icon={Calculator} color={C.purple} alert={kpis.total_taxes_dues > 0} />
        <KpiCard label="Bénéfice net" value={kpis.benefice_net} sub={`${kpis.nb_factures} factures`} icon={DollarSign} color={C.gold} />
        <KpiCard label="Clients actifs" value={kpis.nb_clients} sub="en base" icon={Users} color={C.blue} />
      </div>

      {/* Graphiques */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 22 }}>
        {/* Évolution mensuelle */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>Évolution financière {annee}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>Recettes · Dépenses · Bénéfice</div>
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
              <Area type="monotone" dataKey="recettes" name="Recettes" stroke={C.accent} fill="url(#gR)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="benefice" name="Bénéfice" stroke={C.gold} fill="url(#gB)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="depenses" name="Dépenses" stroke={C.red} fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition charges */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>Structure des charges</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Dépenses par catégorie</div>
          {charges.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={charges} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="total" stroke="none">
                    {charges.map((e, i) => <Cell key={i} fill={e.couleur || '#6B7A99'} />)}
                  </Pie>
                  <Tooltip
                    formatter={v => `${formatFCFA(v)} FCFA`}
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
            <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 12 }}>Aucune dépense enregistrée</div>
          )}
        </div>
      </div>

      {/* Transactions + Top clients */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        {/* Transactions */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>Transactions récentes</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>Factures et dépenses</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['N°', 'Tiers', 'Montant', 'Date', 'Statut'].map(h => (
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
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: C.muted, fontSize: 12 }}>Aucune transaction</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top clients */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>Top Clients</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>Par chiffre d'affaires {annee}</div>
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
              <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 12 }}>Aucun client</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
