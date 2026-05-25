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

  const switchEntreprise = (entreprise) => {
    setActuelle(entreprise);
    localStorage.setItem('cw_entreprise_id', entreprise.id);
    api.defaults.headers.common['X-Entreprise-Id'] = entreprise.id;
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


