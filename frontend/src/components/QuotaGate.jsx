import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.jsx';
import { useQuotas } from '../hooks/useQuotas.jsx';
import { usePermissions } from '../hooks/usePermissions.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { getC } from './UI.jsx';
import { Lock, ArrowRight, Briefcase } from 'lucide-react';
import { ouvrirUpgradeModal } from './UpgradeModal.jsx';

/**
 * Wrapper qui place toute une page (ou une section) en lecture seule
 * quand le module n'est pas inclus dans le palier d'abonnement actuel.
 *
 * Le contenu reste visible (rendu lecture seule via pointer-events:none
 * + opacity réduite) pour que l'utilisateur découvre la fonctionnalité.
 * Un bandeau orange en haut indique pourquoi c'est verrouillé et propose
 * de passer à un palier supérieur.
 *
 * Usage :
 *   <QuotaGate feature="immobilisations">
 *     <ImmobilisationsPage />
 *   </QuotaGate>
 */
export default function QuotaGate({ feature, children }) {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const C = getC(dark);
  const { canAccess, palier, paliierMinimalPour, loading } = useQuotas();
  const { viaCabinet } = usePermissions();
  const { actuelle } = useEntreprise();

  // Pendant le chargement initial, on rend les enfants pour ne pas
  // afficher un flash de "verrouillé" qui s'évanouit aussitôt.
  if (loading) return children;

  // Module disponible : rien à faire, on rend tel quel.
  if (canAccess(feature)) return children;

  // Module verrouillé : on affiche un bandeau + le contenu en lecture seule.
  const palierMin = paliierMinimalPour(feature);
  const palierLabel = t(`tarifs.palier_${palier}`);
  const palierMinLabel = t(`tarifs.palier_${palierMin}`);

  const handleClickCapture = (e) => {
    // Intercepte tout clic à l'intérieur de la zone verrouillée pour
    // bloquer l'action et expliquer pourquoi.
    // On laisse passer les clics sur les liens de navigation explicites
    // (a[href], button[data-allow-readonly]) si jamais une page veut
    // garder certaines interactions visibles.
    const target = e.target.closest('button, a, input, textarea, select');
    if (!target) return;
    if (target.hasAttribute('data-allow-readonly')) return;
    e.preventDefault();
    e.stopPropagation();
    // Cabinet en intervention : pas de modal upgrade (ce n'est pas à lui
    // de décider du palier de la PME). Le bandeau d'info en haut suffit.
    if (viaCabinet) return;
    ouvrirUpgradeModal({
      type_quota: feature,
      palier_actuel: palier,
    });
  };

  const featureLabel = t(`abonnement.feature_${feature}`, { defaultValue: feature });

  return (
    <div style={{ position: 'relative' }}>
      {/* Bandeau différent selon le contexte :
          - PME normale : CTA « Passer à la formule X » qui mène à /tarifs
          - Cabinet en intervention : message d'info, pas de CTA upgrade
            (ce n'est pas au cabinet de décider du palier de son client) */}
      <div style={{
        background: `${C.gold}15`, border: `1px solid ${C.gold}50`,
        borderRadius: 0, padding: '14px 36px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.gold}, #D97706)`,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {viaCabinet ? <Briefcase size={17} /> : <Lock size={17} />}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
            {viaCabinet
              ? `Module « ${featureLabel} » non inclus dans la formule de la PME`
              : t('abonnement.gate_title', { feature: featureLabel })}
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>
            {viaCabinet
              ? <>Le dossier de <strong style={{ color: C.text }}>{actuelle?.nom}</strong> est en formule <strong>{palierLabel}</strong>. Pour activer ce module, votre client doit passer en formule <strong>{palierMinLabel}</strong> ou supérieure — vous pouvez le lui suggérer par mail ou WhatsApp.</>
              : t('abonnement.gate_body', { current: palierLabel, required: palierMinLabel })}
          </div>
        </div>
        {!viaCabinet && (
          <button onClick={() => navigate('/tarifs')} style={{
            padding: '9px 18px', borderRadius: 9, border: 'none',
            background: C.gold, color: '#000', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t('abonnement.upgrade_cta')} <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Zone enfants : tout le contenu est désactivé via pointer-events
          et grisé visuellement. On capture les clics en bulle pour ouvrir
          le modal si l'utilisateur tente quand même quelque chose. */}
      <div
        onClickCapture={handleClickCapture}
        style={{
          opacity: 0.55, filter: 'saturate(0.6)',
          userSelect: 'none',
        }}>
        <fieldset disabled style={{
          border: 'none', padding: 0, margin: 0,
        }}>
          {children}
        </fieldset>
      </div>
    </div>
  );
}
