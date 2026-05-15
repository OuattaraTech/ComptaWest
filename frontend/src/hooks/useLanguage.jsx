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
import { useCallback, useEffect, useRef } from 'react';
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
  // On retient quel utilisateur a déjà été synchronisé avec sa préférence
  // serveur. Sans cela, le useEffect ci-dessous reverrait i18n.language vers
  // user.langue à chaque changement local (car user.langue ne suit que par
  // un fetch /auth/me), créant une boucle qui annule tout switch manuel.
  const syncedUserId = useRef(null);

  // Au login (ou changement d'utilisateur) : applique la préférence serveur
  // UNE SEULE FOIS pour ce user. Les changements manuels ultérieurs ne sont
  // pas réécrasés par cet effet.
  useEffect(() => {
    if (!user) {
      syncedUserId.current = null;
      return;
    }
    if (syncedUserId.current === user.id) return;
    syncedUserId.current = user.id;
    if (user.langue && user.langue !== i18n.language) {
      i18n.changeLanguage(user.langue);
    }
  }, [user, i18n]);

  const change = useCallback(async (code) => {
    await i18n.changeLanguage(code);
    if (user) {
      // Met à jour le marqueur de sync pour éviter qu'un re-render
      // ne déclenche un retour à l'ancienne valeur de user.langue.
      syncedUserId.current = user.id;
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
