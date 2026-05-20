import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.jsx';
import { useQuotas } from '../hooks/useQuotas.jsx';
import { getC } from './UI.jsx';
import { X, Lock, ArrowRight, Sparkles } from 'lucide-react';

/**
 * Modal d'upgrade — apparaît quand l'API renvoie une 402 (QUOTA_ATTEINT)
 * ou quand un composant local appelle ouvrirUpgradeModal() manuellement.
 *
 * Bus de communication ultra simple : un singleton qui notifie une
 * fonction abonnée, posée par ce composant au montage. Évite d'introduire
 * Redux/Zustand pour un seul cas d'usage très ponctuel.
 */

let listener = null;
export function ouvrirUpgradeModal(info) {
  if (listener) listener(info);
  else console.warn('[upgrade] modal pas encore monté, info ignorée:', info);
}

const PALIER_LIBELLES_FALLBACK = {
  decouverte: 'Découverte', starter: 'Starter', pro: 'Pro', cabinet: 'Cabinet',
};

export default function UpgradeModal() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const C = getC(dark);
  const { palier } = useQuotas();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    listener = (i) => setInfo(i || {});
    return () => { listener = null; };
  }, []);

  if (!info) return null;

  const typeQuota = info.type_quota || info.feature || 'feature';
  const palierActuel = info.palier_actuel || palier || 'decouverte';
  const palierLabel = t(`tarifs.palier_${palierActuel}`, { defaultValue: PALIER_LIBELLES_FALLBACK[palierActuel] });

  // Message contextuel selon le type de quota dépassé. Fallback générique.
  const messageContexte = (() => {
    const usage   = info.usage   ?? '—';
    const plafond = info.plafond ?? '—';
    switch (typeQuota) {
      case 'factures':        return t('abonnement.quota_error_factures',       { palier: palierLabel, plafond, usage });
      case 'ocr':             return t('abonnement.quota_error_ocr',            { palier: palierLabel, plafond, usage });
      case 'utilisateurs':    return t('abonnement.quota_error_utilisateurs',   { palier: palierLabel, plafond, usage });
      case 'entreprises':     return t('abonnement.quota_error_entreprises',    { palier: palierLabel });
      case 'immobilisations': return t('abonnement.quota_error_immobilisations',{ palier: palierLabel });
      case 'api':             return t('abonnement.quota_error_api',            { palier: palierLabel });
      case 'paie':            return t('abonnement.quota_error_paie',           { palier: palierLabel });
      case 'paiement_fournisseurs': return t('abonnement.quota_error_paiement_fournisseurs', { palier: palierLabel });
      default:                return info.message || t('abonnement.quota_error_default', { palier: palierLabel });
    }
  })();

  const fermer = () => setInfo(null);
  const allerTarifs = () => { fermer(); navigate('/tarifs'); };

  return (
    <div onClick={fermer} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.card, borderRadius: 18, maxWidth: 480, width: '100%',
        border: `1.5px solid ${C.border}`, boxShadow: '0 30px 70px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* En-tête avec gradient */}
        <div style={{
          padding: '24px 24px 18px',
          background: `linear-gradient(135deg, ${C.accent}15, ${C.gold}12)`,
          borderBottom: `1px solid ${C.border}`,
          position: 'relative',
        }}>
          <button onClick={fermer} style={{
            position: 'absolute', top: 14, right: 14,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.muted, padding: 4, display: 'flex',
          }}>
            <X size={18} />
          </button>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${C.accent}, ${C.gold})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', marginBottom: 12,
          }}>
            <Lock size={22} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4 }}>
            {t('abonnement.quota_error_title')}
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
            {t('abonnement.current_plan')} : <span style={{ color: C.accent }}>{palierLabel}</span>
          </div>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.65, marginBottom: 22 }}>
            {messageContexte}
          </div>

          <div style={{
            background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 11,
            padding: '14px 16px', marginBottom: 22,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <Sparkles size={16} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
              {t('abonnement.upgrade_benefit')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fermer} style={{
              flex: 1, padding: '12px 0', borderRadius: 10,
              border: `1.5px solid ${C.border}`, background: 'transparent',
              color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t('common.close')}</button>
            <button onClick={allerTarifs} style={{
              flex: 2, padding: '12px 0', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${C.accent}, #00A882)`,
              color: dark ? '#000' : '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {t('abonnement.upgrade_cta')} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
