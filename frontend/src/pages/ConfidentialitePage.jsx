import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from '../components/UI.jsx';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Politique de confidentialité — page publique servie à /confidentialite.
 *
 * Calquée sur les principes RGPD européens (le droit ivoirien n'a pas
 * encore de loi de protection des données aussi exhaustive, mais le
 * cadre RGPD s'impose en pratique aux entreprises qui traitent des
 * données de citoyens européens, et reste la meilleure pratique).
 */
export default function ConfidentialitePage() {
  const { dark } = useTheme();
  const C = getC(dark);
  const navigate = useNavigate();
  const DATE_MAJ = '22 mai 2026';

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg, color: C.text,
      padding: '48px clamp(20px, 5vw, 80px)',
      fontFamily: '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <button onClick={() => navigate('/')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10,
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.muted, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', marginBottom: 36, fontFamily: 'inherit',
        }}>
          <ArrowLeft size={14} /> Accueil
        </button>

        <h1 style={{
          fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 700,
          letterSpacing: '-0.03em', marginBottom: 12,
        }}>
          Politique de confidentialité
        </h1>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 40 }}>
          Dernière mise à jour : <strong>{DATE_MAJ}</strong>
        </div>

        <Section titre="1. Qui sommes-nous ?">
          <p>Le service <strong>ApeX</strong> est édité depuis Abidjan, Côte d'Ivoire. Le responsable du traitement de vos données personnelles peut être contacté à <strong>contact@apex.ci</strong>.</p>
        </Section>

        <Section titre="2. Données que nous collectons">
          <p>Nous collectons uniquement les données nécessaires au fonctionnement du Service :</p>
          <ul style={ul()}>
            <li><strong>Données de compte</strong> — nom, email, téléphone, mot de passe (haché bcrypt), langue préférée.</li>
            <li><strong>Données d'entreprise</strong> — raison sociale, NINEA/NCC, RCCM, forme juridique, régime fiscal, adresse.</li>
            <li><strong>Données comptables</strong> — clients, fournisseurs, factures, écritures, paie, immobilisations… saisies par vous ou importées.</li>
            <li><strong>Données techniques</strong> — adresse IP, journal d'audit (qui a fait quoi et quand), horodatages des connexions.</li>
            <li><strong>Données de facturation</strong> — montants, dates, références de transactions Mobile Money / virement bancaire pour la facturation de votre abonnement.</li>
          </ul>
        </Section>

        <Section titre="3. À quoi servent ces données ?">
          <ul style={ul()}>
            <li><strong>Exécution du Service</strong> — calcul des écritures, génération des PDF, transmission des factures à la DGI (FNE), génération des bulletins de paie CNPS.</li>
            <li><strong>Sécurité</strong> — journal d'audit, détection des accès anormaux, intangibilité des écritures (article 17 OHADA).</li>
            <li><strong>Communication</strong> — emails de service (invitations, alertes d'échéance, factures), support technique.</li>
            <li><strong>Amélioration du produit</strong> — analytics anonymisés sur l'usage des fonctionnalités (jamais sur le contenu de vos données comptables).</li>
          </ul>
          <p>Nous ne vendons, ne louons et ne cédons <strong>jamais</strong> vos données comptables à des tiers. Aucune publicité ciblée.</p>
        </Section>

        <Section titre="4. Avec qui partageons-nous ces données ?">
          <p>Vos données ne sont partagées qu'avec :</p>
          <ul style={ul()}>
            <li><strong>La Direction Générale des Impôts (DGI)</strong> — uniquement les données nécessaires à la certification FNE de vos factures, à votre demande explicite (clic sur « Certifier »).</li>
            <li><strong>Les opérateurs Mobile Money</strong> (Wave, Orange Money, MTN MoMo) — uniquement les données nécessaires à la génération des liens de paiement, à votre demande explicite.</li>
            <li><strong>Nos sous-traitants techniques</strong> — hébergeur cloud africain, fournisseur d'OCR (Mistral pour la lecture des reçus, si vous activez la fonctionnalité). Tous ces sous-traitants sont contractuellement liés au respect de la confidentialité.</li>
          </ul>
        </Section>

        <Section titre="5. Combien de temps conservons-nous vos données ?">
          <p><strong>Données comptables</strong> : conservées pendant toute la durée de votre abonnement, plus 10 ans après résiliation pour respecter les obligations légales de conservation comptable en zone OHADA (article 24 de l'Acte uniforme).</p>
          <p><strong>Données de connexion / journal d'audit</strong> : conservées 12 mois.</p>
          <p><strong>Données de compte</strong> : conservées jusqu'à votre demande de suppression définitive (cf. section 7).</p>
        </Section>

        <Section titre="6. Sécurité">
          <ul style={ul()}>
            <li>Mots de passe stockés en hash <strong>bcrypt</strong> (jamais en clair) avec sel unique.</li>
            <li>Authentification par <strong>JWT</strong> signé, expirant après 7 jours.</li>
            <li>Toutes les communications client ↔ serveur en <strong>HTTPS</strong> (TLS 1.2+).</li>
            <li>Hébergement en Afrique de l'Ouest avec sauvegardes chiffrées quotidiennes.</li>
            <li>Journal d'audit complet : qui a fait quoi, quand, depuis quelle adresse IP.</li>
            <li>Matrice de permissions granulaire : chaque membre n'accède qu'aux modules autorisés par son rôle ou ses permissions personnalisées.</li>
          </ul>
        </Section>

        <Section titre="7. Vos droits">
          <p>Vous disposez à tout moment des droits suivants sur vos données personnelles :</p>
          <ul style={ul()}>
            <li><strong>Accès</strong> — consulter toutes vos données via votre espace personnel ou sur demande.</li>
            <li><strong>Rectification</strong> — corriger toute information inexacte.</li>
            <li><strong>Portabilité</strong> — exporter vos données en formats standards (PDF, Excel, CSV) à tout moment.</li>
            <li><strong>Suppression</strong> — demander la suppression définitive de votre compte et de vos données après expiration des délais légaux de conservation.</li>
            <li><strong>Opposition</strong> — vous opposer au traitement de certaines de vos données dans la mesure où cela n'empêche pas l'exécution du Service.</li>
          </ul>
          <p>Pour exercer ces droits, écrivez à <strong>contact@apex.ci</strong> en précisant votre identité. Réponse sous 30 jours maximum.</p>
        </Section>

        <Section titre="8. Cookies">
          <p>ApeX utilise uniquement des cookies <strong>strictement nécessaires</strong> au fonctionnement du Service (session d'authentification, préférence de langue, thème clair/sombre). Aucun cookie publicitaire, aucun pixel de tracking tiers.</p>
        </Section>

        <Section titre="9. Modifications">
          <p>Nous pouvons faire évoluer la présente politique. Les modifications substantielles vous seront notifiées par email avec un préavis raisonnable.</p>
        </Section>

        <Section titre="10. Contact">
          <p>Pour toute question ou réclamation concernant le traitement de vos données personnelles, écrivez-nous à <strong>contact@apex.ci</strong>.</p>
        </Section>

        <div style={{
          marginTop: 48, padding: 18, borderRadius: 12,
          background: dark ? '#11161D' : '#F1F2EC',
          border: `1px solid ${C.border}`, fontSize: 13, color: C.muted, lineHeight: 1.6,
        }}>
          Voir aussi les <a href="/cgu" style={{ color: C.accent, fontWeight: 600 }}>Conditions Générales d'Utilisation</a> qui régissent l'usage du Service.
        </div>
      </div>
    </div>
  );
}

function Section({ titre, children }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.015em',
        marginBottom: 12,
      }}>{titre}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

const ul = () => ({
  margin: '4px 0 6px 0', paddingLeft: 22,
  display: 'flex', flexDirection: 'column', gap: 6,
});
