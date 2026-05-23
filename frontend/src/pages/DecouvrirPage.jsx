import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Check, ArrowRight, Shield, Zap, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import toast from 'react-hot-toast';

/**
 * Page /decouvrir — landing dédiée au trafic vidéo (TikTok, Facebook Ads,
 * WhatsApp Status). Différente de la landing principale : un SEUL objectif,
 * un SEUL CTA (créer un compte démo en 1 clic), aucune distraction.
 *
 * Tracking UTM : ?utm_source=fb ?utm_campaign=lancement
 */
export default function DecouvrirPage() {
  const { t } = useTranslation();
  const { loginDemo } = useAuth();
  const { chargerEntreprises } = useEntreprise();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  // Tracking source de trafic (utile pour les analytics)
  const utmSource = searchParams.get('utm_source') || 'direct';
  const utmCampaign = searchParams.get('utm_campaign') || '';

  const handleDemo = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('cw_entreprise_id');
      await loginDemo();
      await chargerEntreprises();
      // Envoi event analytics si gtag présent
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'demo_signup', { source: utmSource, campaign: utmCampaign });
      }
      toast.success('Compte démo prêt — bienvenue sur ApeX 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Une erreur est survenue. Réessaie dans un instant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0A0F18 0%, #1A1F2B 100%)',
      color: '#FFFFFF',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Logo seul, pas de nav (pas de distraction) */}
        <div style={{ marginBottom: 40, display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width={48} height={48} viewBox="0 0 64 64">
            <rect width="64" height="64" rx="10" fill="#000000" />
            <path d="M32 18 L40 32 L24 32 Z" fill="#8DE645" />
            <path d="M32 28 L52 50 L43 50 L32 38 L21 50 L12 50 Z" fill="#FFFFFF" />
          </svg>
          <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em' }}>ApeX</span>
        </div>

        {/* Hero : titre punchy + lecteur vidéo + CTA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>

          {/* Colonne gauche — message */}
          <div>
            <div style={{
              display: 'inline-block', padding: '6px 14px', borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.15)', color: '#10B981',
              fontSize: 13, fontWeight: 700, marginBottom: 24,
            }}>
              🇨🇮 100 % conçu en Côte d'Ivoire
            </div>

            <h1 style={{
              fontSize: 56, fontWeight: 900, lineHeight: 1.05,
              margin: 0, letterSpacing: '-0.03em',
            }}>
              La gestion de ta PME<br />
              <span style={{ color: '#10B981' }}>mérite mieux</span><br />
              qu'un tableur.
            </h1>

            <p style={{
              fontSize: 18, lineHeight: 1.6, color: '#9CA3AF',
              marginTop: 24, marginBottom: 32, maxWidth: 480,
            }}>
              Facturation FNE, comptabilité SYSCOHADA, paie CNPS, Mobile
              Money. Tout ce que ton Excel ne sait pas faire — dans un
              seul outil, hébergé en Afrique.
            </p>

            {/* CTA principal — le seul bouton important de la page */}
            <button
              onClick={handleDemo}
              disabled={loading}
              style={{
                padding: '18px 36px', borderRadius: 14, border: 'none',
                background: '#10B981', color: '#000', fontSize: 18, fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {loading ? 'Création du compte…' : 'Tester gratuitement'}
              {!loading && <ArrowRight size={20} />}
            </button>

            {/* Réassurance sous le CTA */}
            <div style={{
              display: 'flex', gap: 24, marginTop: 16,
              fontSize: 13, color: '#9CA3AF', flexWrap: 'wrap',
            }}>
              {[
                'Sans carte bancaire',
                '30 secondes',
                'Données isolées',
              ].map(t => (
                <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} color="#10B981" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Colonne droite — lecteur vidéo (placeholder, à remplacer par MP4) */}
          <div style={{
            aspectRatio: '9/16', maxHeight: 600,
            background: '#000', borderRadius: 24, overflow: 'hidden',
            border: '3px solid #10B981',
            boxShadow: '0 30px 90px rgba(0, 0, 0, 0.6)',
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            {/* Quand la vidéo MP4 sera disponible, remplacer ce bloc par :
                <video src="/videos/apex-90s.mp4" controls autoPlay muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            */}
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: '#10B981', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Play size={50} color="#000" fill="#000" />
              </div>
              <div style={{ marginTop: 20, fontSize: 18, fontWeight: 700 }}>
                Découvre ApeX en 90 secondes
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 8 }}>
                Pour le démarrer : npm run build:90s
              </div>
            </div>
          </div>
        </div>

        {/* Section 3 piliers */}
        <div style={{
          marginTop: 100, display: 'grid', gap: 24,
          gridTemplateColumns: 'repeat(3, 1fr)',
        }}>
          {[
            {
              icon: Shield, color: '#10B981',
              title: 'Conforme DGI',
              desc: 'Facture FNE certifiée, paie CNPS conforme à la réforme ITS 2024, bilan SYSCOHADA prêt pour l\'audit.',
            },
            {
              icon: Zap, color: '#F59E0B',
              title: 'Rapide',
              desc: 'Facture émise en 3 clics, bulletin de paie en 30 sec, bilan annuel en 1 clic. Ton Excel ne pourra jamais.',
            },
            {
              icon: Smartphone, color: '#3B82F6',
              title: 'Mobile Money intégré',
              desc: 'Wave, Orange Money et MTN MoMo connectés. Paiement client = écriture comptable automatique.',
            },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} style={{
              padding: 28, borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `${color}20`, color, marginBottom: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={28} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#9CA3AF', margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA répété (footer) */}
        <div style={{
          marginTop: 100, padding: '48px 32px', borderRadius: 24,
          background: 'linear-gradient(135deg, #10B981 0%, #0F8A6E 100%)',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 36, fontWeight: 900, margin: 0, color: '#000',
            letterSpacing: '-0.02em',
          }}>
            Tu attends quoi pour essayer ?
          </h2>
          <p style={{ fontSize: 17, color: '#000', opacity: 0.8, margin: '12px 0 28px' }}>
            Démo gratuite, sans carte bancaire, sans engagement.
          </p>
          <button
            onClick={handleDemo}
            disabled={loading}
            style={{
              padding: '18px 40px', borderRadius: 14, border: 'none',
              background: '#000', color: '#10B981', fontSize: 17, fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>
            {loading ? 'Création…' : '✨  Démarrer mon compte ApeX'}
          </button>
        </div>

        {/* Footer minimaliste */}
        <div style={{
          marginTop: 40, paddingTop: 24, textAlign: 'center',
          fontSize: 12, color: '#6B7280',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          ApeX · Abidjan, Côte d'Ivoire · <a href="/cgu" style={{ color: '#9CA3AF' }}>CGU</a> · <a href="/confidentialite" style={{ color: '#9CA3AF' }}>Confidentialité</a>
        </div>

      </div>
    </div>
  );
}
