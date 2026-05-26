import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api.jsx';
import { useEntreprise } from './useEntreprise.jsx';

/**
 * Charge et expose les permissions de l'utilisateur courant sur
 * l'entreprise sélectionnée. Source de vérité : GET /auth/me/permissions
 * (matrice du backend projetée pour le rôle de l'utilisateur).
 *
 * Re-fetch automatique à chaque changement d'entreprise (actuelle.id).
 *
 * Exposé :
 *   role            : rôle string ('proprietaire', 'commercial', ...)
 *   can(module, action)         : true si l'action est autorisée
 *   peutVoirChamp(module, champ): true si le champ n'est PAS masqué
 *   loading         : true tant que le 1er fetch n'est pas revenu
 */
const PermissionsContext = createContext(null);

export const PermissionsProvider = ({ children }) => {
  const { actuelle } = useEntreprise();
  const [data, setData] = useState({ role: null, can: {}, voitChamps: {} });
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!actuelle?.id) return;
    setLoading(true);
    try {
      const res = await api.get('/auth/me/permissions');
      setData(res.data.data || { role: null, can: {}, voitChamps: {} });
    } catch (err) {
      // En cas d'échec on garde une matrice vide : tout sera refusé côté UI,
      // ce qui est l'attitude la plus sûre. Les routes backend re-vérifient
      // de toute façon.
      console.error('Erreur chargement permissions:', err?.response?.data?.message || err.message);
      setData({ role: null, can: {}, voitChamps: {} });
    } finally {
      setLoading(false);
    }
  }, [actuelle?.id]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  // Flag global lu par l'intercepteur axios (utils/api.jsx) pour adapter
  // les comportements automatiques (ex: pas de modal d'upgrade sur 402
  // si on intervient via cabinet — ce n'est pas au cabinet de décider du
  // palier de la PME). Stocké en localStorage pour être accessible hors
  // React.
  useEffect(() => {
    if (data.via_cabinet) localStorage.setItem('cw_via_cabinet', '1');
    else localStorage.removeItem('cw_via_cabinet');
  }, [data.via_cabinet]);

  const can = useCallback((module, action) => {
    const actions = data.can?.[module];
    return Array.isArray(actions) && actions.includes(action);
  }, [data]);

  const peutVoirChamp = useCallback((module, champ) => {
    const visibles = data.voitChamps?.[module];
    // Si le module n'est pas listé dans VISIBILITY, le champ est public
    if (!visibles) return true;
    return visibles.includes(champ);
  }, [data]);

  return (
    <PermissionsContext.Provider value={{
      role: data.role,
      can,
      peutVoirChamp,
      loading,
      viaCabinet: !!data.via_cabinet,
      refresh: fetchPermissions,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    // Fallback : on renvoie un can() qui refuse tout pour ne pas planter
    // les composants qui s'utilisent en dehors du provider.
    return { role: null, can: () => false, peutVoirChamp: () => true, loading: false, viaCabinet: false, refresh: () => {} };
  }
  return ctx;
};
