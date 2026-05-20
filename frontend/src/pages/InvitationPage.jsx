import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import { Sun, Moon, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import LogoApex from '../components/LogoApex.jsx';

const getC = (dark) => dark ? {
  bg: '#0B0F1A', card: '#111827', border: '#1E2D40',
  accent: '#00D4AA', text: '#E8EDF5', muted: '#6B7A99', sub: '#9BAACC',
  red: '#FF5C6B', input: '#161F2E',
} : {
  bg: '#F0F4F8', card: '#FFFFFF', border: '#D1DBE8',
  accent: '#00A882', text: '#0F172A', muted: '#64748B', sub: '#475569',
  red: '#E03050', input: '#F8FAFC',
};

// Les libellés de rôles sont résolus via t('roles.<code>') au rendu.

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

export default function InvitationPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const { acceptInvitation } = useAuth();
  const { chargerEntreprises } = useEntreprise();
  const { dark, toggle } = useTheme();
  const C = getC(dark);
  const navigate = useNavigate();

  const [etat, setEtat] = useState('chargement');  // chargement | valide | erreur
  const [invitation, setInvitation] = useState(null);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ nom: '', mot_de_passe: '', confirmation: '' });
  const [loading, setLoading] = useState(false);

  // Vérifie le token au chargement
  useEffect(() => {
    api.get(`/auth/invitation/${token}`)
      .then(r => {
        setInvitation(r.data.data);
        setForm(f => ({ ...f, nom: r.data.data.nom || '' }));
        setEtat('valide');
      })
      .catch(err => {
        setErreur(err.response?.data?.message || t('invitation.invalid'));
        setEtat('erreur');
      });
  }, [token, t]);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.mot_de_passe.length < 8) {
      toast.error(t('invitation.password_short'));
      return;
    }
    if (form.mot_de_passe !== form.confirmation) {
      toast.error(t('invitation.password_mismatch'));
      return;
    }
    setLoading(true);
    try {
      await acceptInvitation(token, { nom: form.nom, mot_de_passe: form.mot_de_passe });
      await chargerEntreprises();
      toast.success(t('invitation.success'));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('invitation.error'));
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
      {/* Sélecteur de langue + Toggle thème */}
      <div style={{
        position: 'fixed', top: 16, right: 16,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <LanguageSwitcher C={C} dark={dark} />
        <button onClick={toggle} style={{
          padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
          background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 600, color: C.muted, transition: 'all 0.2s',
        }}>
          {dark ? <Sun size={14} color="#F5A623" /> : <Moon size={14} color="#4E8BF5" />}
          {dark ? t('parametres.theme_light') : t('parametres.theme_dark')}
        </button>
      </div>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 22,
        padding: '44px 40px', width: '100%', maxWidth: 460,
        boxShadow: dark ? '0 30px 70px rgba(0,0,0,0.5)' : '0 8px 40px rgba(0,0,0,0.1)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <LogoApex
            height={104}
            direction="column"
            textColor={C.text}
            textSize={22}
            gap={14}
            fallback={(
              <div style={{
                width: 104, height: 104, borderRadius: 22,
                background: 'linear-gradient(135deg, #00D4AA, #00A882)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 48, fontWeight: 900, color: '#000',
              }}>₣</div>
            )}
          />
        </div>

        {etat === 'chargement' && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
            {t('invitation.loading')}
          </div>
        )}

        {etat === 'erreur' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, margin: '0 auto 14px',
              background: `${C.red}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertCircle size={24} color={C.red} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              {t('invitation.expired')}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 22, lineHeight: 1.6 }}>
              {erreur || t('invitation.invalid_help')}
            </div>
            <button onClick={() => navigate('/login')} style={{
              padding: '11px 24px', borderRadius: 10, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.sub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              {t('login.submit')}
            </button>
          </div>
        )}

        {etat === 'valide' && invitation && (
          <>
            {/* Bandeau invitation */}
            <div style={{
              background: `${C.accent}12`, border: `1px solid ${C.accent}35`, borderRadius: 12,
              padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <ShieldCheck size={18} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.accent, marginBottom: 4 }}>
                  {t('invitation.title', { company: invitation.entreprise_nom })}
                </div>
                <div style={{ fontSize: 12, color: C.sub }}>
                  {t('invitation.as_role', { role: t(`roles.${invitation.role}`, { defaultValue: invitation.role }) })}
                  {' · '}{invitation.email}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
              {t('invitation.set_password')}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label={t('login.name')} value={form.nom} onChange={set('nom')}
                placeholder="" required C={C} />
              <Input label={t('invitation.password')} type="password" value={form.mot_de_passe}
                onChange={set('mot_de_passe')} placeholder="" required C={C} />
              <Input label={t('invitation.confirm_password')} type="password" value={form.confirmation}
                onChange={set('confirmation')} placeholder="••••••••" required C={C} />

              <button type="submit" disabled={loading} style={{
                marginTop: 6, padding: '13px 0', borderRadius: 12, border: 'none',
                background: loading ? C.border : 'linear-gradient(135deg, #00D4AA, #00A882)',
                color: loading ? C.muted : '#000', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading ? t('invitation.submitting') : <>{t('invitation.submit')} <ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
