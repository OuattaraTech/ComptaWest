/**
 * Configuration i18next pour ApeX.
 *
 * - Langue par défaut : français (cible Côte d'Ivoire).
 * - Détection : ordre localStorage → navigator → fallback.
 * - Clé localStorage : `cw_langue` (utilisée aussi par useLanguage pour
 *   pré-sélectionner la langue avant l'auth).
 *
 * Pour ajouter une nouvelle langue : créer locales/<code>.json,
 * importer ici, et étendre LANGUES_DISPONIBLES dans useLanguage.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import fr from './locales/fr.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    interpolation: { escapeValue: false }, // React échappe déjà
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'cw_langue',
      caches: ['localStorage'],
    },
  });

export default i18n;
