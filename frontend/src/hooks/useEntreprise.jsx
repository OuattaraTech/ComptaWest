import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api.jsx';

const EntrepriseContext = createContext(null);

export const EntrepriseProvider = ({ children }) => {
  const [entreprises, setEntreprises] = useState([]);
  const [actuelle, setActuelle] = useState(null);
  const [loading, setLoading] = useState(true);

  // Injecter le header X-Entreprise-Id à chaque requête
  useEffect(() => {
    if (actuelle?.id) {
      api.defaults.headers.common['X-Entreprise-Id'] = actuelle.id;
      localStorage.setItem('cw_entreprise_id', actuelle.id);
    }
  }, [actuelle]);

  const chargerEntreprises = useCallback(async () => {
    try {
      const res = await api.get('/entreprises');
      const liste = res.data.data;
      setEntreprises(liste);

      // Restaurer l'entreprise précédemment sélectionnée
      const savedId = localStorage.getItem('cw_entreprise_id');
      const saved = liste.find(e => e.id === savedId);
      const choix = saved || liste[0] || null;
      setActuelle(choix);
      if (choix) api.defaults.headers.common['X-Entreprise-Id'] = choix.id;
      // Retourne l'entreprise active pour que les appelants puissent décider
      // immédiatement où rediriger (ex: LoginPage → /cabinet si partenaire).
      return choix;
    } catch (err) {
      console.error('Erreur chargement entreprises:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('cw_token');
    if (token) chargerEntreprises();
    else setLoading(false);
  }, [chargerEntreprises]);

  const switchEntreprise = (entreprise, redirectTo = null) => {
    setActuelle(entreprise);
    localStorage.setItem('cw_entreprise_id', entreprise.id);
    api.defaults.headers.common['X-Entreprise-Id'] = entreprise.id;
    // Full reload du contexte applicatif après un switch d'entreprise.
    // Sans ça, les hooks dépendant du contexte (usePermissions, useQuotas,
    // pages métier qui ont déjà fetché leurs données) restent sur l'ancien
    // contexte → l'utilisateur doit recharger manuellement.
    //
    // Si l'appelant n'a pas précisé redirectTo, on choisit la cible
    // automatiquement selon le type d'entreprise :
    //   - cabinet_partenaire → /cabinet (les routes PME n'ont pas de sens)
    //   - pme + on est actuellement sur /cabinet → /dashboard
    //   - pme + ailleurs → reload sur la page courante
    // Évite d'atterrir sur une page incohérente avec le nouveau contexte.
    let cible = redirectTo;
    if (!cible) {
      const path = window.location.pathname;
      if (entreprise.type_compte === 'cabinet_partenaire') {
        cible = '/cabinet';
      } else if (path === '/cabinet' || path.startsWith('/cabinet/') || path === '/admin') {
        cible = '/dashboard';
      }
    }
    if (cible) {
      window.location.href = cible;
    } else {
      window.location.reload();
    }
  };

  const ajouterEntreprise = async (data) => {
    const res = await api.post('/entreprises', data);
    await chargerEntreprises();
    return res.data.data;
  };

  return (
    <EntrepriseContext.Provider value={{
      entreprises, actuelle, loading,
      switchEntreprise, ajouterEntreprise, chargerEntreprises,
    }}>
      {children}
    </EntrepriseContext.Provider>
  );
};

export const useEntreprise = () => useContext(EntrepriseContext);


