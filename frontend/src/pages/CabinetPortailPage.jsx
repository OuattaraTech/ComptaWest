import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Award, Copy, Check, X, Building2, Users, Mail, MessageCircle,
  RefreshCw, UserPlus, Send, ExternalLink, Search,
  Sparkles, Activity, Trash2, ArrowRight, Edit3, Tag, Calendar, AlertTriangle, Clock,
  AlertCircle, LayoutList, LayoutGrid, Filter, Download, Bell,
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

// Échappe une cellule CSV : double-quote si elle contient virgule/saut/guillemet
const cellCsv = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
// Télécharge un texte sous forme de fichier (Blob + a.download)
const downloadFile = (filename, content, mime = 'text/csv;charset=utf-8') => {
  // BOM UTF-8 pour qu'Excel ouvre proprement les accents français
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const gradientFromString = (str) => {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 65% 45%))`;
};

export default function CabinetPortailPage() {
  const { dark } = useTheme();
  const { actuelle, entreprises, switchEntreprise, chargerEntreprises } = useEntreprise();
  const navigate = useNavigate();
  const location = useLocation();
  const C = getC(dark);

  const [info, setInfo] = useState(null);
  const [clients, setClients] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [charge, setCharge] = useState({});
  // Filtres persistés en localStorage
  const [filtreTag, setFiltreTag] = useState(() => localStorage.getItem('cw_cab_f_tag') || '');
  const [filtreRegime, setFiltreRegime] = useState(() => localStorage.getItem('cw_cab_f_regime') || '');
  const [filtrePalier, setFiltrePalier] = useState(() => localStorage.getItem('cw_cab_f_palier') || '');
  const [vueCompacte, setVueCompacte] = useState(() => localStorage.getItem('cw_cab_v_compact') === '1');
  const [triParCharge, setTriParCharge] = useState(() => localStorage.getItem('cw_cab_v_tricharge') === '1');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalInviter, setModalInviter] = useState(false);
  const [resultatInvit, setResultatInvit] = useState(null);
  const [formInvit, setFormInvit] = useState({ email_pme: '', nom_pme: '', telephone_pme: '' });
  const REMISE_PARRAINAGE_PCT = 15;
  const [recherche, setRecherche] = useState('');
  const [clientEnEdition, setClientEnEdition] = useState(null);
  const [editTags, setEditTags] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [clientADetacher, setClientADetacher] = useState(null);
  const [confirmDetach, setConfirmDetach] = useState('');
  const [showRaccourcis, setShowRaccourcis] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLuesAt, setNotifLuesAt] = useState(() => localStorage.getItem('cw_cab_notif_lues') || '');
  const [selection, setSelection] = useState(new Set());
  const [confirmBatch, setConfirmBatch] = useState(false);

  useEffect(() => {
    if (actuelle && actuelle.type_compte !== 'cabinet_partenaire') {
      toast.error('Ce portail est réservé aux Cabinets Partenaires ApeX.');
      navigate('/dashboard');
    }
  }, [actuelle, navigate]);

  const fetchAll = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [i, c, inv, ech, ch, nt] = await Promise.all([
        api.get('/cabinets/me'),
        api.get('/cabinets/mes-clients'),
        api.get('/cabinets/invitations'),
        api.get('/cabinets/echeances-fiscales'),
        api.get('/cabinets/charge-clients'),
        api.get('/cabinets/notifications'),
      ]);
      setInfo(i.data.data);
      setClients(c.data.data);
      setInvitations(inv.data.data);
      setEcheances(ech.data.data);
      setCharge(ch.data.data || {});
      setNotifications(nt.data.data || []);
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

  // Persist filtres + vue dans localStorage
  useEffect(() => { localStorage.setItem('cw_cab_f_tag', filtreTag); }, [filtreTag]);
  useEffect(() => { localStorage.setItem('cw_cab_f_regime', filtreRegime); }, [filtreRegime]);
  useEffect(() => { localStorage.setItem('cw_cab_f_palier', filtrePalier); }, [filtrePalier]);
  useEffect(() => { localStorage.setItem('cw_cab_v_compact', vueCompacte ? '1' : '0'); }, [vueCompacte]);
  useEffect(() => { localStorage.setItem('cw_cab_v_tricharge', triParCharge ? '1' : '0'); }, [triParCharge]);

  // Scroll vers l'ancre passée dans l'URL (#clients, #calendrier,
  // #invitations) une fois les données chargées et le DOM rendu.
  useEffect(() => {
    if (loading || !location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [loading, location.hash]);

  // Raccourcis clavier (power-users). Ignorés quand on est dans un input
  // ou un textarea, ou si une modal bloquante est ouverte.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      if (modalInviter || resultatInvit || clientEnEdition || clientADetacher) return;
      switch (e.key) {
        case '/':
          e.preventDefault();
          document.querySelector('input[placeholder*="NCC"]')?.focus();
          break;
        case 'n': case 'N':
          e.preventDefault();
          setModalInviter(true);
          break;
        case 'r': case 'R':
          e.preventDefault();
          fetchAll(true);
          break;
        case 'c': case 'C':
          e.preventDefault();
          setVueCompacte(v => !v);
          break;
        case '?':
          e.preventDefault();
          setShowRaccourcis(true);
          break;
        case 'Escape':
          setShowRaccourcis(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalInviter, resultatInvit, clientEnEdition, clientADetacher]);

  const invitationsPending = useMemo(() => invitations.filter(i => i.statut === 'pending'), [invitations]);
  const invitationsHistorique = useMemo(() => invitations.filter(i => i.statut !== 'pending'), [invitations]);
  const tauxConv = invitations.length > 0
    ? Math.round((invitations.filter(i => i.statut === 'accepted').length / invitations.length) * 1000) / 10
    : 0;

  // Liste unique de tags pour le filtre dropdown
  const tagsConnus = useMemo(() => {
    const s = new Set();
    for (const c of clients) for (const t of c.tags || []) s.add(t);
    return [...s].sort();
  }, [clients]);

  const clientsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    let out = clients.filter(c => {
      if (q && !(c.pme_nom || '').toLowerCase().includes(q) && !(c.ncc || '').toLowerCase().includes(q)) return false;
      if (filtreTag && !(c.tags || []).includes(filtreTag)) return false;
      if (filtreRegime && c.regime_fiscal !== filtreRegime) return false;
      if (filtrePalier && (c.palier || '').toLowerCase() !== filtrePalier.toLowerCase()) return false;
      return true;
    });
    if (triParCharge) {
      out = [...out].sort((a, b) => (charge[b.pme_id]?.total || 0) - (charge[a.pme_id]?.total || 0));
    }
    return out;
  }, [clients, recherche, filtreTag, filtreRegime, filtrePalier, triParCharge, charge]);

  const copier = (txt) => { navigator.clipboard.writeText(txt); toast.success('Copié'); };

  // Bascule vers le dossier du client. On récupère la liste fraîche
  // d'entreprises via l'API (incluant les PME connectées au cabinet,
  // cf. getMesEntreprises backend), on trouve la PME ciblée, on la
  // sélectionne via switchEntreprise, puis on navigue vers /dashboard
  // où le cabinet retrouve tous les menus PME.
  const accederAuDossier = async (pme_id, pme_nom) => {
    try {
      const res = await api.get('/entreprises');
      const liste = res.data?.data || [];
      const cible = liste.find(e => e.id === pme_id);
      if (!cible) {
        toast.error('Dossier introuvable. La connexion cabinet↔PME n\'est peut-être plus active.');
        return;
      }
      // switchEntreprise déclenche un full reload vers /dashboard pour
      // que le nouveau contexte (permissions, quotas, données page) soit
      // correctement chargé. Pas besoin de navigate manuel.
      toast.success(`Dossier ${pme_nom} ouvert`);
      switchEntreprise(cible, '/dashboard');
    } catch (err) {
      console.error('accederAuDossier:', err);
      toast.error(err.response?.data?.message || 'Impossible d\'accéder au dossier');
    }
  };

  const ouvrirEditionAnnotations = (c) => {
    setClientEnEdition(c);
    setEditTags((c.tags || []).join(', '));
    setEditNotes(c.notes_privees || '');
  };

  // Page de déclaration cible selon le type d'échéance (heuristique)
  const pageDeclarationPour = (type) => {
    switch (type) {
      case 'ITS':  return '/paie';
      case 'TVA':  return '/taxes';
      case 'CNPS': return '/paie';
      case 'IS':   return '/taxes';
      case 'DSF':  return '/comptabilite';
      default:     return '/dashboard';
    }
  };

  // Clic sur une échéance du calendrier : ouvre directement la page
  // de déclaration concernée dans le dossier de la PME ciblée.
  const ouvrirDeclaration = (pme_id, type) => {
    const cible = (clients.find(c => c.pme_id === pme_id) && entreprises.find(e => e.id === pme_id));
    if (!cible) {
      toast.error('Dossier introuvable');
      return;
    }
    switchEntreprise(cible, pageDeclarationPour(type));
  };

  // Notifications non lues = celles dont la date est postérieure au
  // dernier marquage lu. Persisté en localStorage.
  const notifNonLues = useMemo(() => {
    if (!notifLuesAt) return notifications.length;
    return notifications.filter(n => new Date(n.at) > new Date(notifLuesAt)).length;
  }, [notifications, notifLuesAt]);

  const marquerToutesLues = () => {
    const maintenant = new Date().toISOString();
    setNotifLuesAt(maintenant);
    localStorage.setItem('cw_cab_notif_lues', maintenant);
  };

  const toggleSelection = (connectionId) => {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(connectionId)) next.delete(connectionId);
      else next.add(connectionId);
      return next;
    });
  };
  const toutSelectionner = () => {
    setSelection(new Set(clientsFiltres.map(c => c.connection_id)));
  };
  const toutDeselectionner = () => setSelection(new Set());

  const detacherBatch = async () => {
    setActionLoading(true);
    try {
      const ids = [...selection];
      await Promise.all(ids.map(id => api.delete(`/cabinets/connections/${id}`)));
      toast.success(`${ids.length} client(s) détaché(s)`);
      setSelection(new Set());
      setConfirmBatch(false);
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors du détachement');
    } finally {
      setActionLoading(false);
    }
  };

  const exporterClientsCsv = () => {
    const lignes = ['Nom PME,NCC,Régime fiscal,Secteur,Palier,Tags,Charge,Date de connexion,Notes'];
    for (const c of clientsFiltres) {
      const ch = charge[c.pme_id]?.total || 0;
      lignes.push([
        cellCsv(c.pme_nom),
        cellCsv(c.ncc),
        cellCsv(c.regime_fiscal),
        cellCsv(c.secteur),
        cellCsv(c.palier),
        cellCsv((c.tags || []).join('; ')),
        cellCsv(ch),
        cellCsv(c.active_at?.slice(0, 10)),
        cellCsv((c.notes_privees || '').replace(/\n/g, ' / ')),
      ].join(','));
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`apex-clients-${info.code_parrain}-${date}.csv`, lignes.join('\n'));
    toast.success(`${clientsFiltres.length} client(s) exporté(s)`);
  };

  const exporterCalendrierCsv = () => {
    const lignes = ['Date,Type,Libellé,PME,Sévérité'];
    for (const e of echeances) {
      lignes.push([
        cellCsv(e.date),
        cellCsv(e.type),
        cellCsv(e.label),
        cellCsv(e.pme_nom),
        cellCsv(e.severite),
      ].join(','));
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`apex-calendrier-${info.code_parrain}-${date}.csv`, lignes.join('\n'));
    toast.success(`${echeances.length} échéance(s) exportée(s)`);
  };

  const marquerEcheanceFaite = async (e) => {
    try {
      await api.post('/cabinets/echeances/marquer-faite', { pme_id: e.pme_id, type: e.type, periode: e.date });
      toast.success('Échéance marquée comme déclarée');
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  const enregistrerAnnotations = async () => {
    if (!clientEnEdition) return;
    setActionLoading(true);
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      await api.patch(`/cabinets/connections/${clientEnEdition.connection_id}`, {
        tags, notes_privees: editNotes || null,
      });
      toast.success('Annotations enregistrées');
      setClientEnEdition(null);
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const inviterPme = async () => {
    if (!formInvit.email_pme.trim()) { toast.error('Email obligatoire'); return; }
    setActionLoading(true);
    try {
      const { data } = await api.post('/cabinets/inviter-pme', formInvit);
      setResultatInvit({ ...data.data, nom_cabinet: info.nom });
      setModalInviter(false);
      setFormInvit({ email_pme: '', nom_pme: '', telephone_pme: '' });
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

  const detacherClient = (connectionId, nomPme) => {
    // Ouvre une modal de confirmation premium (saisie du nom de la PME)
    // au lieu d'un confirm() natif. L'action étant destructive
    // (perte de l'accès au dossier, révocation des invitations…), on
    // exige une confirmation explicite par typing.
    setClientADetacher({ connection_id: connectionId, pme_nom: nomPme });
    setConfirmDetach('');
  };

  const confirmerDetacher = async () => {
    if (!clientADetacher) return;
    setActionLoading(true);
    try {
      await api.delete(`/cabinets/connections/${clientADetacher.connection_id}`);
      toast.success(`${clientADetacher.pme_nom} détaché de votre cabinet`);
      setClientADetacher(null);
      setConfirmDetach('');
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const lienWhatsAppInvitation = (invitation) => {
    if (!invitation.telephone_pme) return null;
    const phone = invitation.telephone_pme.replace(/[^\d+]/g, '').replace(/^\+/, '');
    const lien = `${window.location.origin}/rejoindre/${invitation.token}`;
    const msg = `Bonjour${invitation.nom_pme ? ' ' + invitation.nom_pme : ''},\n\n${info.nom} vous invite à rejoindre ApeX (logiciel de gestion comptable SYSCOHADA) avec une remise de ${REMISE_PARRAINAGE_PCT}% la 1ère année.\n\nActivez votre compte : ${lien}\n\nÀ très vite !`;
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
        padding: 'clamp(14px, 2.5vw, 22px) clamp(16px, 4vw, 40px)',
      }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            {/* CLOCHE DE NOTIFICATIONS */}
            <button onClick={() => { setNotifOpen(o => !o); if (!notifOpen) marquerToutesLues(); }}
              title={`${notifNonLues} notification(s) non lue(s)`}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: 10,
                background: C.surface, border: `1px solid ${C.border}`,
                color: notifNonLues > 0 ? C.cabinet : C.sub, cursor: 'pointer',
              }}>
              <Bell size={16} />
              {notifNonLues > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
                  background: C.danger, color: '#FFF',
                  fontSize: 9.5, fontWeight: 800, fontFamily: fontMono,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${C.surface}`,
                }}>{notifNonLues > 9 ? '9+' : notifNonLues}</span>
              )}
            </button>
            {/* Dropdown notifications */}
            {notifOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
                width: 360, maxHeight: 460, overflowY: 'auto',
                background: C.surface, border: `1px solid ${C.borderStrong}`, borderRadius: 12,
                boxShadow: dark ? '0 20px 48px rgba(0,0,0,0.5)' : '0 20px 48px rgba(0,0,0,0.15)',
              }}>
                <div style={{
                  padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontFamily: fontDisplay, fontSize: 14, fontWeight: 800, color: C.text }}>Notifications</span>
                  <span style={{ fontSize: 10.5, color: C.muted }}>{notifications.length} récente(s)</span>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: C.muted, fontSize: 12.5 }}>
                    Aucune activité récente
                  </div>
                ) : notifications.map((n, idx) => {
                  const icone = n.type === 'invitation_acceptee' ? Check
                              : n.type === 'connexion_nouvelle' ? UserPlus
                              : AlertTriangle;
                  const couleur = n.type === 'echeance_retard' ? C.danger
                                : n.type === 'invitation_acceptee' ? C.accent
                                : C.info;
                  const Ic = icone;
                  return (
                    <div key={idx} style={{
                      padding: '12px 16px',
                      borderBottom: idx < notifications.length - 1 ? `1px solid ${C.border}` : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: `${couleur}18`, color: couleur,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}><Ic size={14} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{n.titre}</div>
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{n.sub}</div>
                        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3, fontFamily: fontMono }}>
                          {new Date(n.at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: 'clamp(20px, 3vw, 32px) clamp(16px, 4vw, 40px) 64px' }}>

        {/* BANDEAU CODE PARRAIN — compact (info statique, ne doit pas
            dominer le fold ; les KPIs et le calendrier passent au-dessus) */}
        <div className="cab-card" style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          padding: '10px 14px', borderRadius: 12,
          background: `linear-gradient(90deg, ${C.cabinet}12, ${C.accent}08)`,
          border: `1px solid ${C.cabinet}40`,
          marginBottom: 20,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: `${C.cabinet}25`, color: C.cabinet,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Award size={14} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase' }}>
              Code parrain
            </span>
            <span style={{ fontFamily: fontMono, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '0.04em' }}>
              {info.code_parrain}
            </span>
          </div>
          <button onClick={() => copier(info.code_parrain)} className="cab-action"
            title="Copier le code parrain"
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.sub, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
            <Copy size={12} />
          </button>
          <div style={{ flex: 1, fontSize: 11.5, color: C.sub, lineHeight: 1.4, minWidth: 180 }}>
            Signature de votre cabinet — à mentionner sur vos communications. Les PME parrainées bénéficient automatiquement d'une remise.
          </div>
        </div>

        {/* ONBOARDING — affiché si cabinet vide (aucun client + aucune invitation) */}
        {clients.length === 0 && invitations.length === 0 && (
          <div className="cab-card" style={{
            position: 'relative', overflow: 'hidden',
            padding: 'clamp(28px, 4vw, 48px)', borderRadius: 18,
            background: `linear-gradient(135deg, ${C.cabinet}15, ${C.accent}08)`,
            border: `1px solid ${C.cabinet}50`,
            marginBottom: 24, textAlign: 'center',
          }}>
            <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle, ${C.cabinet}25, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, margin: '0 auto 18px',
                background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`,
                color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 12px 32px ${C.cabinetGlow}`,
              }}>
                <Sparkles size={30} strokeWidth={2.2} />
              </div>
              <h2 style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 800, margin: 0, color: C.text, letterSpacing: '-0.02em' }}>
                Bienvenue dans votre portail cabinet
              </h2>
              <p style={{ fontSize: 14, color: C.sub, marginTop: 10, marginBottom: 24, lineHeight: 1.6 }}>
                Vous êtes prêt à accompagner vos premiers clients PME. Invitez-les en quelques secondes
                et votre cabinet sera automatiquement connecté à leur dossier comptable.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28, textAlign: 'left' }}>
                {[
                  { n: 1, t: 'Invitez', d: 'Saisissez nom + email de votre client PME' },
                  { n: 2, t: 'PME accepte', d: 'Elle reçoit un mail signé de votre cabinet et active son compte' },
                  { n: 3, t: 'Vous accédez', d: 'Vous travaillez sur son dossier comme expert-comptable' },
                ].map(s => (
                  <div key={s.n} style={{
                    padding: 14, background: C.card,
                    border: `1px solid ${C.border}`, borderRadius: 11,
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: `${C.cabinet}20`, color: C.cabinet,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 12, marginBottom: 8,
                    }}>{s.n}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.t}</div>
                    <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.4 }}>{s.d}</div>
                  </div>
                ))}
              </div>

              <button onClick={() => setModalInviter(true)} className="cab-action" style={{
                padding: '14px 28px', borderRadius: 12,
                background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`,
                border: 'none', color: '#FFF',
                fontFamily: fontUI, fontWeight: 700, fontSize: 14,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: `0 8px 24px ${C.cabinetGlow}`,
              }}>
                <Send size={15} /> Inviter votre premier client
              </button>
              <div style={{ marginTop: 14, fontSize: 11, color: C.muted }}>
                Code parrain : <span style={{ fontFamily: fontMono, color: C.cabinet, fontWeight: 700 }}>{info.code_parrain}</span>
                {' · '}Astuce : appuyez sur <kbd style={{ fontFamily: fontMono, padding: '1px 6px', background: C.cardElev, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 10 }}>N</kbd> à tout moment pour inviter
              </div>
            </div>
          </div>
        )}

        {/* HERO KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
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
        </div>

        {/* SECTION CLIENTS PME */}
        <div id="clients" style={{ scrollMarginTop: 90 }} />
        <Section C={C} icon={Building2} accent={C.cabinet}
          title="Mes clients PME"
          count={`${clientsFiltres.length}${clientsFiltres.length !== clients.length ? ` / ${clients.length}` : ''}`}
          right={clients.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setTriParCharge(t => !t)} title="Trier par charge décroissante"
                style={{ ...iconBtn(C), width: 'auto', padding: '0 10px', fontSize: 11.5, fontWeight: 600, color: triParCharge ? C.cabinet : C.sub, background: triParCharge ? `${C.cabinet}18` : C.cardElev, border: `1px solid ${triParCharge ? C.cabinet + '55' : C.border}` }}>
                <AlertCircle size={12} /> Charge
              </button>
              <button onClick={() => setVueCompacte(v => !v)} title="Basculer cards / table compacte"
                style={iconBtn(C)}>
                {vueCompacte ? <LayoutGrid size={13} /> : <LayoutList size={13} />}
              </button>
              <button onClick={exporterClientsCsv} title="Exporter en CSV"
                style={iconBtn(C)}>
                <Download size={13} />
              </button>
            </div>
          )}
        >
          {clients.length > 0 && (
            <FiltresBar C={C}
              recherche={recherche} setRecherche={setRecherche}
              filtreTag={filtreTag} setFiltreTag={setFiltreTag} tagsConnus={tagsConnus}
              filtreRegime={filtreRegime} setFiltreRegime={setFiltreRegime}
              filtrePalier={filtrePalier} setFiltrePalier={setFiltrePalier} />
          )}
          {clientsFiltres.length === 0 ? (
            <EmptyState C={C} icon={Building2}
              text={clients.length === 0 ? 'Aucun client PME pour l\'instant' : 'Aucun client ne correspond aux filtres'}
              sub={clients.length === 0 ? 'Cliquez sur « Inviter une PME » pour ajouter votre premier client' : 'Ajustez ou réinitialisez les filtres'} />
          ) : vueCompacte ? (
            <TableCompacteClients C={C} clients={clientsFiltres} charge={charge}
              selection={selection} onToggleSelect={toggleSelection}
              onToutSelectionner={toutSelectionner} onToutDeselectionner={toutDeselectionner}
              onOuvrir={accederAuDossier} onAnnoter={ouvrirEditionAnnotations} onDetacher={detacherClient} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clientsFiltres.map((c, idx) => (
                <div key={c.connection_id} className="cab-card cab-row" style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16,
                  padding: 16, background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  animationDelay: `${idx * 0.04}s`,
                }}>
                  <Avatar C={C} nom={c.pme_nom} size={44} />
                  <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: fontDisplay, fontSize: 15, fontWeight: 700, color: C.text }}>{c.pme_nom}</span>
                      <ChargeBadge C={C} charge={charge[c.pme_id]} />
                      {c.regime_fiscal && <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, padding: '2px 7px', borderRadius: 4, background: C.cardElev }}>{c.regime_fiscal}</span>}
                      {c.palier && <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, padding: '2px 7px', borderRadius: 4, background: `${C.accent}18` }}>{c.palier.toUpperCase()}</span>}
                      {(c.tags || []).map((tag, ti) => (
                        <span key={ti} style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: `${C.cabinet}18`, color: C.cabinet,
                          border: `1px solid ${C.cabinet}40`, fontFamily: 'inherit',
                        }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 11.5, color: C.sub, flexWrap: 'wrap' }}>
                      {c.ncc && <span style={{ fontFamily: fontMono }}>NCC {c.ncc}</span>}
                      {c.secteur && <><span>·</span><span>{c.secteur}</span></>}
                      {c.remise_parrainage_pct > 0 && <><span>·</span><span>Remise <strong style={{ color: C.cabinet }}>{c.remise_parrainage_pct}%</strong></span></>}
                      <span>·</span>
                      <span>Connecté {formatDate(c.active_at)}</span>
                    </div>
                    {c.notes_privees && (
                      <div style={{
                        marginTop: 8, padding: '6px 10px', background: C.cardElev,
                        borderLeft: `3px solid ${C.cabinet}`, borderRadius: 6,
                        fontSize: 11.5, color: C.sub, fontStyle: 'italic',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>« {c.notes_privees} »</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
                    <button onClick={() => ouvrirEditionAnnotations(c)} className="cab-action" title="Annoter (tags + notes)"
                      style={iconBtn(C)}><Edit3 size={13} /></button>
                    <button onClick={() => detacherClient(c.connection_id, c.pme_nom)} className="cab-action" title="Détacher"
                      style={{ ...iconBtn(C), color: C.danger }}><Trash2 size={13} /></button>
                    <button onClick={() => accederAuDossier(c.pme_id, c.pme_nom)} className="cab-action" style={{
                      padding: '8px 14px', borderRadius: 9,
                      background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`,
                      border: 'none', color: '#FFF', fontFamily: fontUI,
                      fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                      boxShadow: `0 4px 12px ${C.cabinetGlow}`,
                    }}>
                      Accéder au dossier <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* SECTION CALENDRIER FISCAL */}
        <div id="calendrier" style={{ scrollMarginTop: 90 }} />
        <Section C={C} icon={Calendar} accent={C.info} title="Calendrier fiscal" count={echeances.length}
          right={echeances.length > 0 && (
            <button onClick={exporterCalendrierCsv} title="Exporter le calendrier en CSV"
              style={iconBtn(C)}>
              <Download size={13} />
            </button>
          )}>
          {echeances.length === 0 ? (
            <EmptyState C={C} icon={Calendar}
              text="Aucune échéance dans les 60 prochains jours"
              sub={clients.length === 0 ? 'Invitez votre premier client pour voir son calendrier fiscal' : 'Vos clients sont à jour'} />
          ) : (
            <CalendrierFiscal C={C} echeances={echeances}
              onOuvrirDeclaration={ouvrirDeclaration}
              onMarquerFaite={marquerEcheanceFaite} />
          )}
        </Section>

        {/* SECTION INVITATIONS PENDING */}
        <div id="invitations" style={{ scrollMarginTop: 90 }} />
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
          {' · '}
          <button onClick={() => setShowRaccourcis(true)} style={{
            background: 'none', border: 'none', color: C.muted, fontFamily: 'inherit',
            fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline',
          }} title="Afficher les raccourcis clavier (?)">
            Raccourcis clavier
          </button>
        </div>
      </div>

      {/* MODAL ÉDITION ANNOTATIONS (tags + notes) */}
      {clientEnEdition && (
        <Modal C={C} onClose={() => !actionLoading && setClientEnEdition(null)} large>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <Avatar C={C} nom={clientEnEdition.pme_nom} size={44} />
            <div>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 800, margin: 0, color: C.text }}>Annotations privées</h3>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{clientEnEdition.pme_nom} · invisible pour la PME</div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Tags (séparés par virgule, max 10)
            </label>
            <input value={editTags} onChange={(e) => setEditTags(e.target.value)}
              placeholder="VIP, urgent, paie, prospect…"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: C.cardElev, border: `1px solid ${C.border}`,
                color: C.text, fontFamily: fontUI, fontSize: 13.5,
                outline: 'none', boxSizing: 'border-box',
              }} />
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>Ex : « VIP, paie urgente » — apparaît en badges or sur la card du client.</div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Notes privées
            </label>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
              placeholder="ex: à relancer pour les pièces de février, dossier complexe, attendre dépôt DSF avant…"
              rows={5}
              style={{
                width: '100%', padding: 12, borderRadius: 10,
                background: C.cardElev, border: `1px solid ${C.border}`,
                color: C.text, fontFamily: fontUI, fontSize: 13,
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }} />
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>Stockées uniquement pour votre cabinet. La PME ne les voit jamais.</div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button onClick={() => setClientEnEdition(null)} disabled={actionLoading} style={btnSecondary(C)}>Annuler</button>
            <button onClick={enregistrerAnnotations} disabled={actionLoading} style={btnPrimary(C)}>
              {actionLoading ? 'Enregistrement…' : 'Enregistrer'}
              {!actionLoading && <Check size={14} />}
            </button>
          </div>
        </Modal>
      )}

      {/* BARRE FLOTTANTE DE SÉLECTION (batch actions) */}
      {selection.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 150,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 18px', borderRadius: 14,
          background: C.surface, border: `1px solid ${C.borderStrong}`,
          boxShadow: dark ? '0 16px 48px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.18)',
          maxWidth: '95vw',
        }}>
          <span style={{
            padding: '4px 10px', borderRadius: 6,
            background: `${C.cabinet}25`, color: C.cabinet,
            fontFamily: fontMono, fontWeight: 800, fontSize: 12,
          }}>{selection.size}</span>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
            client(s) sélectionné(s)
          </span>
          <button onClick={() => setConfirmBatch(true)} className="cab-action" style={{
            padding: '8px 14px', borderRadius: 9,
            background: C.danger, border: 'none', color: '#FFF',
            fontFamily: fontUI, fontWeight: 700, fontSize: 12.5,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Trash2 size={12} /> Détacher la sélection
          </button>
          <button onClick={toutDeselectionner} style={{
            padding: '8px 12px', borderRadius: 9,
            background: 'transparent', border: `1px solid ${C.border}`, color: C.sub,
            fontFamily: fontUI, fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>Annuler</button>
        </div>
      )}

      {/* MODAL CONFIRMATION BATCH DÉTACHER */}
      {confirmBatch && (
        <Modal C={C} onClose={() => !actionLoading && setConfirmBatch(false)} large>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.danger}18`, border: `1px solid ${C.danger}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} color={C.danger} strokeWidth={2.4} />
            </div>
            <div>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 800, margin: 0, color: C.text }}>Détacher {selection.size} client(s)</h3>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>Action irréversible et appliquée en série</div>
            </div>
          </div>
          <div style={{ padding: 14, background: C.cardElev, border: `1px solid ${C.border}`, borderRadius: 11, fontSize: 13, color: C.sub, lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
            Liste à détacher :
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: C.text }}>
              {clientsFiltres.filter(c => selection.has(c.connection_id)).map(c => (
                <li key={c.connection_id}>{c.pme_nom}</li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: C.muted }}>
            Chaque PME garde son compte et ses données. Vous perdez l'accès à leur dossier.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmBatch(false)} disabled={actionLoading} style={btnSecondary(C)}>Annuler</button>
            <button onClick={detacherBatch} disabled={actionLoading} style={{
              padding: '10px 18px', borderRadius: 10,
              background: C.danger, border: 'none', color: '#FFF',
              fontFamily: fontUI, fontWeight: 700, fontSize: 13,
              cursor: actionLoading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {actionLoading ? 'Détachement…' : `Confirmer (${selection.size})`}
              {!actionLoading && <Trash2 size={14} />}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL RACCOURCIS CLAVIER */}
      {showRaccourcis && (
        <Modal C={C} onClose={() => setShowRaccourcis(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.cabinet}18`, color: C.cabinet, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ⌨
            </div>
            <h3 style={{ fontFamily: fontDisplay, fontSize: 18, fontWeight: 800, margin: 0, color: C.text }}>Raccourcis clavier</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { k: '/', desc: 'Focus sur la recherche clients' },
              { k: 'N', desc: 'Inviter une PME' },
              { k: 'R', desc: 'Rafraîchir les données' },
              { k: 'C', desc: 'Basculer vue cards / table compacte' },
              { k: '?', desc: 'Afficher cette aide' },
              { k: 'Esc', desc: 'Fermer une modal' },
            ].map(({ k, desc }) => (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: C.cardElev, borderRadius: 9,
                border: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 13, color: C.text }}>{desc}</span>
                <kbd style={{
                  fontFamily: fontMono, fontSize: 12, fontWeight: 700,
                  padding: '3px 9px', borderRadius: 6,
                  background: C.surface, border: `1px solid ${C.border}`,
                  color: C.cabinet, minWidth: 32, textAlign: 'center',
                }}>{k}</kbd>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: C.muted, textAlign: 'center' }}>
            Les raccourcis sont désactivés quand vous tapez dans un champ.
          </div>
        </Modal>
      )}

      {/* MODAL DÉTACHER CLIENT — confirmation par saisie du nom */}
      {clientADetacher && (
        <Modal C={C} onClose={() => !actionLoading && setClientADetacher(null)} large>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.danger}18`, border: `1px solid ${C.danger}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} color={C.danger} strokeWidth={2.4} />
            </div>
            <div>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 800, margin: 0, color: C.text }}>Détacher ce client</h3>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>Action irréversible</div>
            </div>
          </div>

          <div style={{ padding: 16, background: C.cardElev, border: `1px solid ${C.border}`, borderRadius: 11, fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 16 }}>
            En détachant <strong style={{ color: C.text }}>{clientADetacher.pme_nom}</strong> :
            <ul style={{ margin: '10px 0 0', paddingLeft: 20, color: C.text }}>
              <li>Vous perdez l'accès à son dossier (compta, factures, paie, etc.)</li>
              <li>Toutes les invitations pending vers cette PME sont révoquées</li>
              <li>La PME garde son compte ApeX et toutes ses données — elle continue de fonctionner normalement</li>
              <li>Pour vous reconnecter, il faudra l'inviter à nouveau et qu'elle accepte</li>
            </ul>
          </div>

          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Pour confirmer, saisissez « <span style={{ color: C.text, fontFamily: fontMono }}>{clientADetacher.pme_nom}</span> »
          </label>
          <input value={confirmDetach} onChange={(e) => setConfirmDetach(e.target.value)}
            placeholder={clientADetacher.pme_nom}
            autoFocus
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10,
              background: C.cardElev, border: `1px solid ${confirmDetach === clientADetacher.pme_nom ? C.danger : C.border}`,
              color: C.text, fontFamily: fontUI, fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
            }} />

          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button onClick={() => setClientADetacher(null)} disabled={actionLoading} style={btnSecondary(C)}>Annuler</button>
            <button onClick={confirmerDetacher}
              disabled={actionLoading || confirmDetach !== clientADetacher.pme_nom}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: confirmDetach === clientADetacher.pme_nom ? C.danger : C.cardElev,
                border: 'none',
                color: confirmDetach === clientADetacher.pme_nom ? '#FFF' : C.muted,
                fontFamily: fontUI, fontWeight: 700, fontSize: 13,
                cursor: confirmDetach === clientADetacher.pme_nom && !actionLoading ? 'pointer' : 'not-allowed',
                opacity: confirmDetach === clientADetacher.pme_nom ? 1 : 0.6,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              {actionLoading ? 'Détachement…' : 'Confirmer le détachement'}
              {!actionLoading && confirmDetach === clientADetacher.pme_nom && <Trash2 size={14} />}
            </button>
          </div>
        </Modal>
      )}

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
          <div style={{
            marginTop: 14, padding: 14,
            background: `linear-gradient(135deg, ${C.cabinet}14, ${C.cabinet}05)`,
            border: `1px solid ${C.cabinet}40`, borderRadius: 11,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              minWidth: 64, padding: '10px 12px', textAlign: 'center',
              background: C.surface, border: `1px solid ${C.cabinet}55`, borderRadius: 10,
              fontFamily: fontMono, fontWeight: 800, color: C.cabinet, fontSize: 18,
            }}>
              -{REMISE_PARRAINAGE_PCT}%
            </div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
              <strong style={{ color: C.text }}>Remise ApeX la 1ère année</strong> — appliquée automatiquement à toutes les PME que vous parrainez. Valeur définie par ApeX, non modifiable.
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 14, background: C.cardElev, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
            La PME reçoit un email signé de <strong style={{ color: C.text }}>{info.nom}</strong>.
            Au clic, elle définit son mot de passe, son compte ApeX est créé avec le palier
            de son choix (remise <strong style={{ color: C.cabinet }}>-{REMISE_PARRAINAGE_PCT}%</strong> appliquée)
            et votre cabinet est automatiquement connecté à son dossier.
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

function ChargeBadge({ C, charge }) {
  if (!charge || !charge.total) return null;
  const tooltip = [
    charge.factures_brouillon > 0 && `${charge.factures_brouillon} facture(s) en brouillon`,
    charge.depenses_en_attente > 0 && `${charge.depenses_en_attente} dépense(s) à comptabiliser`,
    charge.echeances_proches > 0 && `${charge.echeances_proches} échéance(s) fiscale(s) dans 7 j`,
  ].filter(Boolean).join(' · ');
  return (
    <span title={tooltip} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10.5, fontWeight: 800,
      padding: '2px 7px 2px 6px', borderRadius: 10,
      background: `${C.danger}25`, color: C.danger,
      border: `1px solid ${C.danger}50`, cursor: 'help',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <AlertCircle size={10} /> {charge.total}
    </span>
  );
}

function FiltresBar({ C, recherche, setRecherche, filtreTag, setFiltreTag, tagsConnus, filtreRegime, setFiltreRegime, filtrePalier, setFiltrePalier }) {
  const reset = () => { setRecherche(''); setFiltreTag(''); setFiltreRegime(''); setFiltrePalier(''); };
  const hasFilters = recherche || filtreTag || filtreRegime || filtrePalier;
  const inputBase = {
    padding: '8px 10px', borderRadius: 9,
    background: C.surface, border: `1px solid ${C.border}`,
    color: C.text, fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
  };
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      marginBottom: 14, padding: 10, background: C.card,
      border: `1px solid ${C.border}`, borderRadius: 12,
    }}>
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
        <Search size={13} color={C.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Nom ou NCC…"
          style={{ ...inputBase, width: '100%', padding: '8px 10px 8px 30px', boxSizing: 'border-box' }} />
      </div>
      <select value={filtreTag} onChange={(e) => setFiltreTag(e.target.value)} style={inputBase}>
        <option value="">Tous tags</option>
        {tagsConnus.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={filtreRegime} onChange={(e) => setFiltreRegime(e.target.value)} style={inputBase}>
        <option value="">Tous régimes</option>
        <option value="RNI">RNI</option>
        <option value="RSI">RSI</option>
        <option value="RNL">RNL</option>
      </select>
      <select value={filtrePalier} onChange={(e) => setFiltrePalier(e.target.value)} style={inputBase}>
        <option value="">Tous paliers</option>
        <option value="decouverte">Découverte</option>
        <option value="starter">Starter</option>
        <option value="pro">Pro</option>
      </select>
      {hasFilters && (
        <button onClick={reset} style={{
          padding: '8px 12px', borderRadius: 9,
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.muted, fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        }}><X size={11} /> Réinitialiser</button>
      )}
    </div>
  );
}

function TableCompacteClients({ C, clients, charge, selection, onToggleSelect, onToutSelectionner, onToutDeselectionner, onOuvrir, onAnnoter, onDetacher }) {
  const tousSelectionnes = clients.length > 0 && clients.every(c => selection?.has(c.connection_id));
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 740, borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: C.cardElev, borderBottom: `1px solid ${C.border}` }}>
            <th style={{ ...thStyle(C), width: 32, paddingRight: 0 }}>
              <input type="checkbox" checked={tousSelectionnes}
                onChange={() => tousSelectionnes ? onToutDeselectionner() : onToutSelectionner()}
                style={{ cursor: 'pointer', accentColor: C.cabinet }} />
            </th>
            <th style={thStyle(C)}>Client</th>
            <th style={thStyle(C)}>Régime</th>
            <th style={thStyle(C)}>Palier</th>
            <th style={thStyle(C)}>Tags</th>
            <th style={{ ...thStyle(C), textAlign: 'center' }}>Charge</th>
            <th style={thStyle(C)}>Connecté</th>
            <th style={{ ...thStyle(C), textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const sel = selection?.has(c.connection_id);
            return (
            <tr key={c.connection_id} className="cab-row" style={{
              borderBottom: `1px solid ${C.border}`,
              background: sel ? `${C.cabinet}10` : 'transparent',
            }}>
              <td style={{ padding: '10px 12px', paddingRight: 0 }}>
                <input type="checkbox" checked={!!sel}
                  onChange={() => onToggleSelect(c.connection_id)}
                  style={{ cursor: 'pointer', accentColor: C.cabinet }} />
              </td>
              <td style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar C={C} nom={c.pme_nom} size={28} />
                  <div style={{ fontWeight: 600, color: C.text }}>{c.pme_nom}</div>
                </div>
              </td>
              <td style={{ padding: '10px 12px', color: C.sub }}>{c.regime_fiscal || '—'}</td>
              <td style={{ padding: '10px 12px' }}>
                {c.palier && <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, padding: '2px 7px', borderRadius: 4, background: `${C.accent}18` }}>{c.palier.toUpperCase()}</span>}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(c.tags || []).slice(0, 3).map((t, i) => (
                    <span key={i} style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: `${C.cabinet}18`, color: C.cabinet }}>{t}</span>
                  ))}
                  {(c.tags || []).length > 3 && <span style={{ fontSize: 10, color: C.muted }}>+{c.tags.length - 3}</span>}
                </div>
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                <ChargeBadge C={C} charge={charge[c.pme_id]} />
              </td>
              <td style={{ padding: '10px 12px', color: C.muted, fontSize: 11.5 }}>
                {new Date(c.active_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', gap: 5 }}>
                  <button onClick={() => onAnnoter(c)} title="Annoter" style={iconBtnTable(C)}><Edit3 size={12} /></button>
                  <button onClick={() => onDetacher(c.connection_id, c.pme_nom)} title="Détacher" style={{ ...iconBtnTable(C), color: C.danger }}><Trash2 size={12} /></button>
                  <button onClick={() => onOuvrir(c.pme_id, c.pme_nom)} title="Accéder au dossier" style={{
                    padding: '5px 10px', borderRadius: 7,
                    background: `linear-gradient(135deg, ${C.cabinet}, ${C.accent})`,
                    border: 'none', color: '#FFF', fontFamily: 'inherit', fontWeight: 700, fontSize: 11,
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>Ouvrir <ArrowRight size={10} /></button>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = (C) => ({
  padding: '8px 12px', textAlign: 'left',
  fontSize: 10, fontWeight: 800, color: C.muted,
  letterSpacing: '0.06em', textTransform: 'uppercase',
});
const iconBtnTable = (C) => ({
  width: 28, height: 28, borderRadius: 7,
  background: C.cardElev, border: `1px solid ${C.border}`,
  color: C.sub, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
});

function CalendrierFiscal({ C, echeances, onOuvrirDeclaration, onMarquerFaite }) {
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  const dans7j = new Date(); dans7j.setDate(dans7j.getDate() + 7);
  const finMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0);

  // Groupement par urgence
  const groupes = { retard: [], semaine: [], mois: [], plus_tard: [] };
  for (const e of echeances) {
    const d = new Date(e.date + 'T00:00:00');
    if (d < aujourdhui) groupes.retard.push(e);
    else if (d <= dans7j) groupes.semaine.push(e);
    else if (d <= finMois) groupes.mois.push(e);
    else groupes.plus_tard.push(e);
  }

  const sections = [
    { key: 'retard',    titre: 'En retard',       icon: AlertTriangle, color: C.danger,  items: groupes.retard },
    { key: 'semaine',   titre: 'Cette semaine',   icon: Clock,         color: C.warning, items: groupes.semaine },
    { key: 'mois',      titre: 'Ce mois',         icon: Calendar,      color: C.cabinet, items: groupes.mois },
    { key: 'plus_tard', titre: 'À venir',         icon: Calendar,      color: C.muted,   items: groupes.plus_tard },
  ].filter(s => s.items.length > 0);

  const couleurType = {
    ITS:  { bg: `${C.info}18`, color: C.info },
    TVA:  { bg: `${C.cabinet}18`, color: C.cabinet },
    CNPS: { bg: `${C.accent}18`, color: C.accent },
    IS:   { bg: `${C.danger}18`, color: C.danger },
    DSF:  { bg: `${C.warning}18`, color: C.warning },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {sections.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon size={14} color={s.color} />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: s.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {s.titre}
              </span>
              <span style={{ fontSize: 10.5, color: C.muted, fontFamily: '"JetBrains Mono", monospace', padding: '1px 7px', borderRadius: 10, background: C.cardElev, border: `1px solid ${C.border}` }}>
                {s.items.length}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10 }}>
              {s.items.map((e, idx) => {
                const dDate = new Date(e.date + 'T00:00:00');
                const joursRestants = Math.round((dDate - aujourdhui) / (1000 * 60 * 60 * 24));
                const labelStatut = joursRestants < 0
                  ? `${Math.abs(joursRestants)} j de retard`
                  : joursRestants === 0 ? "aujourd'hui"
                  : `dans ${joursRestants} j`;
                const c = couleurType[e.type] || { bg: `${C.muted}18`, color: C.muted };
                return (
                  <div key={`${e.pme_id}-${e.type}-${e.date}-${idx}`} className="cab-card" style={{
                    padding: 14, background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 11, display: 'flex', flexDirection: 'column', gap: 8,
                    animationDelay: `${idx * 0.02}s`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 5,
                        background: c.bg, color: c.color, letterSpacing: '0.04em',
                      }}>{e.type}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{labelStatut}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{e.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.pme_nom}>
                        {e.pme_nom}
                      </span>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: C.muted, flexShrink: 0 }}>
                        {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      <button onClick={() => onOuvrirDeclaration(e.pme_id, e.type)}
                        className="cab-action" style={{
                          flex: 1, padding: '7px 10px', borderRadius: 8,
                          background: `${C.cabinet}18`, border: `1px solid ${C.cabinet}40`,
                          color: C.cabinet, fontFamily: 'inherit', fontWeight: 700, fontSize: 11.5,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }} title={`Ouvrir la déclaration ${e.type} chez ${e.pme_nom}`}>
                        Ouvrir <ArrowRight size={11} />
                      </button>
                      <button onClick={() => onMarquerFaite(e)}
                        className="cab-action" style={{
                          padding: '7px 10px', borderRadius: 8,
                          background: 'transparent', border: `1px solid ${C.border}`,
                          color: C.sub, fontFamily: 'inherit', fontWeight: 600, fontSize: 11.5,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                        }} title="Marquer cette échéance comme déclarée (la masque du calendrier)">
                        <Check size={11} /> Faite
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
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
