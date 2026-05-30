import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from '../components/UI.jsx';
import api from '../utils/api.jsx';
import { Loader2, Check } from 'lucide-react';

/**
 * /checkout/mock/:id
 *
 * Page d'attente du paiement en mode mock (PAYMENT_MODE=mock côté serveur).
 * Simule un paiement réussi : affiche un loader pendant 3 secondes puis
 * appelle POST /abonnement/checkout/:id/mock-success qui marque le paiement
 * success et active l'abonnement, exactement comme le ferait un webhook
 * Wave/Orange/Stripe en production.
 */
export default function CheckoutMockPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dark } = useTheme();
  const C = getC(dark);
  const [etat, setEtat] = useState('attente'); // attente | succes | erreur
  const [message, setMessage] = useState('Connexion au fournisseur de paiement…');

  useEffect(() => {
    let cancelled = false;
    const sequence = async () => {
      // Étape 1 : 1 s
      await wait(1000);
      if (cancelled) return;
      setMessage('Validation du paiement par le fournisseur…');
      // Étape 2 : 1,5 s
      await wait(1500);
      if (cancelled) return;
      setMessage('Activation de votre abonnement…');
      // Étape 3 : appel à l'endpoint mock-success
      try {
        await api.post(`/abonnement/checkout/${id}/mock-success`);
        if (cancelled) return;
        setEtat('succes');
        setMessage('Paiement confirmé. Redirection vers votre tableau de bord…');
        await wait(1500);
        if (cancelled) return;
        navigate(`/checkout/success?paiement=${id}`);
      } catch (err) {
        if (cancelled) return;
        setEtat('erreur');
        setMessage(err.response?.data?.message || 'Impossible de finaliser le paiement simulé.');
      }
    };
    sequence();
    return () => { cancelled = true; };
  }, [id, navigate]);

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg, color: C.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif',
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 20, padding: '40px 36px', maxWidth: 460, textAlign: 'center',
      }}>
        <div style={{ marginBottom: 24 }}>
          {etat === 'attente' && <Loader2 size={56} style={{ color: C.accent, animation: 'spin 1s linear infinite' }} />}
          {etat === 'succes'  && <div style={{
            width: 64, height: 64, borderRadius: '50%', background: C.accent,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}><Check size={36} color="#fff" /></div>}
          {etat === 'erreur'  && <div style={{ fontSize: 48 }}>⚠️</div>}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>
          {etat === 'succes' ? 'Paiement confirmé' : etat === 'erreur' ? 'Échec' : 'Paiement en cours…'}
        </h2>
        <p style={{ color: C.muted, lineHeight: 1.5, margin: 0 }}>{message}</p>
        <p style={{ fontSize: 11, color: C.muted, marginTop: 24, opacity: 0.7 }}>
          Mode démo · simulation locale, aucun fournisseur réel sollicité
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
