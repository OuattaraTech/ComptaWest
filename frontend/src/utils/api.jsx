import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Injecter JWT + entreprise à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cw_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gérer les erreurs globalement
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Nettoyer le stockage local et rediriger vers login
      localStorage.removeItem('cw_token');
      localStorage.removeItem('cw_user');
      localStorage.removeItem('cw_entreprise_id');
      // Éviter une boucle infinie si déjà sur /login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
