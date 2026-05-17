import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import { usePermissions } from '../hooks/usePermissions.jsx';
import { getC } from './UI.jsx';
import { Eye } from 'lucide-react';

/**
 * Affiche conditionnellement ses enfants si l'utilisateur peut effectuer
 * (module, action). Utile pour masquer un bouton « Nouveau », « Supprimer »…
 *
 *   <Can module="factures" action="create">
 *     <button>+ Nouvelle facture</button>
 *   </Can>
 */
export function Can({ module, action, fallback = null, children }) {
  const { can } = usePermissions();
  if (!can(module, action)) return fallback;
  return children;
}

/**
 * Bandeau « Mode lecture seule » à afficher en haut d'une page quand
 * l'utilisateur n'a aucun droit d'écriture sur le module. Sert de hint
 * visuel pour l'auditeur, le rôle lecture, etc.
 */
export function ReadOnlyBanner({ module }) {
  const { t } = useTranslation();
  const { can, role } = usePermissions();
  const { dark } = useTheme();
  const C = getC(dark);

  // Si l'utilisateur peut écrire d'une manière ou d'une autre, pas de bandeau
  const peutEcrire = can(module, 'create') || can(module, 'update') || can(module, 'delete');
  if (peutEcrire) return null;
  // Si l'utilisateur ne peut même pas lire, c'est PermissionGate qui gère
  if (!can(module, 'read')) return null;

  return (
    <div style={{
      background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 11,
      padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Eye size={15} color={C.blue} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: C.sub }}>
        {t('common.read_only_mode', { role: role ? t(`roles.${role}`, { defaultValue: role }) : '—' })}
      </span>
    </div>
  );
}

export default Can;
