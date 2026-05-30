import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from '../components/UI.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../utils/api.jsx';
import LogoFournisseur from '../components/LogoFournisseur.jsx';
import LogoApex from '../components/LogoApex.jsx';
import { CreditCard, Loader2, ArrowLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * /checkout/:palier?periodicite=mensuel|annuel
 *
 * Récap du palier choisi + 3 boutons de paiement (Wave / Orange / Carte
 * bancaire via Stripe). Au clic, POST /api/abonnement/checkout puis
 * window.location vers l'URL de redirection PSP.
 */

const PALIERS = {
  starter: { libelle: 'Starter', prix_mensuel: 10000, prix_annuel: 100000, accent: '#4E8BF5' },
  pro:     { libelle: 'Pro',     prix_mensuel: 25000, prix_annuel: 240000, accent: '#10B981' },
};

const MOYENS = [
  { code: 'wave',   libelle: 'Wave',           fournisseur: 'wave',         hint: 'Paiement instantané · 0 % de frais pour vous' },
  { code: 'orange', libelle: 'Orange Money',   fournisseur: 'orange_money', hint: 'Paiement instantané · USSD ou QR' },
  { code: 'stripe', libelle: 'Carte bancaire', fournisseur: 'stripe',       hint: 'Visa, Mastercard, Amex · sécurisé Stripe' },
];

const formatFcfa = (n) => n.toLocaleString('fr-FR') + ' FCFA';

export default function CheckoutPage() {
  const { palier: palierCode } = useParams();
  const [searchParams] = useSearchParams();
  const periodicite = searchParams.get('periodicite') === 'annuel' ? 'annuel' : 'mensuel';
  const { dark } = useTheme();
  const { user } = useAuth();
  const C = getC(dark);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null); // 'wave' | 'orange' | 'stripe'

  const palier = PALIERS[palierCode];
  if (!palier) {
    return <Centered C={C}><p style={{ color: C.text }}>Palier inconnu. <a href="/tarifs" style={{ color: C.accent }}>Retour aux tarifs</a></p></Centered>;
  }

  const montant = periodicite === 'annuel' ? palier.prix_annuel : palier.prix_mensuel;

  const lancerPaiement = async (moyen) => {
    if (!user) {
      navigate(`/login?plan=${palierCode}&periodicite=${periodicite}`);
      return;
    }
    setLoading(moyen);
    try {
      const { data } = await api.post('/abonnement/checkout', {
        palier: palierCode, periodicite, moyen,
      });
      const { url_redirection, mode_psp } = data.data;
      if (mode_psp === 'mock') {
        // Mode mock : navigation interne vers la page d'attente simulée
        navigate(`/checkout/mock/${data.data.paiement_id}`);
      } else {
        // Mode live : on quitte le SPA vers le PSP
        window.location.href = url_redirection;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Impossible de démarrer le paiement');
      setLoading(null);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg, color: C.text,
      padding: '40px 20px',
      fontFamily: '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button onClick={() => navigate('/tarifs')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10,
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.text, cursor: 'pointer', marginBottom: 28,
        }}>
          <ArrowLeft size={16} /> Retour
        </button>

        <LogoApex height={36} textColor={C.text} />

        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '24px 0 8px', letterSpacing: '-0.02em' }}>
          Finaliser l'abonnement {palier.libelle}
        </h1>
        <p style={{ color: C.sub, marginTop: 0, marginBottom: 32 }}>
          Choisissez votre moyen de paiement. La confirmation est instantanée et votre
          espace est débloqué dès le retour du fournisseur.
        </p>

        {/* Récap */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 24, marginBottom: 28,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Formule {palier.libelle} · {periodicite === 'annuel' ? 'Annuelle' : 'Mensuelle'}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{formatFcfa(montant)}</div>
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {periodicite === 'annuel'
              ? <>Soit {formatFcfa(Math.round(montant / 12))} / mois équivalent · économie de {Math.round((1 - (montant / (palier.prix_mensuel * 12))) * 100)} % par rapport au mensuel.</>
              : <>Vous pouvez résilier à tout moment depuis votre espace Paramètres → Abonnement.</>}
          </div>
        </div>

        {/* Moyens de paiement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {MOYENS.map(m => (
            <button
              key={m.code}
              onClick={() => lancerPaiement(m.code)}
              disabled={loading !== null}
              style={{
                background: C.card, border: `1.5px solid ${C.border}`,
                borderRadius: 14, padding: '18px 22px',
                display: 'flex', alignItems: 'center', gap: 18,
                cursor: loading === null ? 'pointer' : 'not-allowed',
                opacity: loading !== null && loading !== m.code ? 0.5 : 1,
                color: C.text, fontFamily: 'inherit', textAlign: 'left',
                transition: 'border-color 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => loading === null && (e.currentTarget.style.borderColor = palier.accent)}
              onMouseLeave={e => loading === null && (e.currentTarget.style.borderColor = C.border)}
            >
              {m.code === 'stripe'
                ? <div style={{
                    width: 56, height: 56, borderRadius: 12,
                    background: '#635BFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', flexShrink: 0,
                  }}><CreditCard size={28} /></div>
                : <LogoFournisseur fournisseur={m.fournisseur} size={56} radius={12} />}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>Payer par {m.libelle}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{m.hint}</div>
              </div>

              {loading === m.code
                ? <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite', color: palier.accent }} />
                : <span style={{ color: palier.accent, fontSize: 13, fontWeight: 700 }}>Payer →</span>}
            </button>
          ))}
        </div>

        {/* Trust line */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
          color: C.muted, fontSize: 12, marginTop: 24,
        }}>
          <Check size={14} /> Connexion sécurisée
          <span>·</span>
          <Check size={14} /> Aucune donnée bancaire stockée
          <span>·</span>
          <Check size={14} /> Activation instantanée
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function Centered({ children, C }) {
  return (
    <div style={{
      minHeight: '100dvh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>{children}</div>
  );
}
