/**
 * Hook de gestion de la langue d'interface.
 *
 * - Synchronise la langue d'i18next avec localStorage (clé `cw_langue`).
 * - Si l'utilisateur est connecté, persiste aussi la préférence côté serveur
 *   via PUT /auth/me/langue, pour qu'elle suive l'utilisateur sur d'autres
 *   appareils.
 * - Au login/restauration de session, applique la langue stockée serveur-side
 *   si elle diffère du localStorage (la prochaine connexion respecte donc le
 *   choix précédent).
 */
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.jsx';
import { useAuth } from './useAuth.jsx';

export const LANGUES_DISPONIBLES = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English',  short: 'EN' },
];

export function useLanguage() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  // Au login : si l'utilisateur a une préférence serveur différente de la
  // langue locale actuelle, on l'applique (priorité au choix sauvegardé).
  useEffect(() => {
    if (user?.langue && user.langue !== i18n.language) {
      i18n.changeLanguage(user.langue);
    }
  }, [user?.langue, i18n]);

  const change = useCallback(async (code) => {
    await i18n.changeLanguage(code);
    if (user) {
      try {
        await api.put('/auth/me/langue', { langue: code });
      } catch {
        // En cas d'échec serveur on garde le changement local ; il sera
        // resynchronisé au prochain login.
      }
    }
  }, [i18n, user]);

  return {
    langue: i18n.language?.slice(0, 2) || 'fr',
    change,
    langues: LANGUES_DISPONIBLES,
  };
}
