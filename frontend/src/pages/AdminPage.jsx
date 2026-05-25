import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Users, Award, Building2, AlertCircle, RefreshCw,
  ShieldCheck, Sparkles, Check, X, Send, Copy, Crown, Medal,
  Clock, ArrowUpRight, Search, Inbox, Activity, Mail,
} from 'lucide-react';
import api from '../utils/api.jsx';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

const getC = (dark) => dark ? {
  bg: '#08090D',
  bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(45, 191, 156, 0.12), transparent 60%), #08090D',
  surface: '#0F1117',
  card: '#13161E',
  cardElev: '#181C26',
  border: '#1E222D',
  borderStrong: '#2A2F3D',
  text: '#F2F4F8',
  sub: '#A9B1BC',
  muted: '#6B7280',
  accent: '#2DBF9C',
  accentInk: '#04140F',
  admin: '#7C7FF5',
  adminGlow: 'rgba(124, 127, 245, 0.35)',
  gold: '#F5C44A',
  silver: '#CBD5E1',
  bronze: '#D69A6C',
  danger: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
} : {
  bg: '#F4F5F1',
  bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.10), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(15, 138, 110, 0.06), transparent 60%), #F4F5F1',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElev: '#FAFBF7',
  border: '#E5E7E0',
  borderStrong: '#CFD2C7',
  text: '#0E1116',
  sub: '#3C4250',
  muted: '#6B7280',
  accent: '#0F8A6E',
  accentInk: '#FFFFFF',
  admin: '#5558E0',
  adminGlow: 'rgba(85, 88, 224, 0.20)',
  gold: '#D4A017',
  silver: '#94A3B8',
  bronze: '#A26A3F',
  danger: '#C03A4A',
  warning: '#B45309',
  info: '#1E40AF',
};

const fontDisplay = '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif';
const fontUI = '"Satoshi", "Cabinet Grotesk", system-ui, sans-serif';
const fontMono = '"JetBrains Mono", ui-monospace, "SF Mono", monospace';

const formatNum = (n) => (n ?? 0).toLocaleString('fr-FR');
const formatDate = (s) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
const formatDateLong = (s) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const initiale = (s) => (s || '?').trim().charAt(0).toUpperCase();

const gradientFromString = (str) => {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 65% 45%))`;
};

export default function AdminPage() {
  const { dark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const C = getC(dark);

  const [stats, setStats] = useState(null);
  const [candidatures, setCandidatures] = useState([]);
  const [cabinets, setCabinets] = useState([]);
  const [relances, setRelances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [modalValider, setModalValider] = useState(null);
  const [modalRefuser, setModalRefuser] = useState(null);
  const [motifRefus, setMotifRefus] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [recherche, setRecherche] = useState('');

  const fetchAll = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [s, c, l, r] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/candidatures?statut=pending'),
        api.get('/admin/cabinets'),
        api.get('/admin/relances'),
      ]);
      setStats(s.data.data);
      setCandidatures(c.data.data);
      setCabinets(l.data.data);
      setRelances(r.data.data);
    } catch (err) {
      if (err.response?.status === 403) setAccessDenied(true);
      else toast.error(err.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const cabinetsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return cabinets;
    return cabinets.filter(c =>
      (c.cabinet_nom || '').toLowerCase().includes(q) ||
      (c.code_parrain || '').toLowerCase().includes(q)
    );
  }, [cabinets, recherche]);

  const valider = async () => {
    if (!modalValider) return;
    setActionLoading(true);
    try {
      const { data } = await api.post(`/admin/candidatures/${modalValider.id}/valider`);
      toast.success(`Cabinet activé · code parrain ${data.data.code_parrain}`);
      setModalValider(null);
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const refuser = async () => {
    if (!modalRefuser) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/candidatures/${modalRefuser.id}/refuser`, { motif: motifRefus });
      toast.success('Candidature refusée');
      setModalRefuser(null);
      setMotifRefus('');
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const copier = (txt) => {
    navigator.clipboard.writeText(txt);
    toast.success('Copié');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bgGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${C.admin}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${C.adminGlow}` }}>
          <ShieldCheck size={28} color="#FFF" />
        </div>
        <div style={{ color: C.sub, fontFamily: fontUI, fontSize: 13 }}>Chargement de la console…</div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ minHeight: '100vh', background: C.bgGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 40, maxWidth: 440 }}>
          <div style={{ width: 80, height: 80, margin: '0 auto 24px', borderRadius: 20, background: `${C.danger}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={40} color={C.danger} />
          </div>
          <h1 style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>Accès refusé</h1>
          <p style={{ color: C.sub, fontFamily: fontUI, fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
            Cette console est strictement réservée à l'équipe ApeX. Un audit log est conservé pour chaque tentative d'accès.
          </p>
          <button onClick={() => navigate('/dashboard')} style={{
            marginTop: 24, padding: '12px 24px', borderRadius: 12,
            background: C.accent, color: C.accentInk, border: 'none',
            fontFamily: fontUI, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Retour au tableau de bord</button>
        </div>
      </div>
    );
  }
  if (!stats) return null;

  const tauxConv = stats.taux_conversion_pct || 0;
  const mrrPmeAvg = stats.pme_actives > 0 ? Math.round(stats.mrr_fcfa / stats.pme_actives) : 0;

  return (
    <div style={{ minHeight: '100vh', background: C.bgGradient, color: C.text, fontFamily: fontUI }}>
      <style>{`
        @keyframes adminGlow { 0%,100% { opacity: 0.7 } 50% { opacity: 1 } }
        @keyframes adminPulse { 0%,100% { transform: scale(1); opacity: 0.5 } 50% { transform: scale(1.4); opacity: 0 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .admin-card { animation: fadeIn 0.4s ease-out both; }
        .admin-row { transition: background 0.15s ease; }
        .admin-row:hover { background: ${C.cardElev}; }
        .admin-action { transition: all 0.15s ease; }
        .admin-action:hover { transform: translateY(-1px); }
      `}</style>

      {/* HEADER */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: dark ? 'rgba(8, 9, 13, 0.85)' : 'rgba(244, 245, 241, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '20px 40px',
      }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${C.admin}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 32px ${C.adminGlow}` }}>
              <ShieldCheck size={24} color="#FFF" strokeWidth={2.4} />
              <span style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: C.accent, border: `2px solid ${C.bg}`, animation: 'adminGlow 2s ease infinite' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.025em', color: C.text }}>Console Admin</h1>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em', color: C.admin, padding: '3px 8px', borderRadius: 5, background: `${C.admin}18`, border: `1px solid ${C.admin}40`, fontFamily: fontUI }}>SUPER-ADMIN</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>
                Connecté · <span style={{ color: C.text, fontWeight: 600 }}>{user?.nom || user?.email}</span> · {formatDateLong(new Date().toISOString())}
              </div>
            </div>
          </div>
          <button onClick={() => fetchAll(true)} disabled={refreshing} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 10,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontFamily: fontUI, fontSize: 13, fontWeight: 600,
            cursor: refreshing ? 'wait' : 'pointer',
          }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Rafraîchir
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '32px 40px 64px' }}>

        {/* HERO KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <KpiHero C={C} icon={TrendingUp} accent={C.accent}
            label="MRR Plateforme"
            value={formatNum(stats.mrr_fcfa)}
            unit="FCFA / mois"
            sub={mrrPmeAvg > 0 ? `≈ ${formatNum(mrrPmeAvg)} FCFA / PME` : 'Aucune PME payante'} />
          <KpiHero C={C} icon={Award} accent={C.gold}
            label="Cabinets partenaires"
            value={formatNum(stats.cabinets_partenaires)}
            unit="actifs"
            sub={stats.candidatures_pending > 0 ? `${stats.candidatures_pending} en attente de validation` : 'Aucune candidature en attente'} />
          <KpiHero C={C} icon={Building2} accent={C.info}
            label="PME actives"
            value={formatNum(stats.pme_actives)}
            unit="entreprises"
            sub={stats.pme_parrainees > 0 ? `${stats.pme_parrainees} parrainée(s) par un cabinet` : 'Aucune PME parrainée'} />
          <KpiHero C={C} icon={Sparkles} accent={C.admin}
            label="Taux de conversion"
            value={tauxConv}
            unit="%"
            sub={`${stats.invitations_acceptees}/${stats.invitations_total} invitations`}
            progress={tauxConv} />
        </div>

        {/* MINI METRICS */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
          padding: 18, background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 14,
          marginBottom: 32,
        }}>
          <Mini C={C} icon={Inbox} label="Candidatures en attente" value={stats.candidatures_pending} accent={C.warning} />
          <Mini C={C} icon={Send} label="Invitations PME pending" value={stats.invitations_pending} accent={C.info} />
          <Mini C={C} icon={Users} label="Utilisateurs actifs" value={stats.utilisateurs_actifs} accent={C.accent} />
          <Mini C={C} icon={Clock} label="Comptes démo en cours" value={stats.users_demo_actifs} accent={C.muted} />
        </div>

        {/* CANDIDATURES */}
        <Section C={C} icon={Inbox} accent={C.warning} title="Candidatures en attente" count={candidatures.length}>
          {candidatures.length === 0 ? (
            <EmptyState C={C} icon={Check} text="Aucune candidature à traiter" sub="Tu seras notifié dès qu'un cabinet postule via /partenaires-cabinets" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {candidatures.map((c, idx) => (
                <div key={c.id} className="admin-card" style={{
                  display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 16,
                  padding: 18, background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, alignItems: 'center',
                  animationDelay: `${idx * 0.04}s`,
                }}>
                  <Avatar C={C} nom={c.nom_cabinet} size={56} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: fontDisplay, fontSize: 17, fontWeight: 700, color: C.text }}>{c.nom_cabinet}</span>
                      {c.numero_onecca && <span style={{ fontSize: 10, fontWeight: 700, color: C.admin, padding: '2px 8px', borderRadius: 4, background: `${C.admin}15`, border: `1px solid ${C.admin}30` }}>ONECCA {c.numero_onecca}</span>}
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>Reçue le {formatDate(c.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 12.5, color: C.sub, flexWrap: 'wrap' }}>
                      <span><strong style={{ color: C.text, fontWeight: 600 }}>{c.nom_responsable}</strong></span>
                      <span>·</span>
                      <span style={{ fontFamily: fontMono, fontSize: 11.5 }}>{c.email_pro}</span>
                      {c.ville && <><span>·</span><span>{c.ville}</span></>}
                      {c.nb_clients_pme > 0 && <><span>·</span><span><strong style={{ color: C.text, fontWeight: 600 }}>{c.nb_clients_pme}</strong> clients PME</span></>}
                      {c.nb_collaborateurs > 0 && <><span>·</span><span>{c.nb_collaborateurs} collab.</span></>}
                    </div>
                    {c.message && <div style={{ marginTop: 10, padding: '8px 12px', background: C.cardElev, borderRadius: 8, fontSize: 12.5, color: C.sub, fontStyle: 'italic', borderLeft: `3px solid ${C.admin}` }}>« {c.message} »</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="admin-action" onClick={() => setModalRefuser(c)} style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: 'transparent', border: `1px solid ${C.border}`,
                      color: C.muted, fontFamily: fontUI, fontWeight: 600, fontSize: 12.5,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    }}><X size={14} />Refuser</button>
                    <button className="admin-action" onClick={() => setModalValider(c)} style={{
                      padding: '10px 18px', borderRadius: 10,
                      background: `linear-gradient(135deg, ${C.accent}, ${C.admin})`,
                      border: 'none', color: '#FFF',
                      fontFamily: fontUI, fontWeight: 700, fontSize: 12.5,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: `0 4px 16px ${C.adminGlow}`,
                    }}><Check size={14} />Valider</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* LEADERBOARD */}
        <Section C={C} icon={Crown} accent={C.gold} title="Leaderboard cabinets" count={cabinets.length}
          right={
            <div style={{ position: 'relative' }}>
              <Search size={14} color={C.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Filtrer par nom ou code…"
                style={{
                  padding: '8px 12px 8px 34px', width: 240,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text,
                  fontFamily: fontUI, fontSize: 12.5, outline: 'none',
                }} />
            </div>
          }
        >
          {cabinetsFiltres.length === 0 ? (
            <EmptyState C={C} icon={Award}
              text={recherche ? 'Aucun cabinet ne correspond' : 'Aucun cabinet partenaire pour l\'instant'}
              sub={recherche ? 'Essaie un autre filtre' : 'Les candidatures validées apparaîtront ici'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cabinetsFiltres.map((c, i) => {
                const max = Math.max(...cabinetsFiltres.map(x => x.invitations_acceptees || 0), 1);
                const ratio = Math.min(100, ((c.invitations_acceptees || 0) / max) * 100);
                const rang = i + 1;
                const couleurRang = rang === 1 ? C.gold : rang === 2 ? C.silver : rang === 3 ? C.bronze : C.muted;
                const IconRang = rang <= 3 ? Medal : null;
                return (
                  <div key={c.id} className="admin-row" style={{
                    display: 'grid', gridTemplateColumns: '40px 240px 1fr auto', gap: 16,
                    padding: '14px 18px', background: C.card,
                    border: `1px solid ${C.border}`, borderRadius: 12,
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: couleurRang, fontFamily: fontDisplay, fontWeight: 800, fontSize: 18 }}>
                      {IconRang && <IconRang size={16} fill={couleurRang} color={couleurRang} />}
                      <span>#{rang}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <Avatar C={C} nom={c.cabinet_nom} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: fontDisplay, fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.cabinet_nom}</div>
                        <button onClick={() => copier(c.code_parrain)} style={{
                          marginTop: 2, padding: 0, background: 'none', border: 'none',
                          color: C.accent, fontFamily: fontMono, fontSize: 10.5, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        }}>{c.code_parrain}<Copy size={10} /></button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.muted, fontWeight: 600, marginBottom: 4 }}>
                          <span>{c.invitations_acceptees}/{c.invitations_emises} invitations</span>
                          <span style={{ color: c.taux_conversion_pct >= 30 ? C.accent : c.taux_conversion_pct >= 10 ? C.warning : C.muted, fontFamily: fontMono }}>{c.taux_conversion_pct}%</span>
                        </div>
                        <div style={{ height: 6, background: C.cardElev, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${ratio}%`, height: '100%',
                            background: `linear-gradient(90deg, ${C.accent}, ${C.admin})`,
                            borderRadius: 3, transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                      <Stat C={C} label="Clients" value={c.clients_actifs} />
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 110 }}>
                      <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: C.text }}>{formatNum(c.mrr_genere_fcfa)}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: '0.04em' }}>FCFA/mois</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* RELANCES — timeline */}
        <Section C={C} icon={Activity} accent={C.info} title="Relances automatiques" count={relances.length}>
          {relances.length === 0 ? (
            <EmptyState C={C} icon={Mail} text="Aucune relance envoyée pour l'instant" sub="Le cron J+2 s'exécute toutes les heures" />
          ) : (
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 11, top: 8, bottom: 8, width: 2, background: C.border }} />
              {relances.map((r, idx) => (
                <div key={r.id} className="admin-card" style={{
                  position: 'relative', padding: '12px 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  animationDelay: `${idx * 0.03}s`,
                }}>
                  <div style={{
                    position: 'absolute', left: -23, top: 18,
                    width: 10, height: 10, borderRadius: '50%',
                    background: r.statut === 'accepted' ? C.accent : r.statut === 'expired' ? C.danger : C.warning,
                    boxShadow: `0 0 0 4px ${C.bg}, 0 0 0 5px ${C.border}`,
                  }} />
                  <div>
                    <div style={{ fontSize: 13, color: C.text, fontFamily: fontMono, fontWeight: 600 }}>{r.email_pme}</div>
                    <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>
                      Invité par <strong style={{ color: C.text }}>{r.cabinet_nom}</strong> · envoyée {formatDate(r.created_at)} · relancée {formatDate(r.relance_envoyee_at)}
                    </div>
                  </div>
                  <span style={badgeStatut(C, r.statut)}>{r.statut}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* FOOTER */}
        <div style={{
          marginTop: 48, padding: 20, textAlign: 'center',
          color: C.muted, fontSize: 11.5,
        }}>
          Console privée · toutes les actions sont consignées dans <code style={{ fontFamily: fontMono, color: C.sub }}>audit_log</code>
        </div>
      </div>

      {/* MODAL VALIDER */}
      {modalValider && (
        <Modal C={C} onClose={() => !actionLoading && setModalValider(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.accent}, ${C.admin})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 20px ${C.adminGlow}` }}>
              <Check size={22} color="#FFF" strokeWidth={2.6} />
            </div>
            <div>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 800, margin: 0, color: C.text }}>Valider la candidature</h3>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{modalValider.nom_cabinet}</div>
            </div>
          </div>
          <div style={{ padding: 16, background: C.cardElev, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
            En validant, le système va :
            <ul style={{ margin: '10px 0 0', paddingLeft: 20, color: C.text }}>
              <li>Créer le compte cabinet (palier <code style={{ fontFamily: fontMono, color: C.accent }}>cabinet_partenaire</code>, gratuit)</li>
              <li>Générer un <strong>code parrain unique</strong> et un lien d'activation valide 30 jours</li>
              <li>Envoyer un email d'activation à <code style={{ fontFamily: fontMono, color: C.text }}>{modalValider.email_pro}</code></li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
            <button onClick={() => setModalValider(null)} disabled={actionLoading} style={btnSecondary(C)}>Annuler</button>
            <button onClick={valider} disabled={actionLoading} style={btnPrimary(C)}>
              {actionLoading ? 'Validation…' : 'Valider et activer'}
              {!actionLoading && <ArrowUpRight size={14} />}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL REFUSER */}
      {modalRefuser && (
        <Modal C={C} onClose={() => !actionLoading && (setModalRefuser(null), setMotifRefus(''))}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.danger}18`, border: `1px solid ${C.danger}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={22} color={C.danger} strokeWidth={2.6} />
            </div>
            <div>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 800, margin: 0, color: C.text }}>Refuser la candidature</h3>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{modalRefuser.nom_cabinet}</div>
            </div>
          </div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Motif (interne)</label>
          <textarea
            value={motifRefus}
            onChange={(e) => setMotifRefus(e.target.value)}
            placeholder="ex: pas de n° ONECCA vérifiable / hors cible / doublon…"
            rows={3}
            style={{
              width: '100%', padding: 12, borderRadius: 10,
              background: C.cardElev, border: `1px solid ${C.border}`,
              color: C.text, fontFamily: fontUI, fontSize: 13,
              outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Conservé en BDD pour audit, non envoyé au cabinet.</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
            <button onClick={() => { setModalRefuser(null); setMotifRefus(''); }} disabled={actionLoading} style={btnSecondary(C)}>Annuler</button>
            <button onClick={refuser} disabled={actionLoading} style={btnDanger(C)}>
              {actionLoading ? 'Envoi…' : 'Confirmer le refus'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KpiHero({ C, icon: Icon, accent, label, value, unit, sub, progress }) {
  return (
    <div className="admin-card" style={{
      position: 'relative', overflow: 'hidden',
      padding: 22, borderRadius: 16,
      background: C.card,
      border: `1px solid ${C.border}`,
    }}>
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 160, height: 160, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}22, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11,
          background: `linear-gradient(135deg, ${accent}, ${accent}AA)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 24px ${accent}40`,
        }}>
          <Icon size={20} color="#FFF" strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6 }}>{label}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontFamily: fontDisplay, fontSize: 36, fontWeight: 800, color: C.text, letterSpacing: '-0.025em', lineHeight: 1 }}>{value}</div>
        {unit && <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{unit}</div>}
      </div>
      {progress !== undefined && (
        <div style={{ marginTop: 14, height: 4, background: C.cardElev, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, progress)}%`, height: '100%', background: `linear-gradient(90deg, ${accent}, ${C.accent})`, borderRadius: 2 }} />
        </div>
      )}
      {sub && <div style={{ marginTop: 12, fontSize: 11.5, color: C.sub }}>{sub}</div>}
    </div>
  );
}

function Mini({ C, icon: Icon, label, value, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} color={accent} />
      </div>
      <div>
        <div style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3, letterSpacing: '0.04em' }}>{label}</div>
      </div>
    </div>
  );
}

function Section({ C, icon: Icon, accent, title, count, right, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} color={accent} />
          </div>
          <h2 style={{ fontFamily: fontDisplay, fontSize: 18, fontWeight: 800, margin: 0, color: C.text, letterSpacing: '-0.015em' }}>{title}</h2>
          {count !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, padding: '3px 9px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontFamily: fontMono }}>{count}</span>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ C, icon: Icon, text, sub }) {
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center',
      background: C.card, border: `1px dashed ${C.border}`, borderRadius: 14,
    }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: C.cardElev, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon size={22} color={C.muted} />
      </div>
      <div style={{ fontFamily: fontDisplay, fontSize: 15, fontWeight: 700, color: C.text }}>{text}</div>
      {sub && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Avatar({ C, nom, size = 40 }) {
  return (
    <div style={{
      flexShrink: 0, width: size, height: size,
      borderRadius: size / 3.5,
      background: gradientFromString(nom),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: fontDisplay, fontWeight: 800,
      color: '#FFF', fontSize: size * 0.42,
      boxShadow: `0 4px 12px rgba(0, 0, 0, 0.25)`,
    }}>
      {initiale(nom)}
    </div>
  );
}

function Stat({ C, label, value }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
      <div style={{ fontFamily: fontDisplay, fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: C.muted, marginTop: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function Modal({ C, onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 0.2s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480,
        background: C.surface, border: `1px solid ${C.borderStrong}`,
        borderRadius: 18, padding: 28,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {children}
      </div>
    </div>
  );
}

const btnPrimary = (C) => ({
  padding: '10px 18px', borderRadius: 10,
  background: `linear-gradient(135deg, ${C.accent}, ${C.admin})`,
  border: 'none', color: '#FFF',
  fontFamily: fontUI, fontWeight: 700, fontSize: 13,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  boxShadow: `0 4px 16px ${C.adminGlow}`,
});
const btnSecondary = (C) => ({
  padding: '10px 16px', borderRadius: 10,
  background: 'transparent', border: `1px solid ${C.border}`,
  color: C.sub, fontFamily: fontUI, fontWeight: 600, fontSize: 13, cursor: 'pointer',
});
const btnDanger = (C) => ({
  padding: '10px 18px', borderRadius: 10,
  background: C.danger, border: 'none', color: '#FFF',
  fontFamily: fontUI, fontWeight: 700, fontSize: 13, cursor: 'pointer',
});
const badgeStatut = (C, statut) => {
  const map = {
    accepted: { bg: `${C.accent}18`, color: C.accent, txt: 'acceptée' },
    expired:  { bg: `${C.danger}18`, color: C.danger, txt: 'expirée' },
    pending:  { bg: `${C.warning}18`, color: C.warning, txt: 'en attente' },
    revoked:  { bg: `${C.muted}18`, color: C.muted, txt: 'révoquée' },
  };
  const s = map[statut] || map.pending;
  return {
    padding: '4px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 700,
    background: s.bg, color: s.color, fontFamily: 'inherit',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  };
};
