import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

const getC = (dark) => dark ? {
  bg: '#0B0F1A', card: '#111827', border: '#1E2D40',
  accent: '#00D4AA', text: '#E8EDF5', muted: '#6B7A99', sub: '#9BAACC',
  red: '#FF5C6B', input: '#161F2E',
} : {
  bg: '#F0F4F8', card: '#FFFFFF', border: '#D1DBE8',
  accent: '#00A882', text: '#0F172A', muted: '#64748B', sub: '#475569',
  red: '#E03050', input: '#F8FAFC',
};

const Input = ({ label, type = 'text', value, onChange, placeholder, required, C }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {label}{required && <span style={{ color: C.accent }}> *</span>}
    </label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={{
        background: C.input, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: '11px 14px', color: C.text, fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s', fontFamily: 'inherit',
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

export default function LoginPage() {
  const { login, register } = useAuth();
  const { chargerEntreprises } = useEntreprise();
  const { dark, toggle } = useTheme();
  const C = getC(dark);
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nom: '', email: '', mot_de_passe: '',
    entreprise: '', pays: "Côte d'Ivoire"
  });

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('cw_entreprise_id'); 
      await api.post('/auth/demo');
      await login('demo@comptawest.ci', 'demo1234');
      await chargerEntreprises();
      toast.success('Bienvenue sur le compte démo !');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur connexion démo');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.mot_de_passe);
      } else {
        if (form.mot_de_passe.length < 8) {
          toast.error('Mot de passe : 8 caractères minimum');
          return;
        }
        await register(form);
      }
      await chargerEntreprises();
      toast.success(mode === 'login' ? 'Connexion réussie !' : 'Compte créé avec succès !');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      transition: 'background 0.2s',
    }}>
      {/* Toggle thème */}
      <button onClick={toggle} style={{
        position: 'fixed', top: 16, right: 16,
        padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
        background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, fontWeight: 600, color: C.muted, transition: 'all 0.2s',
      }}>
        {dark ? <Sun size={14} color="#F5A623" /> : <Moon size={14} color="#4E8BF5" />}
        {dark ? 'Mode clair' : 'Mode sombre'}
      </button>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 22,
        padding: '48px 40px', width: '100%', maxWidth: 460,
        boxShadow: dark ? '0 30px 70px rgba(0,0,0,0.5)' : '0 8px 40px rgba(0,0,0,0.1)',
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 15, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #00D4AA, #00A882)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 900, color: '#000',
          }}>₣</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>ComptaWest</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            {mode === 'login' ? 'Connectez-vous à votre espace' : 'Créez votre compte gratuit'}
          </div>
        </div>

        {/* Toggle login/register */}
        <div style={{ display: 'flex', background: dark ? '#0D1220' : '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 28 }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
              background: mode === m ? C.accent : 'transparent',
              color: mode === m ? '#000' : C.muted,
            }}>
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'register' && (
            <>
              <Input label="Nom complet" value={form.nom} onChange={set('nom')} placeholder="Ouattara Koffi" required C={C} />
              <Input label="Nom de l'entreprise" value={form.entreprise} onChange={set('entreprise')} placeholder="SARL MonEntreprise" C={C} />
            </>
          )}
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.ci" required C={C} />
          <Input label="Mot de passe" type="password" value={form.mot_de_passe} onChange={set('mot_de_passe')} placeholder="••••••••" required C={C} />

          <button type="submit" disabled={loading} style={{
            marginTop: 8, padding: '13px 0', borderRadius: 12, border: 'none',
            background: loading ? C.border : 'linear-gradient(135deg, #00D4AA, #00A882)',
            color: loading ? C.muted : '#000', fontSize: 15, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
          }}>
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        {/* Bloc démo — DANS le return, après le form */}
        {mode === 'login' && (
          <div style={{ marginTop: 20, padding: '16px', background: dark ? '#0D1220' : '#F0F7FF', borderRadius: 12, border: `1px solid ${C.accent}30` }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>🎯 Compte Démo</div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 12, lineHeight: 1.6 }}>
              Accède instantanément à un compte démo avec des données pré-remplies.<br />
              <span style={{ fontSize: 11, color: C.muted }}>✓ Factures · Dépenses · Taxes DGI/CNSS · Rapports</span>
            </div>
            <button onClick={handleDemoLogin} disabled={loading} style={{
              width: '100%', padding: '10px 0', borderRadius: 9,
              border: `1.5px solid ${C.accent}`,
              background: `${C.accent}15`,
              color: C.accent, fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = '#000'; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${C.accent}15`; e.currentTarget.style.color = C.accent; }}
            >
              {loading ? 'Connexion...' : '→ Accéder au compte démo'}
            </button>
          </div>
        )}

        {mode === 'register' && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: dark ? '#0D1220' : '#F8FAFC', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: C.muted }}>
              ✓ Une entreprise sera créée automatiquement<br />
              ✓ 10 catégories SYSCOHADA prédéfinies<br />
              ✓ Accès illimité à toutes les fonctionnalités
            </div>
          </div>
        )}
      </div>
    </div>
  );
}