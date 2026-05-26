import axios from 'axios';
import toast from 'react-hot-toast';
import i18next from 'i18next';
import { ouvrirUpgradeModal } from '../components/UpgradeModal.jsx';

// En dev : '/api' est proxifié vers localhost:5000 par vite.config.js.
// En prod : VITE_API_URL doit pointer vers le backend (ex. https://apex-api.onrender.com/api).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Injecter JWT + entreprise à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cw_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Dé-doublonnage des toasts (en cas de rafale 403 sur des requêtes parallèles)
let dernierToastErreur = { code: null, ts: 0 };
const showOnce = (code, message, type = 'error') => {
  const now = Date.now();
  if (dernierToastErreur.code === code && now - dernierToastErreur.ts < 4000) return;
  dernierToastErreur = { code, ts: now };
  toast[type](message);
};

// Gérer les erreurs globalement. Distingue :
//   - 401 : session expirée -> nettoie le storage et renvoie au login
//   - 403 : permission refusée -> toast clair, pas de plantage de page
//   - 5xx ou pas de réponse (réseau) -> toast « erreur serveur »
//   - 4xx métier (400/404/409/422) : laissé au .catch local (les pages
//     savent comment traiter ces cas, ex. validations form)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const t = (key, fallback) => {
      try { return i18next.t(key, { defaultValue: fallback }); } catch { return fallback; }
    };
    const status = err.response?.status;
    const serverMsg = err.response?.data?.message;
    // Permet à un appel d'opter pour le silence (ex. probe optionnel)
    const silent = err.config?.silent;

    if (status === 401) {
      localStorage.removeItem('cw_token');
      localStorage.removeItem('cw_user');
      localStorage.removeItem('cw_entreprise_id');
      if (!window.location.pathname.includes('/login')) {
        if (!silent) showOnce('401', t('common.session_expired', 'Session expirée. Reconnectez-vous.'));
        window.location.href = '/login';
      }
    } else if (status === 403 && !silent) {
      // On affiche TOUJOURS le libellé i18n générique : le message backend
      // (« action read sur le module users non autorisée... ») est utile
      // au debug mais hostile pour l'utilisateur final. On le garde dans
      // la console pour les développeurs.
      if (serverMsg) console.warn('[403]', serverMsg);
      showOnce('403', t('common.permission_denied', 'Action non autorisée pour votre rôle.'));
      // Marqueur pour que les .catch locaux puissent skipper leur propre
      // toast (évite le double « 403 » + « Erreur chargement X »).
      err.handled = true;
    } else if (status === 402 && !silent) {
      // Payment Required = quota d'abonnement atteint. Comportement
      // différent selon le contexte :
      //  - Cabinet en intervention (flag cw_via_cabinet posé par
      //    usePermissions) : toast informatif uniquement, pas de modal
      //    d'upgrade (ce n'est pas au cabinet de décider du palier de
      //    sa PME cliente).
      //  - Sinon : modal d'upgrade contextuel avec détails backend.
      const data = err.response?.data || {};
      if (localStorage.getItem('cw_via_cabinet') === '1') {
        showOnce('402-cabinet',
          'Cette action n\'est pas incluse dans la formule actuelle de la PME. Suggérez à votre client de passer à un palier supérieur.'
        );
      } else {
        ouvrirUpgradeModal({
          type_quota: data.type_quota,
          palier_actuel: data.palier_actuel,
          usage: data.usage,
          plafond: data.plafond,
          message: data.message,
        });
      }
      err.handled = true;
    } else if ((!err.response || status >= 500) && !silent) {
      showOnce('5xx', t('common.server_error', 'Connexion temporairement interrompue avec nos serveurs. Vos données sont bien en sécurité, l\'opération n\'a simplement pas pu être enregistrée. Patientez quelques secondes puis réessayez, ou rechargez la page si le problème persiste.'));
      err.handled = true;
    }
    return Promise.reject(err);
  }
);

export default api;
