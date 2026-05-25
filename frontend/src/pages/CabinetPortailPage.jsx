import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, Copy, Check, Plus, Trash2, ExternalLink, Building2, X,
  Users, Mail, MessageCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.jsx';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';

/**
 * Portail Cabinet — vue centralisée des PME clientes pour les cabinets
 * partenaires (entreprises.type_compte = 'cabinet_partenaire').
 * Accessible uniquement aux cabinets, sinon redirection vers /dashboard.
 */
export default function CabinetPortailPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const { actuelle } = useEntreprise();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [clients, setClients] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const C = dark
    ? { bg: '#0A0F18', card: '#11161D', border: '#2A3140', text: '#E5E7EB', muted: '#9CA3AF', accent: '#10B981', warning: '#F59E0B', danger: '#EF4444' }
    : { bg: '#F8FAFC', card: '#FFF',    border: '#E5E7EB', text: '#111827', muted: '#6B7280', accent: '#0F8A6E', warning: '#D97706', danger: '#DC2626' };

  // Redirection si l'entreprise courante n'est pas un cabinet partenaire
  useEffect(() => {
    if (actuelle && actuelle.type_compte !== 'cabinet_partenaire') {
      toast.error('Ce portail est réservé aux Cabinets Partenaires ApeX.');
      navigate('/dashboard');
    }
  }, [actuelle, navigate]);

  const fetchAll = async () => {
    setLoading(true);
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
    }
  };

  useEffect(() => {
    if (actuelle?.type_compte === 'cabinet_partenaire') fetchAll();
  }, [actuelle]);

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Chargement…</div>;
  if (!info) return null;

  const lienParrainage = `${window.location.origin}/r/${info.code_parrain}`;
  const pendingInvitations = invitations.filter((i) => i.statut === 'pending');

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', color: C.text }}>
      {/* Bandeau Cabinet Partenaire */}
      <div style={{
        background: `linear-gradient(135deg, ${C.warning}25, ${C.warning}10)`,
        border: `1.5px solid ${C.warning}66`,
        borderRadius: 16, padding: '20px 24px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: C.warning, color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Award size={28} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{info.nom}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            🏅 Cabinet Partenaire ApeX — Licence gratuite à vie · Support prioritaire 2h
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Stat label="Clients PME actifs"          value={info.nb_clients_actifs}          icon={Users}    color={C.accent} />
        <Stat label="Invitations en attente"      value={info.nb_invitations_en_attente}  icon={Mail}     color={C.warning} />
        <Stat label="PME parrainées total"        value={info.nb_pme_parrainees_total}    icon={Building2} color={C.accent} />
      </div>

      {/* Code parrain */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 24, marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Votre code parrain unique
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', color: C.accent, letterSpacing: '0.04em' }}>
            {info.code_parrain}
          </div>
          <button onClick={() => { navigator.clipboard.writeText(lienParrainage); toast.success('Lien parrainage copié'); }}
            style={btn(C, 'ghost')}>
            <Copy size={14} /> Copier le lien
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8, fontFamily: 'monospace' }}>
          {lienParrainage}
        </div>
      </div>

      {/* CTA + table clients */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Mes clients PME ({clients.length})</h2>
        <button onClick={() => setModalOpen(true)} style={btn(C, 'primary')}>
          <Plus size={16} /> Inviter une PME
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 32 }}>
        {clients.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
            Aucun client PME pour l'instant. Cliquez sur « Inviter une PME » pour démarrer.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: dark ? '#0D1220' : '#F1F5F9' }}>
                <Th>PME</Th><Th>NCC</Th><Th>Palier</Th><Th>Statut</Th><Th>Remise</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.connection_id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <Td><strong>{c.pme_nom}</strong></Td>
                  <Td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.ncc || '—'}</Td>
                  <Td>{c.palier || 'aucun'}</Td>
                  <Td>{c.statut_abonnement || '—'}</Td>
                  <Td>{c.remise_parrainage_pct > 0 ? `-${c.remise_parrainage_pct} %` : '—'}</Td>
                  <Td>
                    <button onClick={() => navigate(`/dashboard?eid=${c.pme_id}`)} style={btn(C, 'ghost')}>
                      <ExternalLink size={12} /> Accéder
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invitations en attente */}
      {pendingInvitations.length > 0 && (
        <>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
            Invitations en attente ({pendingInvitations.length})
          </h2>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: dark ? '#0D1220' : '#F1F5F9' }}>
                  <Th>Email PME</Th><Th>Nom</Th><Th>Envoyée</Th><Th>Expire</Th><Th>Lien</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.map((i) => {
                  const lien = `${window.location.origin}/rejoindre/${i.token}`;
                  return (
                    <tr key={i.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <Td><strong>{i.email_pme}</strong></Td>
                      <Td>{i.nom_pme || '—'}</Td>
                      <Td style={{ color: C.muted }}>{new Date(i.created_at).toLocaleDateString('fr-FR')}</Td>
                      <Td style={{ color: C.muted }}>{new Date(i.expires_at).toLocaleDateString('fr-FR')}</Td>
                      <Td>
                        <button onClick={() => { navigator.clipboard.writeText(lien); toast.success('Lien copié'); }}
                          style={btn(C, 'ghost')}>
                          <Copy size={12} /> Copier
                        </button>
                      </Td>
                      <Td>
                        <button onClick={async () => {
                          if (!confirm('Révoquer cette invitation ?')) return;
                          await api.delete(`/cabinets/invitations/${i.id}`);
                          toast.success('Révoquée');
                          fetchAll();
                        }} style={{ ...btn(C, 'ghost'), color: C.danger }}>
                          <Trash2 size={12} />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modale Inviter une PME */}
      {modalOpen && <InviterPmeModal C={C} onClose={() => setModalOpen(false)} onSuccess={fetchAll} />}
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }) {
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
        <div style={{ fontSize: 28, fontWeight: 900, color: '#FFF', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

const Th = ({ children }) => <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</th>;
const Td = ({ children, style }) => <td style={{ padding: '14px 16px', ...style }}>{children}</td>;

const btn = (C, kind) => kind === 'primary' ? {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '10px 20px', borderRadius: 10, border: 'none',
  background: C.accent, color: '#000', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
} : {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, background: 'transparent',
  color: C.text, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};

// ─── Modale : Inviter une nouvelle PME ────────────────────────────────────
function InviterPmeModal({ C, onClose, onSuccess }) {
  const [form, setForm] = useState({ email_pme: '', nom_pme: '', telephone_pme: '', remise_proposee_pct: 15 });
  const [loading, setLoading] = useState(false);
  const [lienGenere, setLienGenere] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/cabinets/inviter-pme', form);
      setLienGenere(data.data.lien_invitation);
      toast.success('Invitation créée');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const whatsappMessage = lienGenere
    ? `Bonjour ${form.nom_pme || ''}, je vous invite à rejoindre ApeX pour digitaliser votre comptabilité (FNE, paie CNPS, Mobile Money). En passant par mon lien, vous bénéficiez de -${form.remise_proposee_pct} % la 1ère année : ${lienGenere}`
    : '';
  const waUrl = `https://wa.me/${(form.telephone_pme || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, borderRadius: 16, padding: 32, width: '90%', maxWidth: 560,
        border: `1px solid ${C.border}`, color: C.text,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Inviter une PME</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {!lienGenere ? (
          <form onSubmit={handleSubmit}>
            <Field label="Email du dirigeant *" required value={form.email_pme} onChange={set('email_pme')} type="email" />
            <Field label="Nom de la PME" value={form.nom_pme} onChange={set('nom_pme')} />
            <Field label="WhatsApp (avec indicatif)" value={form.telephone_pme} onChange={set('telephone_pme')} placeholder="+225 07 ..." />
            <Field label="Remise proposée (%)" type="number" min="0" max="50" value={form.remise_proposee_pct} onChange={set('remise_proposee_pct')} />
            <button type="submit" disabled={loading} style={{ ...btn(C, 'primary'), marginTop: 16, width: '100%', justifyContent: 'center', padding: '14px' }}>
              {loading ? 'Création…' : 'Générer le lien d\'invitation'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{
              background: `${C.accent}15`, border: `1px solid ${C.accent}66`,
              borderRadius: 12, padding: 16, marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>
                ✓ Invitation générée
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                Transmettez le lien à votre client par le canal de votre choix.
              </div>
              <div style={{
                background: '#000', padding: '12px', borderRadius: 8,
                fontFamily: 'monospace', fontSize: 11, color: C.accent, wordBreak: 'break-all',
              }}>
                {lienGenere}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => { navigator.clipboard.writeText(lienGenere); toast.success('Copié'); }}
                style={btn(C, 'primary')}>
                <Copy size={14} /> Copier le lien
              </button>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
                ...btn(C, 'primary'), background: '#25D366', textDecoration: 'none',
              }}>
                <MessageCircle size={14} /> Envoyer sur WhatsApp
              </a>
            </div>
            <button onClick={onClose} style={{ ...btn(C, 'ghost'), marginTop: 16, width: '100%', justifyContent: 'center' }}>
              Terminer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      <input {...props} style={{
        width: '100%', boxSizing: 'border-box',
        background: '#11161D', border: '1px solid #2A3140', borderRadius: 10,
        padding: '11px 14px', color: '#FFF', fontSize: 13, fontFamily: 'inherit', outline: 'none',
      }} />
    </div>
  );
}
