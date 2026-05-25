import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Users, Award, Mail, CheckCircle, XCircle, Clock,
  Building2, ChevronRight, AlertCircle,
} from 'lucide-react';
import api from '../utils/api.jsx';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme.jsx';

/**
 * Console super-admin — réservée au porteur du projet ApeX
 * (utilisateurs.is_super_admin = TRUE). Accès via /admin.
 *
 * Sections :
 *   - 4 KPIs (MRR, cabinets actifs, PME actives, taux conversion)
 *   - Candidatures cabinets en attente (avec actions Valider/Refuser)
 *   - Leaderboard cabinets actifs (top 100)
 *   - Dernières relances envoyées (50)
 */
export default function AdminPage() {
  const { dark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [candidatures, setCandidatures] = useState([]);
  const [cabinets, setCabinets] = useState([]);
  const [relances, setRelances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const C = dark
    ? { bg: '#0A0F18', card: '#11161D', border: '#2A3140', text: '#E5E7EB', muted: '#9CA3AF',
        accent: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6' }
    : { bg: '#F8FAFC', card: '#FFF',    border: '#E5E7EB', text: '#111827', muted: '#6B7280',
        accent: '#0F8A6E', warning: '#D97706', danger: '#DC2626', info: '#2563EB' };

  const fetchAll = async () => {
    setLoading(true);
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
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        toast.error(err.response?.data?.message || 'Erreur de chargement');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Chargement…</div>;
  if (accessDenied) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: C.text }}>
        <AlertCircle size={48} color={C.danger} style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Accès refusé</h2>
        <p style={{ color: C.muted, marginTop: 8 }}>Cette console est réservée au super-admin ApeX.</p>
        <button onClick={() => navigate('/dashboard')} style={{
          marginTop: 20, padding: '10px 22px', borderRadius: 10,
          background: C.accent, color: '#000', border: 'none',
          fontWeight: 700, cursor: 'pointer',
        }}>Retour au dashboard</button>
      </div>
    );
  }
  if (!stats) return null;

  const valider = async (id, nomCabinet) => {
    if (!confirm(`Valider la candidature de "${nomCabinet}" ?\n\nUn compte cabinet sera créé et un email d'activation envoyé.`)) return;
    try {
      const { data } = await api.post(`/admin/candidatures/${id}/valider`);
      toast.success(`Cabinet activé. Code parrain : ${data.data.code_parrain}`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };
  const refuser = async (id, nomCabinet) => {
    const motif = prompt(`Motif de refus pour "${nomCabinet}" :`);
    if (motif === null) return;
    try {
      await api.post(`/admin/candidatures/${id}/refuser`, { motif });
      toast.success('Candidature refusée');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', color: C.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Console Admin ApeX 🛡</h1>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Suivi de l'acquisition et du programme Partenaires Cabinets</div>
        </div>
        <button onClick={fetchAll} style={{
          padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
          background: 'transparent', color: C.text, cursor: 'pointer', fontSize: 13,
        }}>↻ Rafraîchir</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <Kpi label="MRR (FCFA)"             value={stats.mrr_fcfa.toLocaleString('fr-FR')}  icon={TrendingUp} color={C.accent} />
        <Kpi label="Cabinets partenaires"   value={stats.cabinets_partenaires}              icon={Award}      color={C.warning} />
        <Kpi label="PME actives"            value={stats.pme_actives}                       icon={Building2}  color={C.info} />
        <Kpi label="Taux conversion (%)"    value={stats.taux_conversion_pct}               icon={CheckCircle} color={C.accent}
             sublabel={`${stats.invitations_acceptees} / ${stats.invitations_total} invitations`} />
      </div>

      {/* Secondary metrics */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
        marginBottom: 32, padding: 16, background: C.card,
        border: `1px solid ${C.border}`, borderRadius: 12,
      }}>
        <Mini label="Candidatures en attente" value={stats.candidatures_pending} color={C.warning} />
        <Mini label="Invitations pending"     value={stats.invitations_pending}   color={C.info} />
        <Mini label="PME parrainées"          value={stats.pme_parrainees}        color={C.accent} />
        <Mini label="Comptes démo actifs"     value={stats.users_demo_actifs}     color={C.muted} />
      </div>

      {/* Candidatures cabinets en attente */}
      <Section titre={`Candidatures en attente (${candidatures.length})`} color={C.warning}>
        {candidatures.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>Aucune candidature en attente</div>
        ) : (
          <table style={tableStyle(C)}>
            <thead><tr style={thRow(C, dark)}>
              <Th>Cabinet</Th><Th>Responsable</Th><Th>Email</Th><Th>Ville</Th><Th>Collab.</Th><Th>Clients</Th><Th>Reçue</Th><Th>Actions</Th>
            </tr></thead>
            <tbody>
              {candidatures.map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <Td><strong>{c.nom_cabinet}</strong>{c.numero_onecca && <div style={{ fontSize: 10, color: C.muted }}>ONECCA {c.numero_onecca}</div>}</Td>
                  <Td>{c.nom_responsable}</Td>
                  <Td style={{ fontSize: 12 }}>{c.email_pro}</Td>
                  <Td>{c.ville || '—'}</Td>
                  <Td style={{ textAlign: 'center' }}>{c.nb_collaborateurs || '—'}</Td>
                  <Td style={{ textAlign: 'center' }}>{c.nb_clients_pme || '—'}</Td>
                  <Td style={{ fontSize: 11, color: C.muted }}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</Td>
                  <Td>
                    <button onClick={() => valider(c.id, c.nom_cabinet)} style={btn(C, 'success')}>✓ Valider</button>
                    <button onClick={() => refuser(c.id, c.nom_cabinet)} style={{ ...btn(C, 'ghost'), marginLeft: 4 }}>✕</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Leaderboard cabinets actifs */}
      <Section titre={`Leaderboard cabinets actifs (${cabinets.length})`} color={C.accent}>
        {cabinets.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>Aucun cabinet partenaire pour l'instant</div>
        ) : (
          <table style={tableStyle(C)}>
            <thead><tr style={thRow(C, dark)}>
              <Th>#</Th><Th>Cabinet</Th><Th>Code parrain</Th><Th>Invitations</Th><Th>Acceptées</Th><Th>Taux conv.</Th><Th>Clients actifs</Th><Th>MRR généré</Th>
            </tr></thead>
            <tbody>
              {cabinets.map((c, i) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <Td style={{ fontWeight: 700, color: C.muted, width: 30 }}>{i + 1}</Td>
                  <Td><strong>{c.cabinet_nom}</strong></Td>
                  <Td style={{ fontFamily: 'monospace', fontSize: 12, color: C.accent }}>{c.code_parrain}</Td>
                  <Td style={{ textAlign: 'center' }}>{c.invitations_emises}</Td>
                  <Td style={{ textAlign: 'center' }}>{c.invitations_acceptees}</Td>
                  <Td style={{ textAlign: 'center', color: c.taux_conversion_pct >= 30 ? C.accent : c.taux_conversion_pct >= 10 ? C.warning : C.muted }}>
                    {c.taux_conversion_pct} %
                  </Td>
                  <Td style={{ textAlign: 'center' }}>{c.clients_actifs}</Td>
                  <Td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{c.mrr_genere_fcfa.toLocaleString('fr-FR')}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Relances récentes */}
      <Section titre={`Relances récentes (${relances.length})`} color={C.info}>
        {relances.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>Aucune relance envoyée</div>
        ) : (
          <table style={tableStyle(C)}>
            <thead><tr style={thRow(C, dark)}>
              <Th>PME (email)</Th><Th>Cabinet</Th><Th>Envoyée le</Th><Th>Relancée le</Th><Th>Statut</Th>
            </tr></thead>
            <tbody>
              {relances.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <Td style={{ fontSize: 12 }}>{r.email_pme}{r.nom_pme && <div style={{ fontSize: 10, color: C.muted }}>{r.nom_pme}</div>}</Td>
                  <Td>{r.cabinet_nom}</Td>
                  <Td style={{ fontSize: 11, color: C.muted }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</Td>
                  <Td style={{ fontSize: 11, color: C.muted }}>{new Date(r.relance_envoyee_at).toLocaleDateString('fr-FR')}</Td>
                  <Td><span style={statutBadge(C, r.statut)}>{r.statut}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color, sublabel }) {
  return (
    <div style={{
      background: '#11161D', border: '1px solid #2A3140', borderRadius: 14,
      padding: 20, display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: `${color}25`,
        color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon size={24} /></div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#FFF', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

function Mini({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Section({ titre, color, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 4, height: 18, background: color, borderRadius: 2 }} />
        {titre}
      </h2>
      <div style={{ background: '#11161D', border: '1px solid #2A3140', borderRadius: 14, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

const Th = ({ children }) => <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</th>;
const Td = ({ children, style }) => <td style={{ padding: '12px 14px', ...style }}>{children}</td>;
const tableStyle = (C) => ({ width: '100%', borderCollapse: 'collapse', fontSize: 13 });
const thRow = (C, dark) => ({ background: dark ? '#0D1220' : '#F1F5F9' });
const statutBadge = (C, statut) => ({
  padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
  background: statut === 'accepted' ? `${C.accent}25` : statut === 'expired' ? `${C.danger}25` : `${C.warning}25`,
  color:      statut === 'accepted' ? C.accent : statut === 'expired' ? C.danger : C.warning,
});
const btn = (C, kind) => ({
  padding: '4px 10px', borderRadius: 6, border: 'none',
  background: kind === 'success' ? C.accent : 'transparent',
  color: kind === 'success' ? '#000' : C.muted,
  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
});
