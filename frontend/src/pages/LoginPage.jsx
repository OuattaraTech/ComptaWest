import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import {
  Sun, Moon, FileText, Wallet, BarChart3, ArrowRight,
  Truck, Box, UserCheck, Package, BookMarked,
  Smartphone, Camera, ShieldCheck, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

const getC = (dark) => dark ? {
  bg: '#0B0F1A', card: '#111827', border: '#1E2D40',
  accent: '#00D4AA', text: '#E8EDF5', muted: '#6B7A99', sub: '#9BAACC',
  red: '#FF5C6B', input: '#161F2E', hero: '#080E1A',
} : {
  bg: '#F0F4F8', card: '#FFFFFF', border: '#D1DBE8',
  accent: '#00A882', text: '#0F172A', muted: '#64748B', sub: '#475569',
  red: '#E03050', input: '#F8FAFC', hero: '#0A1628',
};

// Liste des icônes par clé i18n. Les titres et descriptions sont résolus
// au rendu via t('login.features.<key>.title' / '.desc').
const FEATURES = [
  { icon: FileText,   key: 'billing'   },
  { icon: Truck,      key: 'purchases' },
  { icon: Box,        key: 'stock'     },
  { icon: Wallet,     key: 'treasury'  },
  { icon: UserCheck,  key: 'payroll'   },
  { icon: Package,    key: 'assets'    },
  { icon: BookMarked, key: 'accounting'},
  { icon: BarChart3,  key: 'reports'   },
];

// Les différenciateurs sont les fonctionnalités qui distinguent ComptaWest
// des suites comptables classiques. Affichés au-dessus de la grille avec
// un style plus accentué (gradient, animation au survol).
const DIFFERENCIATEURS = [
  { icon: Smartphone,  key: 'mobile_money' },
  { icon: Camera,      key: 'ocr'          },
  { icon: ShieldCheck, key: 'fne'          },
];

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
  const { t } = useTranslation();
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
      toast.success(t('login.success_demo'));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('login.error_demo'));
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
          toast.error(t('login.error_password_short'));
          return;
        }
        await register(form);
      }
      await chargerEntreprises();
      toast.success(mode === 'login' ? t('login.success_login') : t('login.success_register'));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('login.error_login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, transition: 'background 0.2s',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Sélecteur langue + Toggle thème */}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <LanguageSwitcher C={C} dark={dark} />
        <button onClick={toggle} style={{
          padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
          background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 600, color: C.muted, transition: 'all 0.2s',
        }}>
          {dark ? <Sun size={14} color="#F5A623" /> : <Moon size={14} color="#4E8BF5" />}
          {dark ? (t('parametres.theme_light')) : (t('parametres.theme_dark'))}
        </button>
      </div>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
      }} className="cw-login-grid">
        {/* ─── COLONNE GAUCHE : PRÉSENTATION ─────────────────────── */}
        <div style={{
          background: dark
            ? `linear-gradient(135deg, #0A1320 0%, #0E1A2E 60%, #0B1F2E 100%)`
            : `linear-gradient(135deg, #0A1628 0%, #0F2540 55%, #0A3A35 100%)`,
          color: '#E8EDF5',
          padding: '64px 56px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden',
        }} className="cw-login-hero">
          {/* Effets décoratifs */}
          <div style={{
            position: 'absolute', top: -120, right: -120, width: 380, height: 380,
            borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}25, transparent 65%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -160, left: -160, width: 420, height: 420,
            borderRadius: '50%', background: `radial-gradient(circle, #4E8BF520, transparent 65%)`,
            pointerEvents: 'none',
          }} />

          {/* En-tête : logo + nom */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, #00D4AA, #00A882)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 900, color: '#000',
              }}>₣</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                  ComptaWest
                </div>
                <div style={{ fontSize: 11, color: '#9BAACC', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
                  {t('common.tagline')}
                </div>
              </div>
            </div>

            {/* Slogan */}
            <h1 style={{
              fontSize: 32, fontWeight: 800, lineHeight: 1.2, color: '#fff',
              letterSpacing: '-0.02em', margin: '0 0 16px 0',
            }}>
              {t('login.hero_title_line1')} <span style={{ color: C.accent }}>{t('login.hero_title_highlight')}</span><br />
              {t('login.hero_title_line2')}
            </h1>
            <p style={{
              fontSize: 14.5, color: '#9BAACC', lineHeight: 1.65, margin: '0 0 28px 0',
              maxWidth: 480,
            }}>
              {t('login.hero_subtitle')}
            </p>

            {/* Différenciateurs : Mobile Money, OCR, FNE — mis en avant
                au-dessus de la grille des fonctionnalités classiques. */}
            <div style={{ maxWidth: 560, marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                fontSize: 11, fontWeight: 700, color: C.accent,
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                <Sparkles size={13} />
                {t('login.differentiators_label')}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
              }} className="cw-differenciateurs-grid">
                {DIFFERENCIATEURS.map(({ icon: Icon, key }) => (
                  <div key={key} style={{
                    background: `linear-gradient(135deg, ${C.accent}18, rgba(78,139,245,0.10))`,
                    border: `1px solid ${C.accent}40`,
                    borderRadius: 12, padding: '14px 14px',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: `linear-gradient(135deg, ${C.accent}, #4E8BF5)`,
                      color: '#000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 9,
                    }}>
                      <Icon size={15} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', marginBottom: 3, lineHeight: 1.2 }}>
                      {t(`login.differentiators.${key}.title`)}
                    </div>
                    <div style={{ fontSize: 11, color: '#9BAACC', lineHeight: 1.4 }}>
                      {t(`login.differentiators.${key}.desc`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grille de fonctionnalités */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18,
              maxWidth: 560,
            }} className="cw-features-grid">
              {FEATURES.map(({ icon: Icon, key }) => (
                <div key={key} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: '14px 16px',
                  transition: 'background 0.15s',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${C.accent}25`, color: C.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 10,
                  }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                    {t(`login.features.${key}.title`)}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#9BAACC', lineHeight: 1.45 }}>
                    {t(`login.features.${key}.desc`)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer hero */}
          <div style={{
            position: 'relative', zIndex: 1, marginTop: 40,
            display: 'flex', gap: 24, fontSize: 11.5, color: '#6B7A99', flexWrap: 'wrap',
          }}>
            <span>{t('login.footer_syscohada')}</span>
            <span>{t('login.footer_dgi')}</span>
            <span>{t('login.footer_secure')}</span>
          </div>
        </div>

        {/* ─── COLONNE DROITE : FORMULAIRE ────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 24px',
        }}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 22,
            padding: '40px 36px', width: '100%', maxWidth: 440,
            boxShadow: dark ? '0 30px 70px rgba(0,0,0,0.5)' : '0 8px 40px rgba(0,0,0,0.08)',
            transition: 'background 0.2s, border-color 0.2s',
          }}>
            {/* Titre du form */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {mode === 'login' ? t('login.welcome_back') : t('login.welcome')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
                {mode === 'login' ? t('login.title_login') : t('login.title_register')}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                {mode === 'login' ? t('login.subtitle_login') : t('login.subtitle_register')}
              </div>
            </div>

            {/* Toggle login/register */}
            <div style={{ display: 'flex', background: dark ? '#0D1220' : '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {['login', 'register'].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                  background: mode === m ? C.accent : 'transparent',
                  color: mode === m ? '#000' : C.muted,
                }}>
                  {m === 'login' ? t('login.tab_login') : t('login.tab_register')}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'register' && (
                <>
                  <Input label={t('login.name')} value={form.nom} onChange={set('nom')} placeholder="Ouattara Koffi" required C={C} />
                  <Input label={t('login.company_name')} value={form.entreprise} onChange={set('entreprise')} placeholder="SARL MonEntreprise" C={C} />
                </>
              )}
              <Input label={t('login.email')} type="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.ci" required C={C} />
              <Input label={t('login.password')} type="password" value={form.mot_de_passe} onChange={set('mot_de_passe')} placeholder="••••••••" required C={C} />

              <button type="submit" disabled={loading} style={{
                marginTop: 6, padding: '13px 0', borderRadius: 12, border: 'none',
                background: loading ? C.border : 'linear-gradient(135deg, #00D4AA, #00A882)',
                color: loading ? C.muted : '#000', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading ? t('login.submitting') : (
                  <>
                    {mode === 'login' ? t('login.submit') : t('login.register_submit')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Bloc démo */}
            {mode === 'login' && (
              <div style={{ marginTop: 18, padding: '14px 16px', background: dark ? '#0D1220' : '#F0F7FF', borderRadius: 12, border: `1px solid ${C.accent}30` }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  🎯 {t('login.demo_title')}
                </div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, lineHeight: 1.55 }}>
                  {t('login.demo_description')}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {t('login.demo_features')}
                  </div>
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
                  {loading ? t('login.demo_connecting') : t('login.demo_button')}
                </button>
              </div>
            )}

            {mode === 'register' && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: dark ? '#0D1220' : '#F8FAFC', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.65 }}>
                  {t('login.register_advantages_1')}<br />
                  {t('login.register_advantages_2')}<br />
                  {t('login.register_advantages_3')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive : empiler les colonnes en mobile */}
      <style>{`
        @media (max-width: 960px) {
          .cw-login-grid { grid-template-columns: 1fr !important; }
          .cw-login-hero { padding: 40px 28px !important; }
          .cw-features-grid { grid-template-columns: 1fr !important; }
          .cw-differenciateurs-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .cw-login-hero { padding: 32px 20px !important; }
        }
      `}</style>
    </div>
  );
}
