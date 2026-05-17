import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import { usePermissions } from '../hooks/usePermissions.jsx';
import { getC } from './UI.jsx';
import { ShieldAlert } from 'lucide-react';

/**
 * Gardien d'accès pour une route ou un bloc d'UI. Vérifie can(module, action)
 * et :
 *   - children si autorisé
 *   - fallback (par défaut : message « accès refusé » propre) si refusé
 *   - rien tant que le chargement de la matrice est en cours (évite le
 *     flash refus avant l'arrivée du token)
 *
 * Usage typique : <PermissionGate module="paie" action="read"><RHPage /></PermissionGate>
 */
export default function PermissionGate({ module, action = 'read', children, fallback }) {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const C = getC(dark);
  const { can, role, loading } = usePermissions();

  // Tant qu'on n'a pas la matrice, on évite d'afficher refusé à tort
  if (loading) return null;

  if (can(module, action)) return children;

  if (fallback !== undefined) return fallback;

  return (
    <div style={{
      padding: '60px 36px', minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    }}>
      <div style={{
        background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 16,
        padding: '32px 36px', maxWidth: 520, width: '100%',
        boxShadow: C.shadow, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
          background: `${C.red}15`, color: C.red,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldAlert size={26} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>
          {t('common.access_denied_title')}
        </div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.55, marginBottom: 18 }}>
          {t('common.access_denied_body', {
            role: role ? t(`roles.${role}`, { defaultValue: role }) : '—',
          })}
        </div>
        <div style={{
          fontSize: 11, color: C.muted, padding: '8px 12px',
          background: dark ? '#0D1220' : C.cardAlt, borderRadius: 8,
          fontFamily: 'monospace',
        }}>
          {module} · {action}
        </div>
      </div>
    </div>
  );
}
