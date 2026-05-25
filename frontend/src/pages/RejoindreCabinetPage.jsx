import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Award, ArrowRight, Check, Loader2 } from 'lucide-react';
import api from '../utils/api.jsx';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';

/**
 * Page /rejoindre/:token — atterrissage de l'invitation envoyée par un
 * cabinet partenaire à une PME prospecte. Formulaire ultra-court :
 * nom dirigeant + nom entreprise + NCC + mot de passe → compte créé +
 * login auto.
 */
export default function RejoindreCabinetPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [form, setForm] = useState({
    nom_dirigeant: '', nom_entreprise: '', ncc: '', centre_fiscal: '',
    mot_de_passe: '',
  });
  const [loading, setLoading] = useState(false);

  // Charge l'invitation publique
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/invitations/cabinet/${token}`);
        setInvitation(data.data);
        setForm((f) => ({ ...f, nom_entreprise: data.data.nom_pme || '' }));
      } catch (err) {
        setErreur(err.response?.data?.message || 'Invitation introuvable');
      }
    })();
  }, [token]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.mot_de_passe.length < 8) {
      toast.error('Mot de passe : 8 caractères minimum');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(`/invitations/cabinet/${token}/accepter`, form);
      // Login automatique avec le JWT retourné
      localStorage.setItem('cw_token', data.data.token);
      toast.success(`Bienvenue ! Votre cabinet ${invitation.cabinet_nom} a accès à votre dossier.`);
      // Hard reload pour que useAuth recharge tout
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de création');
      setLoading(false);
    }
  };

  // Erreur ou invitation expirée
  if (erreur) {
    return (
      <Centered>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#FFF', margin: 0 }}>Invitation indisponible</h2>
          <p style={{ color: '#9CA3AF', marginTop: 8 }}>{erreur}</p>
          <Link to="/" style={{
            display: 'inline-block', marginTop: 24, padding: '12px 24px',
            background: '#10B981', color: '#000', borderRadius: 10,
            fontWeight: 700, textDecoration: 'none',
          }}>Retour à la page d'accueil</Link>
        </div>
      </Centered>
    );
  }

  if (!invitation) {
    return (
      <Centered>
        <Loader2 size={48} color="#10B981" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </Centered>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(180deg, #0A0F18 0%, #1A1F2B 100%)',
      color: '#FFF', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: '#FFF', marginBottom: 32 }}>
          <svg width={36} height={36} viewBox="0 0 64 64">
            <rect width="64" height="64" rx="10" fill="#000" />
            <path d="M32 18 L40 32 L24 32 Z" fill="#8DE645" />
            <path d="M32 28 L52 50 L43 50 L32 38 L21 50 L12 50 Z" fill="#FFF" />
          </svg>
          <span style={{ fontSize: 22, fontWeight: 900 }}>ApeX</span>
        </Link>

        {/* Bandeau invitation */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(16, 185, 129, 0.1))',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 16, padding: '20px 24px', marginBottom: 32,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <Award size={36} color="#F59E0B" />
          <div>
            <div style={{ fontSize: 13, color: '#9CA3AF' }}>Invitation envoyée par votre cabinet</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{invitation.cabinet_nom}</div>
          </div>
        </div>

        {/* Bénéfices */}
        <div style={{
          padding: 24, borderRadius: 14, marginBottom: 32,
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        }}>
          <div style={{ fontSize: 14, color: '#D1FAE5', marginBottom: 12 }}>
            🎁 En finalisant votre inscription via ce lien, vous bénéficiez de :
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: '#FFF' }}>
            <li><strong>14 jours d'essai gratuit</strong> de toutes les fonctionnalités</li>
            <li><strong>-{invitation.remise_proposee_pct} % de remise</strong> sur votre abonnement la 1ère année</li>
            <li><strong>Votre cabinet a un accès direct</strong> à votre dossier (vous ne lui transmettez plus de pièces)</li>
            <li><strong>Facturation FNE, paie CNPS 2024, comptabilité SYSCOHADA</strong> automatisées</li>
          </ul>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{
          padding: 32, borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, marginBottom: 8 }}>
            Configurez votre compte en 2 minutes
          </h2>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 0, marginBottom: 24 }}>
            Email pré-rempli : <strong style={{ color: '#FFF' }}>{invitation.email_pme}</strong>
          </p>

          <Input label="Votre nom (dirigeant) *" required value={form.nom_dirigeant} onChange={set('nom_dirigeant')} placeholder="Konan Marc" />
          <Input label="Nom de votre entreprise *" required value={form.nom_entreprise} onChange={set('nom_entreprise')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input label="NCC (Numéro Compte Contribuable)" value={form.ncc} onChange={set('ncc')} placeholder="CI-2024-..." />
            <Input label="Centre fiscal" value={form.centre_fiscal} onChange={set('centre_fiscal')} placeholder="CME Plateau" />
          </div>
          <Input label="Mot de passe (8 caractères min) *" required type="password" value={form.mot_de_passe} onChange={set('mot_de_passe')} />

          <button type="submit" disabled={loading} style={{
            marginTop: 20, padding: '16px 32px', width: '100%',
            borderRadius: 12, border: 'none', background: '#10B981',
            color: '#000', fontSize: 16, fontWeight: 800,
            cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            {loading
              ? <>Création de votre compte…</>
              : <>Créer mon compte ApeX <ArrowRight size={18} /></>}
          </button>
          <p style={{ fontSize: 11, color: '#6B7280', marginTop: 16, textAlign: 'center' }}>
            En vous inscrivant vous acceptez nos <Link to="/cgu" style={{ color: '#9CA3AF' }}>CGU</Link> et notre{' '}
            <Link to="/confidentialite" style={{ color: '#9CA3AF' }}>politique de confidentialité</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#0A0F18', color: '#FFF',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>{children}</div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      <input {...props} style={{
        width: '100%', boxSizing: 'border-box',
        background: '#11161D', border: '1px solid #2A3140', borderRadius: 10,
        padding: '12px 14px', color: '#FFF', fontSize: 14, fontFamily: 'inherit', outline: 'none',
      }} />
    </div>
  );
}
