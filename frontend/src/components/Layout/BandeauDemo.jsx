import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';

/**
 * Bandeau persistant en haut de l'application pour les comptes démo.
 * Affiche un countdown jusqu'à l'expiration du compte (24 h après création)
 * et invite l'utilisateur à créer un compte permanent avant que ses données
 * ne soient supprimées par le cron de nettoyage.
 *
 * Masqué automatiquement pour les comptes permanents (is_demo === false).
 */
export default function BandeauDemo() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  // Refresh toutes les 60 s pour mettre à jour le countdown
  useEffect(() => {
    if (!user?.is_demo) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [user?.is_demo]);

  if (!user?.is_demo || !user?.demo_expires_at) return null;

  const expiresAt = new Date(user.demo_expires_at).getTime();
  const msRestants = expiresAt - now;
  const heuresRestantes = Math.max(0, Math.floor(msRestants / 3_600_000));
  const minutesRestantes = Math.max(0, Math.floor((msRestants % 3_600_000) / 60_000));

  // Couleur dynamique : émeraude > 2h, ambre 30min-2h, rouge < 30min
  const alerte = msRestants < 30 * 60_000;
  const tension = !alerte && msRestants < 2 * 3_600_000;
  const couleur = alerte ? '#EF4444' : tension ? '#F59E0B' : '#0F8A6E';

  return (
    <div style={{
      background: `${couleur}${dark ? '20' : '15'}`,
      borderBottom: `1px solid ${couleur}66`,
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, fontSize: 12.5, color: dark ? '#E5E7EB' : '#1F2937',
      flexWrap: 'wrap',
    }}>
      {alerte
        ? <AlertTriangle size={15} color={couleur} />
        : <Clock size={15} color={couleur} />
      }
      <span style={{ fontWeight: 600 }}>
        {t('demo.banner_title')}
      </span>
      <span style={{ color: couleur, fontWeight: 700, fontFamily: 'monospace' }}>
        {heuresRestantes > 0
          ? t('demo.banner_countdown_hours', { h: heuresRestantes, m: minutesRestantes })
          : t('demo.banner_countdown_minutes', { m: minutesRestantes })}
      </span>
      <span style={{ opacity: 0.8 }}>{t('demo.banner_help')}</span>
      <button
        onClick={() => { logout(); navigate('/?register=1'); }}
        style={{
          background: couleur, color: '#fff', border: 'none', borderRadius: 6,
          padding: '5px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
        {t('demo.banner_cta')}
      </button>
    </div>
  );
}
