import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from './UI.jsx';
import { X, Sparkles, ArrowRight, PartyPopper, Check } from 'lucide-react';

/**
 * Modal de bienvenue après un changement de palier réussi. Met l'accent
 * sur l'aspect humain de l'achat : ton chaleureux, fonctionnalités
 * débloquées rappelées en bullet points, et CTA vers le dashboard.
 *
 * Singleton listener comme UpgradeModal : appel impératif depuis n'importe
 * où via ouvrirCelebrationModal({ palier, isNewSignup }).
 */

let listener = null;
export function ouvrirCelebrationModal(info) {
  if (listener) listener(info);
  else console.warn('[celebration] modal pas encore monté, info ignorée:', info);
}

// Bullets de bienvenue par palier — synthèse de ce qui vient d'être
// débloqué. Décliné en clés i18n pour respecter le bilinguisme.
const HIGHLIGHTS = {
  decouverte: ['celebration.h_factures10', 'celebration.h_fne', 'celebration.h_dashboard'],
  starter:    ['celebration.h_ocr30', 'celebration.h_mm1', 'celebration.h_factures_unlim', 'celebration.h_fne'],
  pro:        ['celebration.h_ocr300', 'celebration.h_mm3', 'celebration.h_paie25', 'celebration.h_immo', 'celebration.h_support'],
  cabinet:    ['celebration.h_users_unlim', 'celebration.h_ent15', 'celebration.h_api', 'celebration.h_paie_unlim', 'celebration.h_support_prio'],
};

export default function CelebrationModal() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const C = getC(dark);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    listener = (i) => setInfo(i || {});
    return () => { listener = null; };
  }, []);

  if (!info) return null;

  const palier = info.palier || 'starter';
  const isNew = !!info.isNewSignup;
  const palierLabel = t(`tarifs.palier_${palier}`);
  const highlights = HIGHLIGHTS[palier] || HIGHLIGHTS.starter;

  const fermer = () => setInfo(null);
  const continuer = () => { fermer(); navigate('/dashboard'); };

  return (
    <div onClick={fermer} style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.card, borderRadius: 20, maxWidth: 500, width: '100%',
        border: `1.5px solid ${C.accent}40`,
        boxShadow: `0 30px 80px ${C.accent}30`,
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Décor visuel — gradient + cercles flous évoquant la fête. */}
        <div style={{
          padding: '36px 28px 24px',
          background: `linear-gradient(135deg, ${C.accent}25, #4E8BF522)`,
          borderBottom: `1px solid ${C.border}`,
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -40, left: -20, width: 160, height: 160,
            borderRadius: '50%', background: `${C.accent}30`, filter: 'blur(40px)',
          }} />
          <div style={{
            position: 'absolute', bottom: -50, right: -30, width: 180, height: 180,
            borderRadius: '50%', background: '#4E8BF530', filter: 'blur(50px)',
          }} />

          <button onClick={fermer} style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(0,0,0,0.15)', border: 'none', cursor: 'pointer',
            color: C.text, padding: 6, borderRadius: 8, display: 'flex',
          }}>
            <X size={16} />
          </button>

          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: '0 auto 14px',
            background: `linear-gradient(135deg, ${C.accent}, #4E8BF5)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: `0 12px 30px ${C.accent}50`,
            position: 'relative', zIndex: 1,
          }}>
            <PartyPopper size={30} />
          </div>

          <div style={{
            fontSize: 11, fontWeight: 800, color: C.accent,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
            position: 'relative', zIndex: 1,
          }}>
            {isNew ? t('celebration.kicker_new') : t('celebration.kicker_upgrade')}
          </div>
          <div style={{
            fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1.2,
            marginBottom: 8, position: 'relative', zIndex: 1,
          }}>
            {isNew
              ? t('celebration.title_new',     { palier: palierLabel })
              : t('celebration.title_upgrade', { palier: palierLabel })}
          </div>
          <div style={{
            fontSize: 13, color: C.sub, lineHeight: 1.55,
            maxWidth: 380, margin: '0 auto', position: 'relative', zIndex: 1,
          }}>
            {t('celebration.subtitle')}
          </div>
        </div>

        <div style={{ padding: '22px 28px 26px' }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.accent,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Sparkles size={13} />
            {t('celebration.highlights_title')}
          </div>
          <ul style={{
            listStyle: 'none', padding: 0, margin: '0 0 22px 0',
            display: 'flex', flexDirection: 'column', gap: 9,
          }}>
            {highlights.map(key => (
              <li key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: C.text, lineHeight: 1.55 }}>
                <Check size={15} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>

          <div style={{
            background: `${C.accent}10`, border: `1px solid ${C.accent}25`,
            borderRadius: 10, padding: '11px 14px',
            fontSize: 12, color: C.sub, lineHeight: 1.55, marginBottom: 18,
            fontStyle: 'italic',
          }}>
            {t('celebration.thanks')}
          </div>

          <button onClick={continuer} style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: `linear-gradient(135deg, ${C.accent}, #00A882)`,
            color: dark ? '#000' : '#fff', fontSize: 14, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            boxShadow: `0 10px 24px ${C.accent}40`,
          }}>
            {t('celebration.cta')} <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
