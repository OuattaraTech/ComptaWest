import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  UserPlus, Send, Check, X,
} from 'lucide-react';
import LogoFournisseur from '../components/LogoFournisseur.jsx';
import LogoApex from '../components/LogoApex.jsx';
import { ouvrirCelebrationModal } from '../components/CelebrationModal.jsx';
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

// Les différenciateurs sont les fonctionnalités qui distinguent ApeX
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
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nom: '', email: '', mot_de_passe: '',
    entreprise: '', pays: "Côte d'Ivoire"
  });
  // Palier choisi par le visiteur sur /tarifs avant d'arriver ici. On
  // accepte uniquement les valeurs connues pour ne pas se laisser
  // injecter un palier inventé via l'URL ; le backend re-valide de
  // toute façon via la matrice de quotas.
  const PALIERS_VALIDES = ['decouverte', 'starter', 'pro', 'cabinet'];
  const planParametre = searchParams.get('plan');
  const [planChoisi, setPlanChoisi] = useState(
    PALIERS_VALIDES.includes(planParametre) ? planParametre : null
  );

  // Si l'utilisateur arrive avec ?plan=xxx, on bascule directement sur le
  // formulaire d'inscription et on scrolle vers lui — pas la peine de le
  // forcer à recliquer sur l'onglet « Créer un compte ».
  useEffect(() => {
    if (planChoisi) {
      setMode('register');
      // Scroll différé pour laisser le DOM se peindre.
      const id = setTimeout(() => {
        document.getElementById('cw-auth-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(id);
    }
  }, [planChoisi]);

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

      // Si l'utilisateur a choisi un palier payant sur /tarifs avant
      // l'inscription, on l'applique tout de suite à son entreprise.
      // « decouverte » est déjà le palier par défaut, inutile de payer
      // un round-trip pour rien. On laisse passer l'erreur silencieuse
      // pour ne pas bloquer l'arrivée sur le dashboard si l'API 422.
      let palierAppliqueAvecSucces = false;
      if (mode === 'register' && planChoisi && planChoisi !== 'decouverte') {
        try {
          await api.put('/abonnement', { palier: planChoisi, periodicite: 'mensuel' });
          palierAppliqueAvecSucces = true;
        } catch (errPlan) {
          console.warn('[login] application palier échouée:', errPlan.message);
        }
      }

      // Modal chaleureuse pour fêter l'arrivée. Pour les nouveaux comptes
      // sans plan, on célèbre quand même le palier « Découverte ». On
      // remplace le toast de succès dans ce cas pour ne pas faire doublon.
      if (mode === 'register') {
        ouvrirCelebrationModal({
          palier: palierAppliqueAvecSucces ? planChoisi : 'decouverte',
          isNewSignup: true,
        });
      } else {
        toast.success(t('login.success_login'));
      }
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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <LogoApex
              height={84}
              subtitle={t('common.tagline')}
              subtitleColor="#9BAACC"
              subtitleSize={10}
              subtitleLetterSpacing="0.1em"
              subtitleUppercase
              textColor="#fff"
              textSize={18}
              gap={14}
              fallback={(
                <div style={{
                  width: 84, height: 84, borderRadius: 18,
                  background: 'linear-gradient(135deg, #00D4AA, #00A882)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 38, fontWeight: 900, color: '#000',
                }}>₣</div>
              )}
            />
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
              <button onClick={() => navigate('/tarifs')}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '15px 24px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.2s',
                }}>
                {t('login.cta_secondary')} <ArrowRight size={14} />
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

            {/* Mockup facture — reproduction fidèle du PDF généré par
                le module Rapports (cf. backend/rapportsController.js,
                buildFactureDoc). Mêmes couleurs (#00D4AA pour le vert
                signature, header de tableau vert, total TTC vert), même
                structure : en-tête émetteur OHADA → ligne verte →
                bloc Facture/Client → tableau → totaux → mention en
                lettres → footer. La badge « Certifiée DGI » et le
                bandeau Mobile Money sont les vrais différenciateurs
                FNE et Wave/Orange/MTN intégrés dans ApeX. */}
            <div className="cw-float" style={{
              position: 'relative', zIndex: 1,
              background: '#FFFFFF', borderRadius: 14,
              boxShadow: '0 30px 90px rgba(0,0,0,0.4)',
              padding: '22px 24px 18px', color: '#0B0F1A',
              fontFamily: '"Helvetica Neue", Roboto, Arial, sans-serif',
            }}>
              {/* ── En-tête émetteur (raison sociale + identifiants OHADA) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0B0F1A', letterSpacing: '-0.005em', lineHeight: 1.15 }}>
                    {t('login.mockup_emetteur')}
                  </div>
                  <div style={{ fontSize: 8.5, color: '#6B7A99', marginTop: 3, lineHeight: 1.35 }}>
                    {t('login.mockup_emetteur_adresse')}
                  </div>
                  <div style={{ fontSize: 8.5, color: '#0B0F1A', fontWeight: 700, marginTop: 2, lineHeight: 1.35 }}>
                    {t('login.mockup_emetteur_legal')}
                  </div>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 20,
                  background: 'linear-gradient(135deg, #00A88218, #00D4AA22)',
                  border: '1px solid #00A88240', color: '#00805F',
                  fontSize: 9.5, fontWeight: 800, flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  <ShieldCheck size={10} /> {t('login.mockup_certified')}
                </div>
              </div>

              {/* Ligne verte (signature ApeX, cf. PDF) */}
              <div style={{ height: 2, background: '#00D4AA', borderRadius: 1, margin: '8px 0 12px' }} />

              {/* ── Bloc Facture (gauche) + Facturé à (droite) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#00A882', letterSpacing: '-0.005em', marginBottom: 4 }}>
                    {t('login.mockup_invoice').toUpperCase()} N°F-2026-0042
                  </div>
                  <div style={{ fontSize: 9, color: '#0B0F1A', lineHeight: 1.55 }}>
                    {t('login.mockup_emission')} : 18/05/2026
                  </div>
                  <div style={{ fontSize: 9, color: '#0B0F1A', lineHeight: 1.55 }}>
                    {t('login.mockup_echeance')} : 17/06/2026
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 7.5, fontWeight: 800, color: '#6B7A99', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {t('login.mockup_billed_to')}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0B0F1A', lineHeight: 1.25 }}>
                    {t('login.mockup_client_nom')}
                  </div>
                  <div style={{ fontSize: 8.5, color: '#6B7A99', marginTop: 2 }}>
                    {t('login.mockup_client_adresse')}
                  </div>
                </div>
              </div>

              {/* ── Tableau des lignes (header vert comme dans le PDF) */}
              <div style={{ border: '0.5px solid #E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 28px 56px 64px',
                  background: '#00D4AA', color: '#fff', fontSize: 8.5, fontWeight: 800,
                  padding: '5px 8px', gap: 4,
                }}>
                  <span>{t('login.mockup_col_desc')}</span>
                  <span style={{ textAlign: 'center' }}>{t('login.mockup_col_qte')}</span>
                  <span style={{ textAlign: 'right' }}>{t('login.mockup_col_pu')}</span>
                  <span style={{ textAlign: 'right' }}>{t('login.mockup_col_total')}</span>
                </div>
                {[
                  { d: 'Audit SI SYSCOHADA',     q: 1, pu: '750 000', t: '750 000', alt: false },
                  { d: 'Formation équipe (2 j.)', q: 2, pu: '240 000', t: '480 000', alt: true  },
                ].map((l, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 28px 56px 64px',
                    background: l.alt ? '#F5F7FA' : '#FFFFFF',
                    fontSize: 9, color: '#0B0F1A', padding: '6px 8px', gap: 4,
                    borderTop: i === 0 ? 'none' : '0.5px solid #E2E8F0',
                  }}>
                    <span>{l.d}</span>
                    <span style={{ textAlign: 'center' }}>{l.q}</span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.pu}</span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{l.t}</span>
                  </div>
                ))}
              </div>

              {/* ── Totaux à droite */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 9.5, color: '#6B7A99' }}>
                    <span>{t('login.mockup_subtotal')}</span>
                    <span style={{ color: '#0B0F1A', fontVariantNumeric: 'tabular-nums' }}>1 230 000 FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 9.5, color: '#6B7A99' }}>
                    <span>{t('login.mockup_vat')}</span>
                    <span style={{ color: '#0B0F1A', fontVariantNumeric: 'tabular-nums' }}>221 400 FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 2px', fontSize: 11.5, fontWeight: 900, color: '#00A882', borderTop: '0.5px solid #E2E8F0', marginTop: 3 }}>
                    <span>{t('login.mockup_total').toUpperCase()}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>1 451 400 FCFA</span>
                  </div>
                </div>
              </div>

              {/* ── Mention en lettres (obligation SYSCOHADA) */}
              <div style={{ fontSize: 8, color: '#6B7A99', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.4 }}>
                {t('login.mockup_amount_in_words')}{' '}
                <span style={{ color: '#0B0F1A', fontWeight: 700, fontStyle: 'normal' }}>
                  {t('login.mockup_amount_in_words_value')}
                </span>
              </div>

              {/* ── Bandeau QR + Mobile Money (différenciateur ApeX) */}
              <div style={{
                display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 11,
                alignItems: 'center', padding: '9px 11px',
                background: 'linear-gradient(135deg, #F0F7FF, #E8FFFA)',
                borderRadius: 9, border: '1px solid #D1DBE8',
              }}>
                {/* QR placeholder en CSS pur */}
                <div style={{
                  width: 48, height: 48, background: '#0B0F1A', borderRadius: 4,
                  padding: 3, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)',
                  gap: 1,
                }}>
                  {[...Array(64)].map((_, i) => (
                    <div key={i} style={{
                      background: (i * 31 + 7) % 3 === 0 ? '#fff' : '#0B0F1A',
                      borderRadius: 0.5,
                    }} />
                  ))}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#0B0F1A', marginBottom: 2 }}>
                    {t('login.mockup_qr_label')}
                  </div>
                  <div style={{ fontSize: 8.5, color: '#6B7A99', lineHeight: 1.3 }}>
                    {t('login.mockup_qr_help')}
                  </div>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', borderRadius: 7,
                  background: 'linear-gradient(135deg, #1AA1F1, #0066FF)',
                  color: '#fff', fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap',
                }}>
                  <Smartphone size={10} /> {t('login.mockup_pay_button')}
                </div>
              </div>

              {/* ── Footer du PDF */}
              <div style={{ fontSize: 7.5, color: '#6B7A99', fontStyle: 'italic', textAlign: 'center', marginTop: 10, paddingTop: 8, borderTop: '0.5px solid #00D4AA' }}>
                {t('login.mockup_footer')}   ·   Page 1/1
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
          ApeX se connecte. Volontairement minimaliste pour
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
            <LogoFournisseur fournisseur="wave"         size={48} radius={12} />
            <LogoFournisseur fournisseur="orange_money" size={48} radius={12} />
            <LogoFournisseur fournisseur="mtn_momo"     size={48} radius={12} />
            {/* DGI Côte d'Ivoire : tente d'abord /logos/dgi.png (à poser
                par toi dans frontend/public/logos/dgi.png pour avoir le
                vrai logo officiel) ; à défaut, fallback sur un badge
                officiel avec drapeau CI + sceau DGI. */}
            <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
              <img
                src="/logos/dgi.png"
                alt="DGI Côte d'Ivoire"
                style={{ height: 48, width: 'auto', maxWidth: 120, objectFit: 'contain', display: 'block' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                }}
              />
              <div style={{
                display: 'none',
                height: 48, borderRadius: 10,
                background: dark ? '#0F172A' : '#FFFFFF',
                border: `1px solid ${dark ? '#1E2D40' : '#D1DBE8'}`,
                padding: '6px 14px 6px 7px',
                alignItems: 'center', gap: 11,
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
            <div style={{ position: 'relative', height: 48, display: 'flex', alignItems: 'center' }}>
              <img
                src="https://cdn.simpleicons.org/whatsapp/25D366"
                alt="WhatsApp"
                style={{ height: 44, width: 44, display: 'block' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                }}
              />
              <div style={{
                display: 'none',
                width: 44, height: 44, borderRadius: 12,
                background: '#25D366', color: '#fff',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageCircle size={24} />
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

      {/* ═══════════════ APERÇU TABLEAU DE BORD ═══════════════
          Capture d'écran de l'app dans un faux cadre navigateur,
          côté à côté avec un argumentaire en bullets. La capture
          doit être déposée dans frontend/public/screenshots/dashboard.png.
          Tant qu'elle n'existe pas, on affiche un placeholder texte
          (mêmes patterns onError que le logo DGI plus haut). */}
      <section style={{
        padding: '80px 56px',
        background: dark
          ? 'linear-gradient(180deg, transparent 0%, rgba(78,139,245,0.05) 50%, transparent 100%)'
          : 'linear-gradient(180deg, transparent 0%, rgba(78,139,245,0.05) 50%, transparent 100%)',
      }} className="cw-section">
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)',
            gap: 56, alignItems: 'center',
          }} className="cw-dashboard-grid">

            {/* COLONNE GAUCHE — argumentaire */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                <BarChart3 size={13} />
                {t('login.dashboard_label')}
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', color: C.text, margin: '0 0 14px 0', lineHeight: 1.15 }}>
                {t('login.dashboard_title')}
              </h2>
              <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.6, margin: '0 0 24px 0' }}>
                {t('login.dashboard_subtitle')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[1, 2, 3, 4].map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <CheckCircle2 size={17} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.55 }}>
                      {t(`login.dashboard_bullet_${n}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* COLONNE DROITE — capture dans un cadre navigateur */}
            <div style={{ position: 'relative' }} className="cw-dashboard-frame-wrapper">
              {/* Halo décoratif derrière le cadre */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '95%', height: '85%', borderRadius: 24,
                background: `radial-gradient(circle, ${C.accent}28, transparent 65%)`,
                filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0,
              }} />

              <div style={{
                position: 'relative', zIndex: 1,
                background: dark ? '#0F172A' : '#FFFFFF',
                borderRadius: 14, overflow: 'hidden',
                border: `1px solid ${C.border}`,
                boxShadow: dark
                  ? '0 30px 80px rgba(0,0,0,0.55)'
                  : '0 20px 60px rgba(15,23,42,0.18)',
              }}>
                {/* Barre du navigateur */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: dark ? '#0B1220' : '#F1F5F9',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
                  </div>
                  <div style={{
                    flex: 1, padding: '5px 12px', borderRadius: 6,
                    background: dark ? '#0F172A' : '#FFFFFF',
                    border: `1px solid ${C.border}`,
                    fontSize: 11, color: C.muted,
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <Lock size={10} color={C.accent} />
                    <span style={{ fontFamily: 'monospace' }}>{t('login.dashboard_url')}</span>
                  </div>
                </div>

                {/* Capture d'écran (avec fallback texte si absente) */}
                <div style={{ position: 'relative', background: dark ? '#0B1220' : '#F8FAFC' }}>
                  <img
                    src="/screenshots/dashboard.png"
                    alt={t('login.dashboard_image_alt')}
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                    }}
                  />
                  {/* Placeholder affiché si l'image n'existe pas encore */}
                  <div style={{
                    display: 'none',
                    aspectRatio: '16 / 10',
                    alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 10,
                    color: C.muted, fontSize: 13,
                    background: dark
                      ? 'repeating-linear-gradient(45deg, #0B1220, #0B1220 12px, #0F172A 12px, #0F172A 24px)'
                      : 'repeating-linear-gradient(45deg, #F8FAFC, #F8FAFC 12px, #F1F5F9 12px, #F1F5F9 24px)',
                  }}>
                    <BarChart3 size={36} color={C.accent} />
                    <div style={{ fontWeight: 700 }}>{t('login.dashboard_image_placeholder')}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>
                      frontend/public/screenshots/dashboard.png
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

          {/* Grille 4 paliers, alignée sur la matrice de quotas backend
              (utils/quotas.js) et sur la page /tarifs. Les libellés et
              limites détaillées vivent dans la section i18n `tarifs.*`. */}
          <div style={{
            display: 'grid', gap: 18, alignItems: 'stretch',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          }} className="cw-pricing-grid">
            {[
              { code: 'decouverte', prix: 0,     highlight: false, accent: '#9BAACC' },
              { code: 'starter',    prix: 9000,  highlight: false, accent: '#4E8BF5' },
              { code: 'pro',        prix: 25000, highlight: true,  accent: C.accent },
              { code: 'cabinet',    prix: 60000, highlight: false, accent: '#F5A623' },
            ].map(({ code, prix, highlight, accent }) => (
              <div key={code} style={{
                background: highlight
                  ? `linear-gradient(135deg, ${accent}12, ${accent}05)`
                  : C.card,
                border: highlight ? `2px solid ${accent}` : `1px solid ${C.border}`,
                borderRadius: 18, padding: '28px 22px',
                position: 'relative',
                boxShadow: highlight
                  ? (dark ? `0 14px 40px ${accent}30` : `0 12px 32px ${accent}20`)
                  : (dark ? '0 6px 20px rgba(0,0,0,0.25)' : '0 4px 14px rgba(15,23,42,0.05)'),
                transform: highlight ? 'translateY(-6px)' : 'none',
                display: 'flex', flexDirection: 'column',
              }}>
                {highlight && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    padding: '4px 12px', borderRadius: 100,
                    background: accent, color: dark ? '#000' : '#fff',
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    {t('tarifs.palier_pro_badge')}
                  </div>
                )}

                <div style={{
                  fontSize: 12, fontWeight: 800, color: accent,
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  {t(`tarifs.palier_${code}`)}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5, minHeight: 36 }}>
                  {t(`tarifs.palier_${code}_tagline`)}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 18 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {prix === 0 ? '0' : prix.toLocaleString('fr-FR')}
                  </span>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>
                    {t('tarifs.currency_suffix')}
                  </span>
                  {prix > 0 && (
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 2 }}>
                      {t('tarifs.per_month')}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => navigate('/tarifs')}
                  style={{
                    marginTop: 'auto', padding: '11px 0', borderRadius: 10,
                    border: highlight ? 'none' : `1.5px solid ${C.border}`,
                    background: highlight ? accent : 'transparent',
                    color: highlight ? (dark ? '#000' : '#fff') : C.text,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  {t('tarifs.cta_choose')} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* CTA central vers la page Tarifs complète */}
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <button onClick={() => navigate('/tarifs')} style={{
              padding: '12px 26px', borderRadius: 11,
              border: `1.5px solid ${C.accent}`, background: 'transparent',
              color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {t('tarifs.faq_title')} & {t('tarifs.page_subtitle').split('.')[0]} <ArrowRight size={14} />
            </button>
            <div style={{
              marginTop: 18, fontSize: 12.5, color: C.muted, lineHeight: 1.6,
            }}>
              {t('login.pricing_note')}
            </div>
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
              {/* Bandeau de confirmation du palier choisi sur /tarifs.
                  Reste visible et désactive son palier seulement si le
                  visiteur change d'avis (croix). */}
              {mode === 'register' && planChoisi && (
                <div style={{
                  background: `${C.accent}12`, border: `1px solid ${C.accent}40`, borderRadius: 11,
                  padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <CheckCircle2 size={16} color={C.accent} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 800 }}>{t(`tarifs.palier_${planChoisi}`)}</span>
                    {' — '}
                    <span style={{ color: C.muted }}>{t(`tarifs.palier_${planChoisi}_tagline`)}</span>
                  </div>
                  <button type="button" onClick={() => setPlanChoisi(null)}
                    title={t('common.cancel')}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: C.muted, padding: 4, display: 'flex',
                    }}>
                    <X size={14} />
                  </button>
                </div>
              )}

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
          .cw-dashboard-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .cw-dashboard-frame-wrapper { max-width: 560px; margin: 0 auto; }
        }
        @media (max-width: 480px) {
          .cw-headline { font-size: 32px !important; }
          .cw-feats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
