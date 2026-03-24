import { useState, useEffect } from 'react';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { formatFCFA } from '../utils/helpers.jsx';
import toast from 'react-hot-toast';
import { getC, Metric, CustomTooltip } from '../components/UI.jsx';
import SelecteurAnnee from '../components/SelecteurAnnee.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, Calculator } from 'lucide-react';

export default function RapportsPage() {
  const { actuelle } = useEntreprise();
  const { dark } = useTheme();
  const C = getC(dark);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actuelle) return;
    setLoading(true);
    api.get(`/rapports/bilan?annee=${annee}`)
      .then(r => setBilan(r.data.data))
      .catch(() => toast.error('Erreur chargement bilan'))
      .finally(() => setLoading(false));
  }, [annee, actuelle?.id]);

  const moisNoms = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  const evolutionData = bilan ? moisNoms.map((nom, i) => {
    const row = bilan.recettes_par_mois.find(r => parseInt(r.mois) === i + 1);
    return { mois: nom, recettes: parseFloat(row?.total || 0), encaisse: parseFloat(row?.encaisse || 0) };
  }) : [];

  const chargesData = bilan?.depenses_par_categorie?.filter(d => parseFloat(d.total) > 0).map(d => ({
    name: d.categorie, value: parseFloat(d.total), color: d.couleur || '#6B7A99',
  })) || [];

  const t = bilan?.totaux || {};

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', background: C.bg, transition: 'background 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Rapports & Bilan</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {bilan?.entreprise || actuelle?.nom} · {bilan?.regime_fiscal} · {annee}
          </p>
        </div>
        <SelecteurAnnee annee={annee} setAnnee={setAnnee} couleurActif={C.accent} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>Chargement...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
            <Metric label="Recettes HT" value={`${formatFCFA(t.recettes, true)} FCFA`} sub="Total factures" icon={TrendingUp} color={C.accent} />
            <Metric label="Dépenses" value={`${formatFCFA(t.depenses, true)} FCFA`} sub="Charges payées" icon={TrendingDown} color={C.red} />
            <Metric label="Taxes payées" value={`${formatFCFA(t.taxes_payees, true)} FCFA`} sub="DGI · CNSS" icon={Calculator} color={C.purple} />
            <Metric label="Résultat net" value={`${formatFCFA(t.resultat_net, true)} FCFA`} sub="après tout" icon={DollarSign} color={C.gold} />
            <Metric label="Taux de marge" value={`${t.marge}%`} sub="Marge nette" icon={Percent} color={C.blue} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>Recettes mensuelles {annee}</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>Facturation vs Encaissements</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={evolutionData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="mois" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => formatFCFA(v, true)} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="recettes" name="Facturation" fill={C.accent} radius={[5,5,0,0]} opacity={0.8} />
                  <Bar dataKey="encaisse" name="Encaissé" fill={C.blue} radius={[5,5,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: C.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>Charges {annee}</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Répartition par catégorie</div>
              {chargesData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={chargesData} cx="50%" cy="50%" outerRadius={65} dataKey="value" stroke="none">
                        {chargesData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={v => `${formatFCFA(v)} FCFA`} contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {chargesData.slice(0, 5).map((c, i) => {
                      const pct = t.depenses > 0 ? ((c.value / t.depenses) * 100).toFixed(0) : 0;
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
                <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 12 }}>Aucune dépense</div>
              )}
            </div>
          </div>

          {/* Tableau mensuel */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 24, boxShadow: C.shadow }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, background: dark ? 'transparent' : C.cardAlt }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Compte de résultat mensuel — {annee}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: dark ? '#0D1220' : C.cardAlt }}>
                  {['Mois','Recettes HT','Encaissé','Taux encaissement'].map(h => (
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
                        {m.recettes > 0 ? `${formatFCFA(m.recettes)} FCFA` : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', color: m.encaisse > 0 ? C.text : C.muted }}>
                        {m.encaisse > 0 ? `${formatFCFA(m.encaisse)} FCFA` : '—'}
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
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 800, color: C.text }}>TOTAL {annee}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 800, color: C.accent }}>{formatFCFA(t.recettes)} FCFA</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 800, color: C.text }}>
                    {formatFCFA(evolutionData.reduce((s, m) => s + m.encaisse, 0))} FCFA
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Synthèse taxes */}
          {bilan?.taxes?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: C.shadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.text }}>Synthèse fiscale {annee}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {bilan.taxes.map((tax, i) => (
                  <div key={i} style={{ background: dark ? '#161F2E' : C.cardAlt, borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.purple}30` }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.purple, marginBottom: 6 }}>{tax.type_taxe}</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{formatFCFA(tax.total_du, true)} FCFA</div>
                    <div style={{ fontSize: 10, color: C.accent, marginTop: 4 }}>Payé: {formatFCFA(tax.total_paye, true)}</div>
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
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: C.text }}>Résultat de l'exercice {annee}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Recettes totales', val: t.recettes, color: C.accent },
                { label: 'Charges totales', val: t.depenses, color: C.red },
                { label: 'Taxes payées', val: t.taxes_payees, color: C.purple },
                { label: 'Résultat net', val: t.resultat_net, color: parseFloat(t.resultat_net) >= 0 ? C.gold : C.red },
              ].map((item, i) => (
                <div key={i} style={{ background: dark ? '#161F2E' : C.cardAlt, borderRadius: 12, padding: '16px 18px', border: `1px solid ${item.color}30` }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>
                    {formatFCFA(item.val)} <span style={{ fontSize: 10, fontWeight: 400, color: C.muted }}>FCFA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
