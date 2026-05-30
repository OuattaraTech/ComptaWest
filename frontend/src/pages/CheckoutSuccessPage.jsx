import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from '../components/UI.jsx';
import api from '../utils/api.jsx';
import { Check, Loader2 } from 'lucide-react';

/**
 * /checkout/success?paiement=<id>
 *
 * Page de confirmation finale (atterrissage après retour du PSP ou de la
 * page mock). Vérifie le statut auprès du backend et redirige vers le
 * dashboard après 3 secondes. Affiche le récap du paiement.
 */
export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const paiementId = searchParams.get('paiement');
  const navigate = useNavigate();
  const { dark } = useTheme();
  const C = getC(dark);
  const [paiement, setPaiement] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!paiementId) {
      navigate('/dashboard');
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const verifier = async () => {
      attempts++;
      try {
        const { data } = await api.get(`/abonnement/checkout/${paiementId}/status`);
        if (cancelled) return;
        if (data.data.statut === 'success') {
          setPaiement(data.data);
          // Redirection auto après 3 s
          setTimeout(() => !cancelled && navigate('/dashboard'), 3500);
        } else if (data.data.statut === 'pending' && attempts < 15) {
          // Polling : la webhook n'a peut-être pas encore tourné, on retente
          setTimeout(verifier, 1000);
        } else if (data.data.statut === 'failed' || data.data.statut === 'expired') {
          setErreur(data.data.erreur || `Paiement ${data.data.statut}.`);
        } else {
          setErreur('Le paiement n\'a pas pu être confirmé après plusieurs tentatives.');
        }
      } catch (err) {
        if (cancelled) return;
        setErreur(err.response?.data?.message || 'Erreur lors de la vérification du paiement.');
      }
    };
    verifier();
    return () => { cancelled = true; };
  }, [paiementId, navigate]);

  const formatFcfa = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
  const libellePaliers = { starter: 'Starter', pro: 'Pro' };

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg, color: C.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif',
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 20, padding: '44px 38px', maxWidth: 480, textAlign: 'center',
      }}>
        {!paiement && !erreur && (
          <>
            <Loader2 size={48} style={{ color: C.accent, animation: 'spin 1s linear infinite', marginBottom: 20 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Confirmation en cours…</h2>
            <p style={{ color: C.muted, marginTop: 10 }}>
              Nous validons le paiement auprès du fournisseur. Cela prend quelques secondes.
            </p>
          </>
        )}
        {paiement && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: C.accent,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 22,
            }}><Check size={42} color="#fff" /></div>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Bienvenue sur la formule {libellePaliers[paiement.palier] || paiement.palier}
            </h2>
            <p style={{ color: C.sub, margin: '0 0 24px' }}>
              Paiement de <strong>{formatFcfa(paiement.montant_fcfa)}</strong> confirmé.
              Votre abonnement est actif.
            </p>
            <div style={{
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '14px 18px', textAlign: 'left',
              fontSize: 13, color: C.sub, lineHeight: 1.7, marginBottom: 24,
            }}>
              <div>Formule : <strong style={{ color: C.text }}>{libellePaliers[paiement.palier]}</strong> ({paiement.periodicite})</div>
              <div>Moyen : <strong style={{ color: C.text, textTransform: 'capitalize' }}>{paiement.moyen}</strong></div>
              <div>Montant : <strong style={{ color: C.text }}>{formatFcfa(paiement.montant_fcfa)}</strong></div>
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
              Redirection automatique vers votre tableau de bord…
            </p>
          </>
        )}
        {erreur && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>😕</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>Paiement non confirmé</h2>
            <p style={{ color: C.muted, margin: '0 0 24px' }}>{erreur}</p>
            <button onClick={() => navigate('/tarifs')} style={{
              padding: '12px 24px', background: C.accent, color: '#000',
              border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
            }}>Retour aux tarifs</button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
