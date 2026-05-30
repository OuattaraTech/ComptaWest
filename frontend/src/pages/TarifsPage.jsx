import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import { useQuotas } from '../hooks/useQuotas.jsx';
import { getC } from '../components/UI.jsx';
import api from '../utils/api.jsx';
import toast from 'react-hot-toast';
import { ouvrirCelebrationModal } from '../components/CelebrationModal.jsx';
import {
  Check, X, ArrowLeft, Sparkles, ShieldCheck,
  Users, Building2, ScanLine, CreditCard, FileText, HelpCircle,
} from 'lucide-react';

// Source unique de vérité pour les paliers : doit rester aligné avec
// backend/src/utils/quotas.js. Une évolution se fait dans les deux
// endroits — pas de risque de divergence visible côté client car les
// quotas réels viennent du backend, ces valeurs servent uniquement
// à l'affichage marketing de la page tarifs.
const PALIERS = [
  {
    code: 'decouverte',
    prix_mensuel: 0,
    prix_annuel: 0,
    accent: '#9BAACC',
    highlight: false,
    features: (t) => [
      { ok: true,  label: t('tarifs.feature_users', { n: 1 }) },
      { ok: true,  label: t('tarifs.feature_entreprises', { n: 1 }) },
      { ok: true,  label: t('tarifs.feature_factures_limit', { n: 10 }) },
      { ok: false, label: t('tarifs.feature_ocr_none') },
      { ok: false, label: t('tarifs.feature_mobile_money_none') },
      { ok: false, label: t('tarifs.feature_paie_none') },
      { ok: false, label: t('tarifs.feature_immo_no') },
      { ok: true,  label: t('tarifs.feature_fne_yes') },
      { ok: true,  label: t('tarifs.feature_support_faq') },
    ],
  },
  {
    code: 'starter',
    prix_mensuel: 10000,
    prix_annuel: 100000,
    accent: '#4E8BF5',
    highlight: false,
    features: (t) => [
      { ok: true,  label: t('tarifs.feature_users', { n: 2 }) },
      { ok: true,  label: t('tarifs.feature_entreprises', { n: 1 }) },
      { ok: true,  label: t('tarifs.feature_factures_unlimited') },
      { ok: true,  label: t('tarifs.feature_ocr', { n: 30 }) },
      { ok: true,  label: t('tarifs.feature_mobile_money', { n: 1 }) },
      { ok: false, label: t('tarifs.feature_paie_none') },
      { ok: false, label: t('tarifs.feature_immo_no') },
      { ok: true,  label: t('tarifs.feature_fne_yes') },
      { ok: true,  label: t('tarifs.feature_support_mail_48h') },
    ],
  },
  {
    code: 'pro',
    prix_mensuel: 25000,
    prix_annuel: 240000,
    accent: '#00D4AA',
    highlight: true,
    features: (t) => [
      { ok: true,  label: t('tarifs.feature_users', { n: 8 }) },
      { ok: true,  label: t('tarifs.feature_entreprises', { n: 1 }) },
      { ok: true,  label: t('tarifs.feature_factures_unlimited') },
      { ok: true,  label: t('tarifs.feature_ocr', { n: 300 }) },
      { ok: true,  label: t('tarifs.feature_mobile_money', { n: 3 }) },
      { ok: true,  label: t('tarifs.feature_paie', { n: 25 }) },
      { ok: true,  label: t('tarifs.feature_immo_yes') },
      { ok: true,  label: t('tarifs.feature_fne_yes') },
      { ok: true,  label: t('tarifs.feature_support_mail_wa_12h') },
    ],
  },
  // Palier public Cabinet retiré le 2026-05-30 : les cabinets d'expertise
  // comptable rejoignent désormais le Programme Partenaires (licence
  // offerte, géré séparément depuis /admin → Inviter un cabinet).
];

const formatFcfa = (n) => n.toLocaleString('fr-FR');

export default function TarifsPage() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const { user } = useAuth();
  const { recharger: rechargerQuotas } = useQuotas();
  const navigate = useNavigate();
  const location = useLocation();
  const C = getC(dark);
  const [annuel, setAnnuel] = useState(false);
  const [palierActuel, setPalierActuel] = useState(null);
  const [submitting, setSubmitting] = useState(null);

  // Si l'utilisateur est connecté, on récupère son palier actif pour
  // l'afficher différemment (CTA « Votre formule actuelle »).
  useEffect(() => {
    if (!user) return;
    api.get('/abonnement', { silent: true })
      .then(r => setPalierActuel(r.data?.data?.abonnement?.palier))
      .catch(() => {});
  }, [user]);

  const choisirPalier = async (code) => {
    if (!user) {
      // Visiteur public : on redirige vers la création de compte (login)
      // avec un paramètre pour pré-sélectionner le palier après inscription.
      navigate(`/login?plan=${code}`);
      return;
    }
    if (code === palierActuel) return;
    setSubmitting(code);
    try {
      await api.put('/abonnement', {
        palier: code,
        periodicite: annuel ? 'annuel' : 'mensuel',
      });
      setPalierActuel(code);
      // Propage le nouveau palier à tout le contexte Quotas : sans ça,
      // les badges de la sidebar, les modules verrouillés et les boutons
      // gatés resteraient sur l'ancien palier jusqu'à un F5.
      await rechargerQuotas();
      // Modal chaleureuse au lieu d'un toast discret.
      ouvrirCelebrationModal({ palier: code, isNewSignup: false });
    } catch (err) {
      if (!err.handled) toast.error(err.response?.data?.message || t('common.error_generic'));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      {/* ── Header ── */}
      <div style={{
        maxWidth: 1240, margin: '0 auto',
        padding: '32px 36px 0 36px',
      }}>
        <button
          onClick={() => navigate(user ? '/dashboard' : '/login')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.muted, fontSize: 13, fontWeight: 600, padding: 0,
          }}>
          <ArrowLeft size={14} /> {location.state?.from || (user ? t('common.back') : 'ApeX')}
        </button>

        <div style={{ textAlign: 'center', margin: '40px 0 28px' }}>
          <h1 style={{
            fontSize: 38, fontWeight: 900, letterSpacing: '-0.02em',
            color: C.text, margin: '0 0 14px 0',
          }}>
            {t('tarifs.page_title')}
          </h1>
          <p style={{
            fontSize: 15, color: C.muted, maxWidth: 640,
            margin: '0 auto', lineHeight: 1.55,
          }}>
            {t('tarifs.page_subtitle')}
          </p>
        </div>

        {/* Sélecteur mensuel / annuel */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 12, marginBottom: 40,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: !annuel ? C.text : C.muted,
          }}>{t('tarifs.billing_monthly')}</span>
          <button onClick={() => setAnnuel(a => !a)} style={{
            width: 52, height: 28, borderRadius: 14, border: 'none',
            background: annuel ? C.accent : C.border, position: 'relative',
            cursor: 'pointer', transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: 3, left: annuel ? 27 : 3,
              width: 22, height: 22, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }} />
          </button>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: annuel ? C.text : C.muted,
          }}>{t('tarifs.billing_annual')}</span>
          {annuel && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 100,
              background: `${C.accent}20`, color: C.accent,
            }}>{t('tarifs.billing_annual_badge')}</span>
          )}
        </div>
      </div>

      {/* ── Grille des paliers ── */}
      <div style={{
        maxWidth: 1240, margin: '0 auto', padding: '0 36px 60px',
        display: 'grid', gap: 20,
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      }}>
        {PALIERS.map(p => {
          const prixMois = annuel ? Math.round(p.prix_annuel / 12) : p.prix_mensuel;
          const isCurrent = palierActuel === p.code;
          const isFree = p.prix_mensuel === 0;
          return (
            <div key={p.code} style={{
              background: p.highlight
                ? `linear-gradient(135deg, ${p.accent}12, ${p.accent}05)`
                : C.card,
              border: p.highlight ? `2px solid ${p.accent}` : `1.5px solid ${C.border}`,
              borderRadius: 20, padding: '28px 24px',
              display: 'flex', flexDirection: 'column',
              position: 'relative', minHeight: 580,
              boxShadow: p.highlight
                ? (dark ? `0 16px 40px ${p.accent}30` : `0 12px 36px ${p.accent}25`)
                : (dark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 4px 12px rgba(15,23,42,0.05)'),
              transform: p.highlight ? 'translateY(-6px)' : 'none',
            }}>
              {p.highlight && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  padding: '5px 14px', borderRadius: 100,
                  background: p.accent, color: dark ? '#000' : '#fff',
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  <Sparkles size={10} style={{ marginRight: 4, verticalAlign: -1 }} />
                  {t('tarifs.palier_pro_badge')}
                </div>
              )}

              <div style={{
                fontSize: 12, fontWeight: 800, color: p.accent,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
              }}>
                {t(`tarifs.palier_${p.code}`)}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.5, minHeight: 36 }}>
                {t(`tarifs.palier_${p.code}_tagline`)}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, color: C.text }}>
                    {isFree ? '0' : formatFcfa(prixMois)}
                  </span>
                  <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>
                    {t('tarifs.currency_suffix')}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {isFree ? t('tarifs.palier_decouverte_tagline') : t('tarifs.per_month')}
                </div>
                {annuel && !isFree && (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>
                    {t('tarifs.billed_annual', { annual: formatFcfa(p.prix_annuel) })}
                  </div>
                )}
              </div>

              <ul style={{
                margin: 0, padding: 0, listStyle: 'none',
                display: 'flex', flexDirection: 'column', gap: 10, flex: 1,
              }}>
                {p.features(t).map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {f.ok
                      ? <Check size={14} color={p.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                      : <X size={14} color={C.muted} style={{ flexShrink: 0, marginTop: 2, opacity: 0.5 }} />}
                    <span style={{
                      fontSize: 12.5, color: f.ok ? C.text : C.muted,
                      lineHeight: 1.5, opacity: f.ok ? 1 : 0.7,
                    }}>{f.label}</span>
                  </li>
                ))}
              </ul>

              <button onClick={() => choisirPalier(p.code)}
                disabled={isCurrent || submitting === p.code}
                style={{
                  marginTop: 22, padding: '12px 0', borderRadius: 11,
                  border: isCurrent ? `1.5px solid ${C.border}` : 'none',
                  background: isCurrent ? 'transparent' : p.accent,
                  color: isCurrent ? C.muted : (dark ? '#000' : '#fff'),
                  fontSize: 13, fontWeight: 800, cursor: isCurrent ? 'default' : 'pointer',
                  letterSpacing: '0.02em',
                }}>
                {isCurrent
                  ? t('tarifs.cta_current')
                  : (isFree ? t('tarifs.cta_start_free') : t('tarifs.cta_choose'))}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Bandeau de réassurance ── */}
      <div style={{
        background: dark ? '#0D1220' : '#F8FAFC',
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
        padding: '36px 36px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            {t('tarifs.trust_title')}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap',
            fontSize: 13, color: C.sub,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} color={C.accent} /> {t('tarifs.trust_syscohada')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color={C.accent} /> {t('tarifs.trust_dgi')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={16} color={C.accent} /> {t('tarifs.trust_uemoa')}
            </div>
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 36px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: 0 }}>
            <HelpCircle size={20} style={{ verticalAlign: -3, marginRight: 8, color: C.accent }} />
            {t('tarifs.faq_title')}
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <details key={n} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '14px 18px', cursor: 'pointer',
            }}>
              <summary style={{
                fontSize: 14, fontWeight: 700, color: C.text,
                listStyle: 'none', userSelect: 'none',
              }}>
                {t(`tarifs.faq_q${n}`)}
              </summary>
              <div style={{
                fontSize: 13, color: C.sub, lineHeight: 1.65,
                marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
              }}>
                {t(`tarifs.faq_a${n}`)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
