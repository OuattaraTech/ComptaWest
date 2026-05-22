import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme.jsx';
import { getC } from '../components/UI.jsx';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Conditions Générales d'Utilisation — pages publique servie à /cgu.
 *
 * Le texte couvre les obligations OHADA (hébergement, intangibilité,
 * confidentialité) et le contexte juridique ivoirien (DGI, CNPS, FNE).
 * À adapter avec un cabinet juridique avant mise en production réelle.
 *
 * Note : ce document est rédigé en français car la grande majorité des
 * utilisateurs cibles sont francophones (Côte d'Ivoire). Une version EN
 * peut être ajoutée plus tard.
 */
export default function CguPage() {
  const { t } = useTranslation();
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
          Conditions Générales d'Utilisation
        </h1>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 40 }}>
          Dernière mise à jour : <strong>{DATE_MAJ}</strong> · Applicables à compter de l'inscription au service ApeX.
        </div>

        <Section titre="1. Objet">
          <p>Les présentes Conditions Générales d'Utilisation (« <strong>CGU</strong> ») régissent l'accès et l'utilisation du logiciel de comptabilité et de gestion <strong>ApeX</strong> (ci-après « le Service »), édité et exploité depuis la République de Côte d'Ivoire.</p>
          <p>En créant un compte ou en accédant au Service, vous acceptez sans réserve l'intégralité des présentes CGU. Si vous n'acceptez pas une clause, vous devez vous abstenir d'utiliser le Service.</p>
        </Section>

        <Section titre="2. Description du Service">
          <p>ApeX est un logiciel en ligne (SaaS) permettant aux petites et moyennes entreprises (PME) opérant en zone OHADA, et particulièrement en Côte d'Ivoire, de tenir leur comptabilité conformément au plan SYSCOHADA révisé, d'émettre des factures certifiées FNE auprès de la Direction Générale des Impôts (DGI), de gérer la paie conformément aux barèmes CNPS et ITS, et d'encaisser via les opérateurs Mobile Money (Wave, Orange Money, MTN MoMo).</p>
          <p>Le périmètre fonctionnel exact varie selon la formule souscrite ; il est décrit publiquement sur la page <a href="/tarifs" style={{ color: C.accent }}>Tarifs</a>.</p>
        </Section>

        <Section titre="3. Inscription et compte">
          <p>L'accès au Service nécessite la création d'un compte personnel avec un email professionnel valide et un mot de passe d'au moins 8 caractères. Vous êtes seul responsable de la confidentialité de vos identifiants et de toutes les actions effectuées sous votre compte.</p>
          <p>Le Propriétaire de l'entreprise peut inviter des collaborateurs avec des rôles métier (Admin, Expert-comptable, Comptable interne, RH, Commercial, Magasinier, Auditeur, Utilisateur, Lecture seule) et personnaliser les permissions de chacun, action par action, module par module.</p>
        </Section>

        <Section titre="4. Données comptables et intangibilité OHADA">
          <p>Conformément à l'article 17 de l'Acte uniforme OHADA portant sur le droit comptable, toute écriture comptable validée est <strong>intangible</strong> : elle ne peut être ni supprimée, ni modifiée. La correction d'une écriture validée passe obligatoirement par une <strong>contre-passation</strong> (écriture inverse).</p>
          <p>Le Service fournit, sur demande, un export du Grand-Livre des écritures validées sous format texte ou Excel, exploitable en cas de contrôle de la DGI ou par un Commissaire aux Comptes.</p>
        </Section>

        <Section titre="5. Hébergement et localisation des données">
          <p>Vos données sont hébergées sur des serveurs situés en <strong>Afrique de l'Ouest</strong>, conformément aux recommandations OHADA sur la localisation des données comptables. Des sauvegardes chiffrées quotidiennes sont effectuées et conservées 90 jours.</p>
          <p>En cas de résiliation de votre abonnement, vos données restent accessibles en lecture seule pendant <strong>90 jours</strong> afin de vous permettre d'exporter ce dont vous avez besoin (Grand-Livre, journaux, balance, bulletins de paie, factures en PDF). Au-delà de ce délai, vos données peuvent être supprimées définitivement de nos serveurs et de nos sauvegardes.</p>
        </Section>

        <Section titre="6. Tarification et paiement">
          <p>Les tarifs et les limites de chaque formule sont décrits publiquement sur la page <a href="/tarifs" style={{ color: C.accent }}>Tarifs</a>. Le paiement s'effectue mensuellement, par virement bancaire, Wave, Orange Money ou MTN Mobile Money.</p>
          <p>L'abonnement est sans engagement de durée : vous pouvez résilier à tout moment depuis votre espace Paramètres → Abonnement. La résiliation prend effet à la fin de la période en cours déjà facturée.</p>
        </Section>

        <Section titre="7. Disponibilité du Service">
          <p>Nous nous efforçons d'assurer une disponibilité du Service de 99,5 % en moyenne mensuelle. Des interruptions ponctuelles peuvent survenir pour des opérations de maintenance, des incidents techniques ou des cas de force majeure. Aucune indemnisation ne pourra être réclamée pour ces interruptions.</p>
        </Section>

        <Section titre="8. Responsabilités">
          <p><strong>Vos obligations :</strong> exactitude des données saisies, respect des règles fiscales et sociales applicables, déclaration de tout incident de sécurité.</p>
          <p><strong>Nos obligations :</strong> mise à disposition du Service conforme à sa documentation, maintien des sauvegardes, conformité du paramétrage SYSCOHADA/CNPS/FNE aux textes en vigueur, protection raisonnable de vos données.</p>
          <p>Notre responsabilité est limitée aux dommages directs et plafonnée au montant des sommes versées par vous au titre des 12 derniers mois.</p>
        </Section>

        <Section titre="9. Propriété intellectuelle">
          <p>Le logiciel ApeX, sa documentation, sa marque et son design sont protégés par le droit d'auteur et la propriété intellectuelle. Vous disposez d'un droit d'usage non exclusif et non transférable pendant la durée de votre abonnement.</p>
          <p>Vos données comptables vous appartiennent intégralement. Vous pouvez les exporter à tout moment en formats standards (PDF, Excel, CSV, texte pipe-delimité).</p>
        </Section>

        <Section titre="10. Modification des CGU">
          <p>Nous pouvons modifier les présentes CGU à tout moment. Les modifications substantielles vous seront notifiées par email avec un préavis raisonnable (15 jours minimum). Votre poursuite d'utilisation du Service vaut acceptation des nouvelles CGU.</p>
        </Section>

        <Section titre="11. Droit applicable et juridiction">
          <p>Les présentes CGU sont régies par le droit ivoirien et l'Acte uniforme OHADA. Tout litige sera soumis aux tribunaux compétents d'Abidjan, après tentative préalable de résolution amiable.</p>
        </Section>

        <Section titre="12. Contact">
          <p>Pour toute question relative aux présentes CGU, écrivez à <strong>contact@apex.ci</strong>.</p>
        </Section>

        <div style={{
          marginTop: 48, padding: 18, borderRadius: 12,
          background: dark ? '#11161D' : '#F1F2EC',
          border: `1px solid ${C.border}`, fontSize: 13, color: C.muted, lineHeight: 1.6,
        }}>
          Voir aussi la <a href="/confidentialite" style={{ color: C.accent, fontWeight: 600 }}>Politique de confidentialité</a> qui détaille comment nous traitons vos données personnelles.
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
      <div style={{ fontSize: 15, lineHeight: 1.65, color: 'inherit', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  );
}
