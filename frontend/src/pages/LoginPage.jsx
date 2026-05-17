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
  CheckCircle2, Zap, MessageCircle, Lock,
  UserPlus, Send, Check,
} from 'lucide-react';
import LogoFournisseur from '../components/LogoFournisseur.jsx';
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

      {/* ═══════════════ HERO — pleine largeur ═══════════════ */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        background: dark
          ? 'radial-gradient(ellipse at top left, #0E2030 0%, #0A1320 45%, #060A12 100%)'
          : 'radial-gradient(ellipse at top left, #0E1B36 0%, #0A1628 45%, #050B18 100%)',
        color: '#E8EDF5',
        padding: '72px 56px 80px',
      }} className="cw-hero">
        {/* Halos décoratifs */}
        <div style={{ position: 'absolute', top: -180, right: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}28, transparent 60%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 120, left: -140, width: 380, height: 380, borderRadius: '50%', background: `radial-gradient(circle, #4E8BF522, transparent 60%)`, pointerEvents: 'none' }} />

        {/* Top bar : logo + actions */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, #00D4AA, #00A882)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 900, color: '#000',
            }}>₣</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>ComptaWest</div>
              <div style={{ fontSize: 10, color: '#9BAACC', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>{t('common.tagline')}</div>
            </div>
          </div>
        </div>

        {/* Bloc central : 2 colonnes (texte + mockup) */}
        <div style={{
          position: 'relative', zIndex: 1, display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
          gap: 56, alignItems: 'center', maxWidth: 1280, margin: '0 auto',
        }} className="cw-hero-grid">

          {/* COLONNE GAUCHE — discours marketing */}
          <div>
            {/* Badge animé */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 100,
              background: `linear-gradient(135deg, ${C.accent}25, rgba(78,139,245,0.18))`,
              border: `1px solid ${C.accent}50`,
              fontSize: 11.5, fontWeight: 700, color: C.accent,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 22,
            }}>
              <span className="cw-pulse" style={{
                width: 7, height: 7, borderRadius: '50%', background: C.accent,
                boxShadow: `0 0 0 0 ${C.accent}AA`,
              }} />
              {t('login.new_badge')}
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: 52, fontWeight: 900, lineHeight: 1.05, color: '#fff',
              letterSpacing: '-0.035em', margin: '0 0 22px 0',
            }} className="cw-headline">
              {t('login.hero_title_line1')}{' '}
              <span style={{ background: `linear-gradient(135deg, ${C.accent}, #4E8BF5)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {t('login.hero_title_highlight')}
              </span>
              <br />{t('login.hero_title_line2')}
            </h1>

            {/* Subheadline */}
            <p style={{ fontSize: 16.5, color: '#B5C2DC', lineHeight: 1.6, margin: '0 0 32px 0', maxWidth: 540 }}>
              {t('login.hero_subtitle')}
            </p>

            {/* Bullets clés */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 36 }}>
              {[
                t('login.hero_bullet_1'),
                t('login.hero_bullet_2'),
                t('login.hero_bullet_3'),
              ].map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <CheckCircle2 size={18} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 14, color: '#D5DDF0', lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </div>

            {/* CTA principaux */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
              <button onClick={handleDemoLogin} disabled={loading}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,212,170,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,212,170,0.30)'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '15px 28px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #00D4AA, #00A882)', color: '#000',
                  fontSize: 14.5, fontWeight: 800, cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 8px 24px rgba(0,212,170,0.30)', transition: 'all 0.2s',
                }}>
                <Zap size={16} />
                {loading ? t('login.demo_connecting') : t('login.cta_primary')}
                <ArrowRight size={16} />
              </button>
              <button onClick={() => { setMode('register'); document.getElementById('cw-auth-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '15px 24px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.2s',
                }}>
                {t('login.cta_secondary')}
              </button>
            </div>

            {/* Réassurance */}
            <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: '#7E8DAB', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={12} color={C.accent} /> {t('login.trust_no_cc')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={12} color={C.accent} /> {t('login.trust_free_demo')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={12} color={C.accent} /> {t('login.trust_syscohada')}</span>
            </div>
          </div>

          {/* COLONNE DROITE — mockup d'une facture certifiée */}
          <div style={{ position: 'relative' }} className="cw-mockup-wrapper">
            {/* Halo derrière le mockup */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '90%', height: '90%', borderRadius: 24,
              background: `radial-gradient(circle, ${C.accent}30, transparent 65%)`,
              filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
            }} />

            {/* Mockup facture */}
            <div className="cw-float" style={{
              position: 'relative', zIndex: 1,
              background: '#FFFFFF', borderRadius: 20,
              boxShadow: '0 30px 90px rgba(0,0,0,0.4)',
              padding: 28, color: '#0F172A',
            }}>
              {/* En-tête facture */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('login.mockup_invoice')}</div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', fontFamily: 'monospace', letterSpacing: '-0.01em', marginTop: 2 }}>F-2026-0042</div>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 20,
                  background: 'linear-gradient(135deg, #00A88220, #00D4AA20)',
                  border: '1px solid #00A88240', color: '#00805F',
                  fontSize: 10, fontWeight: 800,
                }}>
                  <ShieldCheck size={11} /> {t('login.mockup_certified')}
                </div>
              </div>

              {/* Lignes facture */}
              <div style={{ borderTop: '1px dashed #CBD5E1', borderBottom: '1px dashed #CBD5E1', padding: '12px 0', marginBottom: 14 }}>
                {[
                  { d: 'Prestation conseil SYSCOHADA', m: '750 000' },
                  { d: 'Formation équipe (2 jours)',    m: '480 000' },
                ].map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 11.5 }}>
                    <span style={{ color: '#475569' }}>{l.d}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>{l.m}</span>
                  </div>
                ))}
              </div>

              {/* Totaux */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{t('login.mockup_total')}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#00A882', fontFamily: 'monospace', letterSpacing: '-0.01em' }}>1 451 400 FCFA</span>
              </div>

              {/* QR + Mobile Money */}
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 14, alignItems: 'center', padding: 12, background: 'linear-gradient(135deg, #F0F7FF, #E8FFFA)', borderRadius: 12, border: '1px solid #D1DBE8' }}>
                {/* QR placeholder en CSS pur */}
                <div style={{
                  width: 64, height: 64, background: '#0F172A', borderRadius: 6,
                  padding: 4, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)',
                  gap: 1,
                }}>
                  {[...Array(64)].map((_, i) => (
                    <div key={i} style={{
                      background: (i * 31 + 7) % 3 === 0 ? '#fff' : '#0F172A',
                      borderRadius: 1,
                    }} />
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0F172A', marginBottom: 3 }}>
                    {t('login.mockup_qr_label')}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.4, marginBottom: 8 }}>
                    {t('login.mockup_qr_help')}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #1AA1F1, #0066FF)',
                    color: '#fff', fontSize: 10.5, fontWeight: 800,
                  }}>
                    <Smartphone size={11} /> {t('login.mockup_pay_button')}
                  </div>
                </div>
              </div>
            </div>

            {/* Mini card flottante : OCR */}
            <div className="cw-float-2" style={{
              position: 'absolute', bottom: -28, left: -32, zIndex: 2,
              background: '#fff', color: '#0F172A', borderRadius: 12,
              boxShadow: '0 14px 40px rgba(0,0,0,0.25)',
              padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10,
              maxWidth: 230,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'linear-gradient(135deg, #00D4AA, #00A882)',
                color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Camera size={16} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800 }}>{t('login.mockup_ocr_title')}</div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{t('login.mockup_ocr_sub')}</div>
              </div>
            </div>

            {/* Mini card flottante : WhatsApp */}
            <div className="cw-float-3" style={{
              position: 'absolute', top: -22, right: -28, zIndex: 2,
              background: '#fff', color: '#0F172A', borderRadius: 12,
              boxShadow: '0 14px 40px rgba(0,0,0,0.25)',
              padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: '#25D366', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <MessageCircle size={14} />
              </div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 800 }}>WhatsApp</div>
                <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 1 }}>{t('login.mockup_wa_sub')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats chiffrées sous le hero */}
        <div style={{
          position: 'relative', zIndex: 1, marginTop: 72,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
          maxWidth: 1280, marginLeft: 'auto', marginRight: 'auto',
          paddingTop: 36, borderTop: '1px solid rgba(255,255,255,0.08)',
        }} className="cw-stats">
          {[
            { v: '30+',  l: t('login.stat_features')        },
            { v: '10',   l: t('login.stat_roles')           },
            { v: '100%', l: t('login.stat_syscohada')       },
            { v: '3',    l: t('login.stat_mobile_money')    },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em',
                background: `linear-gradient(135deg, ${C.accent}, #4E8BF5)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {s.v}
              </div>
              <div style={{ fontSize: 12, color: '#9BAACC', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ LOGOS PARTENAIRES ═══════════════
          Bandeau fin de réassurance : montre l'écosystème auquel
          ComptaWest se connecte. Volontairement minimaliste pour
          ne pas voler la vedette aux différenciateurs en dessous. */}
      <section style={{
        padding: '32px 56px',
        background: dark ? '#0A0E18' : '#FAFCFE',
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
      }} className="cw-section">
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.05em' }}>
            {t('login.partners_intro')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'center', opacity: 0.85 }}>
            <LogoFournisseur fournisseur="wave"         size={36} radius={10} />
            <LogoFournisseur fournisseur="orange_money" size={36} radius={10} />
            <LogoFournisseur fournisseur="mtn_momo"     size={36} radius={10} />
            {/* DGI Côte d'Ivoire : tente d'abord /logos/dgi.png (à poser
                par toi dans frontend/public/logos/dgi.png pour avoir le
                vrai logo officiel) ; à défaut, fallback sur un badge
                officiel avec drapeau CI + sceau DGI. */}
            <div style={{ height: 36, display: 'flex', alignItems: 'center' }}>
              <img
                src="/logos/dgi.png"
                alt="DGI Côte d'Ivoire"
                style={{ height: 36, width: 'auto', maxWidth: 100, objectFit: 'contain', display: 'block' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                }}
              />
              <div style={{
                display: 'none',
                height: 36, borderRadius: 8,
                background: dark ? '#0F172A' : '#FFFFFF',
                border: `1px solid ${dark ? '#1E2D40' : '#D1DBE8'}`,
                padding: '4px 12px 4px 5px',
                alignItems: 'center', gap: 9,
                boxShadow: dark ? 'none' : '0 1px 3px rgba(15,23,42,0.06)',
              }}>
                {/* Drapeau CI : 3 bandes verticales (orange, blanc, vert) */}
                <div style={{ display: 'flex', height: 26, width: 20, borderRadius: 3, overflow: 'hidden', flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}>
                  <div style={{ width: '33.33%', background: '#F77F00' }} />
                  <div style={{ width: '33.33%', background: '#FFFFFF' }} />
                  <div style={{ width: '33.33%', background: '#009E60' }} />
                </div>
                <div style={{ lineHeight: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: dark ? '#fff' : '#0F172A', letterSpacing: '0.04em' }}>DGI</div>
                  <div style={{ fontSize: 8, color: dark ? '#9BAACC' : '#64748B', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>Côte d'Ivoire</div>
                </div>
              </div>
            </div>
            {/* WhatsApp : logo officiel SVG via simpleicons.org
                (CDN dédié aux logos de marques, très fiable). */}
            <div style={{ position: 'relative', height: 36, display: 'flex', alignItems: 'center' }}>
              <img
                src="https://cdn.simpleicons.org/whatsapp/25D366"
                alt="WhatsApp"
                style={{ height: 32, width: 32, display: 'block' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                }}
              />
              <div style={{
                display: 'none',
                width: 36, height: 36, borderRadius: 10,
                background: '#25D366', color: '#fff',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageCircle size={20} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ COMMENT ÇA MARCHE ═══════════════
          Trois étapes concrètes du parcours utilisateur. Pas de
          baratin marketing : on dit ce qu'on fait, en combien de
          temps, avec un exemple ivoirien si possible. */}
      <section style={{ padding: '80px 56px', background: C.bg }} className="cw-section">
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', color: C.text, margin: '0 0 12px 0' }}>
              {t('login.how_title')}
            </h2>
            <p style={{ fontSize: 15, color: C.muted, maxWidth: 620, margin: '0 auto', lineHeight: 1.55 }}>
              {t('login.how_subtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, position: 'relative' }} className="cw-how-grid">
            {[
              { icon: UserPlus, key: 'step1', duration: t('login.how_step1_time') },
              { icon: Camera,   key: 'step2', duration: t('login.how_step2_time') },
              { icon: Send,     key: 'step3', duration: t('login.how_step3_time') },
            ].map(({ icon: Icon, key, duration }, i) => (
              <div key={key} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
                padding: '32px 26px', position: 'relative',
                boxShadow: dark ? '0 6px 24px rgba(0,0,0,0.30)' : '0 4px 16px rgba(15,23,42,0.06)',
              }}>
                {/* Numéro géant en filigrane derrière */}
                <div style={{
                  position: 'absolute', top: 18, right: 22,
                  fontSize: 64, fontWeight: 900, lineHeight: 1,
                  color: 'transparent', WebkitTextStroke: `1.5px ${C.accent}30`,
                  pointerEvents: 'none', userSelect: 'none',
                }}>0{i + 1}</div>

                <div style={{
                  width: 50, height: 50, borderRadius: 13,
                  background: `linear-gradient(135deg, ${C.accent}, #4E8BF5)`,
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
                }}>
                  <Icon size={22} />
                </div>

                <h3 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
                  {t(`login.how_${key}_title`)}
                </h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, margin: '0 0 14px 0' }}>
                  {t(`login.how_${key}_desc`)}
                </p>

                {/* Petite ligne durée */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 100,
                  background: `${C.accent}15`, color: C.accent,
                  fontSize: 11, fontWeight: 700,
                }}>
                  <Zap size={11} /> {duration}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ DIFFÉRENCIATEURS ═══════════════ */}
      <section style={{ padding: '80px 56px', background: C.bg }} className="cw-section">
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
              <Sparkles size={13} />
              {t('login.differentiators_label')}
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', color: C.text, margin: '0 0 12px 0' }}>
              {t('login.diff_section_title')}
            </h2>
            <p style={{ fontSize: 15, color: C.muted, maxWidth: 620, margin: '0 auto', lineHeight: 1.55 }}>
              {t('login.diff_section_subtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }} className="cw-diff-grid">
            {DIFFERENCIATEURS.map(({ icon: Icon, key }) => (
              <div key={key} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
                padding: 28, position: 'relative', overflow: 'hidden', boxShadow: dark ? '0 6px 24px rgba(0,0,0,0.30)' : '0 4px 16px rgba(15,23,42,0.06)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = dark ? `0 16px 40px rgba(0,212,170,0.20)` : `0 12px 32px rgba(0,168,130,0.18)`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = dark ? '0 6px 24px rgba(0,0,0,0.30)' : '0 4px 16px rgba(15,23,42,0.06)'; }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.accent}, #4E8BF5)`,
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18,
                }}>
                  <Icon size={24} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
                  {t(`login.differentiators.${key}.title`)}
                </h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, margin: 0 }}>
                  {t(`login.differentiators.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FONCTIONNALITÉS CLASSIQUES ═══════════════ */}
      <section style={{ padding: '40px 56px 80px', background: C.bg }} className="cw-section">
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: C.text, margin: '0 0 8px 0' }}>
              {t('login.features_section_title')}
            </h2>
            <p style={{ fontSize: 14, color: C.muted, maxWidth: 580, margin: '0 auto' }}>
              {t('login.features_section_subtitle')}
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
          }} className="cw-feats-grid">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: '20px 18px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: `${C.accent}18`, color: C.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text, marginBottom: 5 }}>
                  {t(`login.features.${key}.title`)}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
                  {t(`login.features.${key}.desc`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ TARIFICATION ═══════════════
          3 plans : Démo (gratuit, à vie), PME (mensuel), Pro
          (multi-entreprise). Prix indicatifs en FCFA. Le plan PME
          est mis en avant (badge populaire) car c'est le sweet spot
          de la cible. Ton : « démarrer ne coûte rien, grandir non
          plus ». */}
      <section style={{
        padding: '80px 56px',
        background: dark
          ? 'linear-gradient(180deg, transparent 0%, rgba(0,212,170,0.04) 50%, transparent 100%)'
          : 'linear-gradient(180deg, transparent 0%, rgba(0,168,130,0.05) 50%, transparent 100%)',
      }} className="cw-section">
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', color: C.text, margin: '0 0 12px 0' }}>
              {t('login.pricing_title')}
            </h2>
            <p style={{ fontSize: 15, color: C.muted, maxWidth: 620, margin: '0 auto', lineHeight: 1.55 }}>
              {t('login.pricing_subtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, alignItems: 'stretch' }} className="cw-pricing-grid">
            {[
              { key: 'demo', price: t('login.plan_demo_price'),  unit: '',                          highlight: false },
              { key: 'pme',  price: '15 000', unit: t('login.plan_unit'),  highlight: true  },
              { key: 'pro',  price: '35 000', unit: t('login.plan_unit'),  highlight: false },
            ].map(({ key, price, unit, highlight }) => (
              <div key={key} style={{
                background: highlight
                  ? `linear-gradient(135deg, ${C.accent}10, rgba(78,139,245,0.08))`
                  : C.card,
                border: highlight ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                borderRadius: 20, padding: '32px 28px',
                position: 'relative',
                boxShadow: highlight
                  ? (dark ? '0 16px 48px rgba(0,212,170,0.20)' : '0 16px 48px rgba(0,168,130,0.15)')
                  : (dark ? '0 6px 24px rgba(0,0,0,0.30)' : '0 4px 16px rgba(15,23,42,0.06)'),
                transform: highlight ? 'translateY(-8px)' : 'none',
                display: 'flex', flexDirection: 'column',
              }}>
                {highlight && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    padding: '4px 14px', borderRadius: 100,
                    background: C.accent, color: '#000',
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {t('login.plan_popular_badge')}
                  </div>
                )}

                <div style={{ fontSize: 13, fontWeight: 800, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {t(`login.plan_${key}_name`)}
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
                  {t(`login.plan_${key}_tagline`)}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: C.text, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {price}
                  </span>
                  {unit && (
                    <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{unit}</span>
                  )}
                </div>

                {/* Features list */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const text = t(`login.plan_${key}_feat${n}`, { defaultValue: '' });
                    if (!text) return null;
                    return (
                      <li key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
                        <Check size={15} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{text}</span>
                      </li>
                    );
                  })}
                </ul>

                <button onClick={key === 'demo' ? handleDemoLogin : () => { setMode('register'); document.getElementById('cw-auth-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                  disabled={loading}
                  style={{
                    padding: '13px 0', borderRadius: 11, border: 'none',
                    background: highlight ? `linear-gradient(135deg, #00D4AA, #00A882)` : 'transparent',
                    color: highlight ? '#000' : C.text,
                    border: highlight ? 'none' : `1.5px solid ${C.border}`,
                    fontSize: 14, fontWeight: 700,
                    cursor: loading ? 'wait' : 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}>
                  {t(`login.plan_${key}_cta`)} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Note humaine en bas */}
          <div style={{
            textAlign: 'center', marginTop: 32,
            fontSize: 12.5, color: C.muted, lineHeight: 1.6,
          }}>
            {t('login.pricing_note')}
          </div>
        </div>
      </section>

      {/* ═══════════════ FORMULAIRE D'AUTHENTIFICATION ═══════════════ */}
      <section id="cw-auth-form" style={{
        padding: '60px 24px 80px',
        background: dark
          ? 'linear-gradient(180deg, transparent 0%, rgba(0,212,170,0.04) 100%)'
          : 'linear-gradient(180deg, transparent 0%, rgba(0,168,130,0.05) 100%)',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 22,
            padding: '40px 36px',
            boxShadow: dark ? '0 30px 70px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.10)',
          }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {mode === 'login' ? t('login.welcome_back') : t('login.welcome')}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>
                {mode === 'login' ? t('login.title_login') : t('login.title_register')}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                {mode === 'login' ? t('login.subtitle_login') : t('login.subtitle_register')}
              </div>
            </div>

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

          {/* Pied de page minimal */}
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 28, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lock size={11} /> {t('login.footer_secure')}</span>
            <span>·</span>
            <span>{t('login.footer_syscohada')}</span>
            <span>·</span>
            <span>{t('login.footer_dgi')}</span>
          </div>
        </div>
      </section>

      {/* Animations & responsive */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${C.accent}AA; }
          50% { box-shadow: 0 0 0 6px ${C.accent}00; }
        }
        .cw-pulse { animation: pulse 1.8s ease-in-out infinite; }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .cw-float { animation: float 5s ease-in-out infinite; }
        .cw-float-2 { animation: float 5.5s ease-in-out infinite 0.6s; }
        .cw-float-3 { animation: float 4.5s ease-in-out infinite 1.2s; }

        @media (max-width: 960px) {
          .cw-hero { padding: 48px 24px 56px !important; }
          .cw-hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .cw-headline { font-size: 38px !important; }
          .cw-mockup-wrapper { max-width: 420px; margin: 0 auto; }
          .cw-section { padding-left: 24px !important; padding-right: 24px !important; }
          .cw-stats { grid-template-columns: 1fr 1fr !important; gap: 20px !important; }
          .cw-diff-grid { grid-template-columns: 1fr !important; }
          .cw-feats-grid { grid-template-columns: 1fr 1fr !important; }
          .cw-how-grid { grid-template-columns: 1fr !important; }
          .cw-pricing-grid { grid-template-columns: 1fr !important; }
          .cw-pricing-grid > div { transform: none !important; }
        }
        @media (max-width: 480px) {
          .cw-headline { font-size: 32px !important; }
          .cw-feats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
