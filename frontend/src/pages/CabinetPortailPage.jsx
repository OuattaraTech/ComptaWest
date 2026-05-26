import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, Copy, Check, X, Building2, Users, Mail, MessageCircle,
  RefreshCw, UserPlus, Send, ExternalLink, AlertCircle, Search,
  TrendingUp, Sparkles, Activity, Phone, Trash2, ArrowUpRight,
} from 'lucide-react';
import api from '../utils/api.jsx';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';

const getC = (dark) => dark ? {
  bg: '#08090D',
  bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245, 196, 74, 0.16), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(45, 191, 156, 0.12), transparent 60%), #08090D',
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
  cabinet: '#F5C44A',
  cabinetGlow: 'rgba(245, 196, 74, 0.35)',
  danger: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
  whatsapp: '#25D366',
} : {
  bg: '#F4F5F1',
  bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(214, 154, 23, 0.10), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(15, 138, 110, 0.06), transparent 60%), #F4F5F1',
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
  cabinet: '#D69A17',
  cabinetGlow: 'rgba(214, 154, 23, 0.22)',
  danger: '#C03A4A',
  warning: '#B45309',
  info: '#1E40AF',
  whatsapp: '#1FA855',
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

export default function CabinetPortailPage() {
  const { dark } = useTheme();
  const { actuelle } = useEntreprise();
  const navigate = useNavigate();
  const C = getC(dark);

  const [info, setInfo] = useState(null);
  const [clients, setClients] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalInviter, setModalInviter] = useState(false);
  const [resultatInvit, setResultatInvit] = useState(null);
  const [formInvit, setFormInvit] = useState({ email_pme: '', nom_pme: '', telephone_pme: '', remise_proposee_pct: 15 });
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    if (actuelle && actuelle.type_compte !== 'cabinet_partenaire') {
      toast.error('Ce portail est réservé aux Cabinets Partenaires ApeX.');
      navigate('/dashboard');
    }
  }, [actuelle, navigate]);

  const fetchAll = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [i, c, inv] = await Promise.all([
        api.get('/cabinets/me'),
        api.get('/cabinets/mes-clients'),
        api.get('/cabinets/invitations'),
      ]);
      setInfo(i.data.data);
      setClients(c.data.data);
      setInvitations(inv.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (actuelle?.type_compte === 'cabinet_partenaire') fetchAll();
  }, [actuelle]);

  const invitationsPending = useMemo(() => invitations.filter(i => i.statut === 'pending'), [invitations]);
  const invitationsHistorique = useMemo(() => invitations.filter(i => i.statut !== 'pending'), [invitations]);
  const tauxConv = invitations.length > 0
    ? Math.round((invitations.filter(i => i.statut === 'accepted').length / invitations.length) * 1000) / 10
    : 0;
  const mrrGenere = clients.reduce((s, c) => s + (c.prix_mensuel_fcfa || 0), 0);

  const clientsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      (c.pme_nom || '').toLowerCase().includes(q) ||
      (c.ncc || '').toLowerCase().includes(q)
    );
  }, [clients, recherche]);

  const copier = (txt) => { navigator.clipboard.writeText(txt); toast.success('Copié'); };

  const inviterPme = async () => {
    if (!formInvit.email_pme.trim()) { toast.error('Email obligatoire'); return; }
    setActionLoading(true);
    try {
      const { data } = await api.post('/cabinets/inviter-pme', formInvit);
      setResultatInvit({ ...data.data, nom_cabinet: info.nom });
      setModalInviter(false);
      setFormInvit({ email_pme: '', nom_pme: '', telephone_pme: '', remise_proposee_pct: 15 });
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const revoquerInvitation = async (id) => {
    if (!confirm('Révoquer cette invitation ? Le lien sera invalidé.')) return;
    try {
      await api.delete(`/cabinets/invitations/${id}`);
      toast.success('Invitation révoquée');
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  const detacherClient = async (connectionId, nomPme) => {
    if (!confirm(`Détacher ${nomPme} de votre dossier ?\n\nLa PME garde son compte ApeX mais vous perdez l'accès à ses données.`)) return;
    try {
      await api.delete(`/cabinets/connections/${connectionId}`);
      toast.success(`${nomPme} détaché`);
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  const lienWhatsAppInvitation = (invitation) => {
    if (!invitation.telephone_pme) return null;
    const phone = invitation.telephone_pme.replace(/[^\d+]/g, '').replace(/^\+/, '');
    const lien = `${window.location.origin}/rejoindre/${invitation.token}`;
    const msg = `Bonjour${invitation.nom_pme ? ' ' + invitation.nom_pme : ''},\n\n${info.nom} vous invite à rejoindre ApeX (logiciel de gestion comptable SYSCOHADA) avec une remise de ${invitation.remise_proposee_pct}% la 1ère année.\n\nActivez votre compte : ${lien}\n\nÀ très vite !`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bgGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${C.cabinetGlow}` }}>
          <Award size={28} color="#FFF" />
        </div>
        <div style={{ color: C.sub, fontFamily: fontUI, fontSize: 13 }}>Chargement du portail…</div>
      </div>
    );
  }
  if (!info) return null;

  return (
    <div style={{ minHeight: '100vh', background: C.bgGradient, color: C.text, fontFamily: fontUI }}>
      <style>{`
        @keyframes glow { 0%,100% { opacity: 0.7 } 50% { opacity: 1 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .cab-card { animation: fadeIn 0.4s ease-out both; }
        .cab-row { transition: background 0.15s ease, transform 0.15s ease; }
        .cab-row:hover { background: ${C.cardElev}; }
        .cab-action { transition: all 0.15s ease; }
        .cab-action:hover { transform: translateY(-1px); }
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
            <div style={{ position: 'relative' }}>
              <Avatar C={C} nom={info.nom} size={48} />
              <span style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: C.cabinet, border: `2px solid ${C.bg}`, animation: 'glow 2s ease infinite' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: C.text }}>{info.nom}</h1>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em', color: C.cabinet, padding: '3px 8px', borderRadius: 5, background: `${C.cabinet}18`, border: `1px solid ${C.cabinet}40`, fontFamily: fontUI }}>CABINET PARTENAIRE</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>
                Portail multi-dossiers · {formatDateLong(new Date().toISOString())}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <button onClick={() => setModalInviter(true)} className="cab-action" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10,
              background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`,
              border: 'none', color: '#FFF',
              fontFamily: fontUI, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', boxShadow: `0 6px 20px ${C.cabinetGlow}`,
            }}>
              <UserPlus size={14} strokeWidth={2.4} />
              Inviter une PME
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '32px 40px 64px' }}>

        {/* HERO CODE PARRAIN */}
        <div className="cab-card" style={{
          position: 'relative', overflow: 'hidden',
          padding: '28px 32px', borderRadius: 18,
          background: `linear-gradient(135deg, ${C.cabinet}12, ${C.accent}08)`,
          border: `1px solid ${C.cabinet}40`,
          marginBottom: 24,
        }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${C.cabinet}25, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', position: 'relative' }}>
            <div style={{ flex: '1 1 320px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Sparkles size={14} color={C.cabinet} />
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', color: C.cabinet, textTransform: 'uppercase' }}>Votre code parrain unique</span>
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 44, fontWeight: 800, color: C.text, letterSpacing: '0.02em', lineHeight: 1.1 }}>{info.code_parrain}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 10, lineHeight: 1.5 }}>
                Signature de votre cabinet. À mentionner dans vos communications, sur votre site,
                vos cartes de visite. Les PME que vous parrainez bénéficient automatiquement d'une remise.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => copier(info.code_parrain)} className="cab-action" style={{
                padding: '12px 18px', borderRadius: 11,
                background: C.surface, border: `1px solid ${C.border}`,
                color: C.text, fontFamily: fontUI, fontWeight: 600, fontSize: 13,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Copy size={14} /> Copier le code
              </button>
              <button onClick={() => setModalInviter(true)} className="cab-action" style={{
                padding: '12px 20px', borderRadius: 11,
                background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`,
                border: 'none', color: '#FFF',
                fontFamily: fontUI, fontWeight: 700, fontSize: 13,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: `0 6px 20px ${C.cabinetGlow}`,
              }}>
                <Send size={14} /> Inviter une PME
              </button>
            </div>
          </div>
        </div>

        {/* HERO KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <KpiHero C={C} icon={Users} accent={C.cabinet}
            label="Clients PME actifs"
            value={formatNum(info.nb_clients_actifs)}
            unit="connectés"
            sub={info.nb_pme_parrainees_total > 0 ? `${info.nb_pme_parrainees_total} parrainée(s) au total` : 'Invitez votre premier client'} />
          <KpiHero C={C} icon={Send} accent={C.info}
            label="Invitations envoyées"
            value={formatNum(invitations.length)}
            unit="au total"
            sub={invitationsPending.length > 0 ? `${invitationsPending.length} en attente d'activation` : 'Aucune en attente'} />
          <KpiHero C={C} icon={Sparkles} accent={C.accent}
            label="Taux de conversion"
            value={tauxConv}
            unit="%"
            sub={`${invitations.filter(i => i.statut === 'accepted').length} acceptées sur ${invitations.length}`}
            progress={tauxConv} />
          <KpiHero C={C} icon={TrendingUp} accent={C.cabinet}
            label="MRR clients"
            value={formatNum(mrrGenere)}
            unit="FCFA / mois"
            sub={clients.length > 0 ? `Moyenne ${formatNum(Math.round(mrrGenere / clients.length))} FCFA / client` : 'Pas encore de revenus'} />
        </div>

        {/* SECTION CLIENTS PME */}
        <Section C={C} icon={Building2} accent={C.cabinet} title="Mes clients PME" count={clients.length}
          right={clients.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Search size={14} color={C.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Filtrer par nom ou NCC…"
                style={{
                  padding: '8px 12px 8px 34px', width: 220,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text,
                  fontFamily: fontUI, fontSize: 12.5, outline: 'none',
                }} />
            </div>
          )}
        >
          {clientsFiltres.length === 0 ? (
            <EmptyState C={C} icon={Building2}
              text={recherche ? 'Aucun client ne correspond' : 'Aucun client PME pour l\'instant'}
              sub={recherche ? 'Essaie un autre filtre' : 'Cliquez sur « Inviter une PME » pour ajouter votre premier client'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clientsFiltres.map((c, idx) => (
                <div key={c.connection_id} className="cab-card cab-row" style={{
                  display: 'grid', gridTemplateColumns: '44px 1fr auto auto', gap: 16,
                  padding: 16, background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, alignItems: 'center',
                  animationDelay: `${idx * 0.04}s`,
                }}>
                  <Avatar C={C} nom={c.pme_nom} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: fontDisplay, fontSize: 15, fontWeight: 700, color: C.text }}>{c.pme_nom}</span>
                      {c.regime_fiscal && <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, padding: '2px 7px', borderRadius: 4, background: C.cardElev }}>{c.regime_fiscal}</span>}
                      {c.palier && <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, padding: '2px 7px', borderRadius: 4, background: `${C.accent}18` }}>{c.palier.toUpperCase()}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 11.5, color: C.sub }}>
                      {c.ncc && <span style={{ fontFamily: fontMono }}>NCC {c.ncc}</span>}
                      {c.secteur && <><span>·</span><span>{c.secteur}</span></>}
                      {c.remise_parrainage_pct > 0 && <><span>·</span><span>Remise <strong style={{ color: C.cabinet }}>{c.remise_parrainage_pct}%</strong></span></>}
                      <span>·</span>
                      <span>Connecté {formatDate(c.active_at)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: C.text }}>{formatNum(c.prix_mensuel_fcfa || 0)}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>FCFA/mois</div>
                  </div>
                  <button onClick={() => detacherClient(c.connection_id, c.pme_nom)} className="cab-action" title="Détacher ce client" style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: 'transparent', border: `1px solid ${C.border}`,
                    color: C.muted, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* SECTION INVITATIONS PENDING */}
        <Section C={C} icon={Activity} accent={C.info} title="Invitations en attente" count={invitationsPending.length}>
          {invitationsPending.length === 0 ? (
            <EmptyState C={C} icon={Send} text="Aucune invitation en attente" sub="Les invitations envoyées en attente d'activation apparaîtront ici" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invitationsPending.map((i, idx) => {
                const lienActivation = `${window.location.origin}/rejoindre/${i.token}`;
                const lienWa = lienWhatsAppInvitation(i);
                return (
                  <div key={i.id} className="cab-card cab-row" style={{
                    display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 16,
                    padding: 16, background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 12, alignItems: 'center',
                    animationDelay: `${idx * 0.04}s`,
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: 11, background: `${C.info}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={18} color={C.info} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: fontDisplay, fontSize: 14, fontWeight: 700, color: C.text }}>{i.nom_pme || i.email_pme}</span>
                        <span style={badgeStatut(C, i.statut)}>{i.statut}</span>
                        {i.relance_envoyee_at && <span style={{ fontSize: 10, color: C.muted, padding: '2px 7px', borderRadius: 4, background: C.cardElev }}>Relancée {formatDate(i.relance_envoyee_at)}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 11.5, color: C.sub }}>
                        <span style={{ fontFamily: fontMono }}>{i.email_pme}</span>
                        {i.telephone_pme && <><span>·</span><span style={{ fontFamily: fontMono }}>{i.telephone_pme}</span></>}
                        <span>·</span>
                        <span>Envoyée {formatDate(i.created_at)}</span>
                        {i.remise_proposee_pct > 0 && <><span>·</span><span>-{i.remise_proposee_pct}%</span></>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => copier(lienActivation)} className="cab-action" title="Copier le lien"
                        style={iconBtn(C)}><Copy size={13} /></button>
                      {lienWa && (
                        <a href={lienWa} target="_blank" rel="noopener noreferrer" className="cab-action" title="Envoyer sur WhatsApp"
                          style={{ ...iconBtn(C), background: `${C.whatsapp}18`, borderColor: `${C.whatsapp}55`, color: C.whatsapp, textDecoration: 'none' }}>
                          <MessageCircle size={13} />
                        </a>
                      )}
                      <button onClick={() => revoquerInvitation(i.id)} className="cab-action" title="Révoquer"
                        style={{ ...iconBtn(C), color: C.danger }}><X size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* SECTION HISTORIQUE */}
        {invitationsHistorique.length > 0 && (
          <Section C={C} icon={Award} accent={C.muted} title="Historique des invitations" count={invitationsHistorique.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {invitationsHistorique.slice(0, 20).map((i, idx) => (
                <div key={i.id} className="cab-row" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Mail size={14} color={C.muted} />
                    <span style={{ fontFamily: fontMono, fontSize: 12, color: C.sub }}>{i.email_pme}</span>
                    {i.nom_pme && <span style={{ fontSize: 12, color: C.text }}>· {i.nom_pme}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>{formatDate(i.created_at)}</span>
                    <span style={badgeStatut(C, i.statut)}>{i.statut}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div style={{ marginTop: 48, padding: 20, textAlign: 'center', color: C.muted, fontSize: 11.5 }}>
          Portail Cabinet Partenaire · ApeX · Support WhatsApp prioritaire 2h ouvrées
        </div>
      </div>

      {/* MODAL INVITER PME */}
      {modalInviter && (
        <Modal C={C} onClose={() => !actionLoading && setModalInviter(false)} large>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 20px ${C.cabinetGlow}` }}>
              <UserPlus size={22} color="#FFF" strokeWidth={2.4} />
            </div>
            <div>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 800, margin: 0, color: C.text }}>Inviter une PME</h3>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>La PME reçoit un email signé de votre cabinet</div>
            </div>
          </div>

          <FieldInput C={C} label="Email de la PME *" type="email" placeholder="contact@pme-cliente.ci"
            value={formInvit.email_pme} onChange={(v) => setFormInvit(f => ({ ...f, email_pme: v }))} />
          <div style={{ height: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldInput C={C} label="Nom de la PME (optionnel)" placeholder="Boutique Kone & Frères"
              value={formInvit.nom_pme} onChange={(v) => setFormInvit(f => ({ ...f, nom_pme: v }))} />
            <FieldInput C={C} label="WhatsApp (optionnel)" placeholder="+225 07 00 00 00 00"
              value={formInvit.telephone_pme} onChange={(v) => setFormInvit(f => ({ ...f, telephone_pme: v }))}
              hint="Permet de générer un lien wa.me" />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Remise proposée à la PME (1ère année)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <input type="range" min="0" max="50" value={formInvit.remise_proposee_pct}
                onChange={(e) => setFormInvit(f => ({ ...f, remise_proposee_pct: parseInt(e.target.value) }))}
                style={{ flex: 1, accentColor: C.cabinet }} />
              <div style={{ width: 70, textAlign: 'center', padding: '8px 12px', background: C.cardElev, border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: fontMono, fontWeight: 700, color: C.cabinet, fontSize: 14 }}>
                -{formInvit.remise_proposee_pct}%
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 14, background: C.cardElev, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
            La PME reçoit un email signé de <strong style={{ color: C.text }}>{info.nom}</strong>.
            Au clic, elle définit son mot de passe, son compte ApeX est créé avec le palier de son choix
            (remise <strong style={{ color: C.cabinet }}>-{formInvit.remise_proposee_pct}%</strong>) et votre cabinet
            est automatiquement connecté à son dossier.
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button onClick={() => setModalInviter(false)} disabled={actionLoading} style={btnSecondary(C)}>Annuler</button>
            <button onClick={inviterPme} disabled={actionLoading} style={btnPrimary(C)}>
              {actionLoading ? 'Envoi…' : 'Envoyer l\'invitation'}
              {!actionLoading && <Send size={14} />}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL SUCCÈS INVITATION */}
      {resultatInvit && (
        <Modal C={C} onClose={() => setResultatInvit(null)} large>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${C.cabinetGlow}` }}>
              <Check size={26} color="#FFF" strokeWidth={2.8} />
            </div>
            <div>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 800, margin: 0, color: C.text, letterSpacing: '-0.015em' }}>Invitation envoyée</h3>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                {resultatInvit.email_envoye
                  ? <>Email parti vers <strong style={{ color: C.text }}>{resultatInvit.email_pme}</strong></>
                  : <>Email indisponible — utilisez les liens ci-dessous</>}
              </div>
            </div>
          </div>

          {resultatInvit.email_envoye && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: `${C.accent}12`, border: `1px solid ${C.accent}40`, borderRadius: 10, marginBottom: 16 }}>
              <Mail size={16} color={C.accent} />
              <span style={{ fontSize: 13, color: C.text }}>Email d'invitation parti avec succès.</span>
            </div>
          )}

          <ResultatLigne C={C} icon={ExternalLink} label="Lien d'activation (30 jours)"
            value={resultatInvit.lien_invitation} mono small
            action={() => copier(resultatInvit.lien_invitation)} actionLabel="Copier" />

          {resultatInvit.telephone_pme && (
            <div style={{
              marginTop: 16, padding: 16,
              background: `linear-gradient(135deg, ${C.whatsapp}15, ${C.whatsapp}08)`,
              border: `1px solid ${C.whatsapp}40`, borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: C.whatsapp, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={18} color="#FFF" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Relayer sur WhatsApp</div>
                  <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>Message pré-rempli avec votre signature</div>
                </div>
                <a href={lienWhatsAppInvitation(resultatInvit)} target="_blank" rel="noopener noreferrer"
                  className="cab-action"
                  style={{
                    padding: '10px 16px', borderRadius: 10,
                    background: C.whatsapp, color: '#FFF', textDecoration: 'none',
                    fontFamily: fontUI, fontWeight: 700, fontSize: 13,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                  Ouvrir WhatsApp <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button onClick={() => setResultatInvit(null)} style={btnPrimary(C)}>Terminé</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KpiHero({ C, icon: Icon, accent, label, value, unit, sub, progress }) {
  return (
    <div className="cab-card" style={{
      position: 'relative', overflow: 'hidden',
      padding: 22, borderRadius: 16,
      background: C.card, border: `1px solid ${C.border}`,
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
        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6, textAlign: 'right' }}>{label}</div>
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
    }}>{initiale(nom)}</div>
  );
}

function Modal({ C, onClose, children, large }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 0.2s ease-out', overflowY: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: large ? 620 : 480,
        background: C.surface, border: `1px solid ${C.borderStrong}`,
        borderRadius: 18, padding: 28,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>{children}</div>
    </div>
  );
}

function FieldInput({ C, label, type = 'text', placeholder, value, onChange, hint }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: C.cardElev, border: `1px solid ${C.border}`,
          color: C.text, fontFamily: fontUI, fontSize: 13.5,
          outline: 'none', boxSizing: 'border-box',
        }} />
      {hint && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function ResultatLigne({ C, icon: Icon, label, value, mono, small, action, actionLabel }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: 14, background: C.cardElev,
      border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${C.cabinet}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={C.cabinet} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{
          fontSize: small ? 11.5 : 14, fontWeight: 600,
          color: C.text, fontFamily: mono ? fontMono : 'inherit',
          marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{value}</div>
      </div>
      {action && (
        <button onClick={action} className="cab-action" style={{
          padding: '7px 12px', borderRadius: 8,
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.text, fontFamily: fontUI, fontSize: 11.5, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        }}>
          <Copy size={11} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

const iconBtn = (C) => ({
  width: 32, height: 32, borderRadius: 8,
  background: C.cardElev, border: `1px solid ${C.border}`,
  color: C.sub, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const btnPrimary = (C) => ({
  padding: '10px 18px', borderRadius: 10,
  background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`,
  border: 'none', color: '#FFF',
  fontFamily: fontUI, fontWeight: 700, fontSize: 13,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  boxShadow: `0 4px 16px ${C.cabinetGlow}`,
});
const btnSecondary = (C) => ({
  padding: '10px 16px', borderRadius: 10,
  background: 'transparent', border: `1px solid ${C.border}`,
  color: C.sub, fontFamily: fontUI, fontWeight: 600, fontSize: 13, cursor: 'pointer',
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
    padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700,
    background: s.bg, color: s.color, fontFamily: 'inherit',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  };
};
