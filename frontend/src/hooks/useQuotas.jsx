import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../utils/api.jsx';
import { useAuth } from './useAuth.jsx';
import { useEntreprise } from './useEntreprise.jsx';
import { ouvrirUpgradeModal } from '../components/UpgradeModal.jsx';

/**
 * Hook + Provider : récupère l'abonnement actif et expose des helpers
 * pour décider quelles fonctionnalités sont accessibles dans le palier
 * de l'utilisateur courant.
 *
 * canAccess(feature)
 *   - 'immobilisations' / 'api' / 'paie' / 'paiement_fournisseurs'
 *     → booléen (true si le module est inclus)
 *   - 'factures' / 'ocr' / 'utilisateurs' / 'entreprises'
 *     → booléen (true si on n'a pas atteint le plafond)
 *
 * Le hook se recharge automatiquement quand l'entreprise active change
 * (multi-entreprises : chaque entreprise a son propre palier).
 */

const QuotasContext = createContext(null);

export function QuotasProvider({ children }) {
  const { user } = useAuth();
  const { actuelle } = useEntreprise();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const recharger = useCallback(async () => {
    if (!user || !actuelle?.id) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const r = await api.get('/abonnement', { silent: true });
      setData(r.data?.data || null);
    } catch {
      // Si la migration 022 n'est pas appliquée, le backend renvoie une
      // 500. On bascule sur null : tous les modules apparaissent comme
      // accessibles (fail-open), évitant qu'un déploiement non migré
      // bloque toute l'app.
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, actuelle?.id]);

  useEffect(() => { recharger(); }, [recharger]);

  const canAccess = useCallback((feature) => {
    // Pas de données chargées (fail-open) : on autorise tout pour ne pas
    // bloquer un utilisateur si l'API d'abonnement est down. Le backend
    // re-vérifie de toute façon.
    if (!data) return true;
    const q = data.quotas || {};
    const u = data.usage  || {};
    switch (feature) {
      case 'immobilisations':       return !!q.immobilisations;
      case 'api':                   return !!q.api_publique;
      case 'paie':                  return (q.paie_bulletins ?? 0) > 0
                                        || q.paie_bulletins === null; // null = illimité
      case 'paiement_fournisseurs': return (q.paiement_fournisseurs ?? 0) > 0;
      case 'factures':              return q.factures_mois == null
                                        || (u.factures_mois ?? 0) < q.factures_mois;
      case 'ocr':                   return (q.ocr_scans_mois ?? 0) > 0
                                        && ((u.ocr_scans_mois ?? 0) < q.ocr_scans_mois);
      case 'utilisateurs':          return q.utilisateurs == null
                                        || (u.utilisateurs ?? 0) < q.utilisateurs;
      case 'entreprises':           return (u.entreprises ?? 1) < (q.entreprises ?? 1);
      default:                      return true;
    }
  }, [data]);

  /** Palier minimal qui débloque une feature (utile pour les CTA UI). */
  const paliierMinimalPour = useCallback((feature) => {
    const matrice = {
      immobilisations: 'pro',
      api:             'pro',         // l'API publique reste un + Pro (palier Cabinet public retiré)
      paie:            'pro',
      paiement_fournisseurs: 'starter',
      factures:        'starter',
      ocr:             'starter',
      utilisateurs:    'starter',
      entreprises:     'pro',         // mutualisé Pro (palier Cabinet public retiré)
    };
    return matrice[feature] || 'pro';
  }, []);

  /**
   * Combine canAccess + ouverture automatique du modal d'upgrade.
   * À utiliser sur le clic des boutons qui déclenchent une action
   * payante (scan OCR, lien Mobile Money, etc.) :
   *
   *   if (!requestAccess('ocr')) return;
   *   setShowScanner(true);
   *
   * Retourne true si l'action peut continuer, false sinon (et le modal
   * s'est déjà ouvert).
   */
  const requestAccess = useCallback((feature) => {
    if (canAccess(feature)) return true;
    ouvrirUpgradeModal({
      type_quota: feature,
      palier_actuel: data?.abonnement?.palier,
    });
    return false;
  }, [canAccess, data]);

  const value = {
    data, loading,
    palier: data?.abonnement?.palier || 'decouverte',
    quotas: data?.quotas || null,
    usage:  data?.usage  || null,
    canAccess,
    requestAccess,
    paliierMinimalPour,
    recharger,
  };

  return <QuotasContext.Provider value={value}>{children}</QuotasContext.Provider>;
}

export function useQuotas() {
  const ctx = useContext(QuotasContext);
  if (!ctx) {
    throw new Error('useQuotas doit être utilisé à l\'intérieur de <QuotasProvider>');
  }
  return ctx;
}
