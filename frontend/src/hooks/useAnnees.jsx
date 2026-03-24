import { useState, useEffect } from 'react';
import api from '../utils/api.jsx';

/**
 * Hook partagé — charge les années disponibles depuis le backend.
 * Retourne toujours au moins l'année courante.
 * Re-charge quand l'entreprise change (entrepriseId transmis via header Axios).
 */
export const useAnnees = (entrepriseId) => {
  const anneeActuelle = String(new Date().getFullYear());
  const [annees, setAnnees]   = useState([anneeActuelle]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entrepriseId) { setLoading(false); return; }

    let annule = false;
    setLoading(true);

    api.get('/dashboard/annees')
      .then(res => {
        if (annule) return;
        const liste = res.data.data || [];
        // Garantir que l'année courante est toujours présente
        if (!liste.includes(anneeActuelle)) liste.unshift(anneeActuelle);
        setAnnees(liste);
      })
      .catch(() => {
        if (!annule) setAnnees([anneeActuelle]);
      })
      .finally(() => { if (!annule) setLoading(false); });

    return () => { annule = true; };
  }, [entrepriseId]);

  return { annees, loading };
};
