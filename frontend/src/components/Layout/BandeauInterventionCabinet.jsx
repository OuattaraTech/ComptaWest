import { useNavigate } from 'react-router-dom';
import { Briefcase, ArrowLeft } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions.jsx';
import { useEntreprise } from '../../hooks/useEntreprise.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';

/**
 * Bandeau qui s'affiche en haut du contenu quand l'utilisateur intervient
 * sur un dossier client via le programme Partenaires Cabinets (rôle
 * synthétique 'expert_comptable' projeté par le middleware).
 *
 * Rappelle visuellement le contexte d'intervention et propose un retour
 * rapide au portail cabinet.
 */
export default function BandeauInterventionCabinet() {
  const { dark } = useTheme();
  const { viaCabinet } = usePermissions();
  const { actuelle, entreprises, switchEntreprise } = useEntreprise();
  const navigate = useNavigate();

  if (!viaCabinet || !actuelle) return null;

  const retourCabinet = () => {
    // Trouve le cabinet partenaire dont l'utilisateur est propriétaire/admin
    const cab = (entreprises || []).find(
      e => e.type_compte === 'cabinet_partenaire' && (e.role === 'proprietaire' || e.role === 'admin')
    );
    if (cab) {
      switchEntreprise(cab);
      navigate('/cabinet');
    } else {
      navigate('/cabinet');
    }
  };

  const bg = dark
    ? 'linear-gradient(135deg, rgba(245,196,74,0.18), rgba(45,191,156,0.10))'
    : 'linear-gradient(135deg, rgba(214,154,23,0.12), rgba(15,138,110,0.06))';
  const border = dark ? '#F5C44A55' : '#D69A1755';
  const text = dark ? '#F2F4F8' : '#0E1116';
  const sub = dark ? '#A9B1BC' : '#3C4250';
  const cabinet = dark ? '#F5C44A' : '#D69A17';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '12px 20px',
      background: bg, borderBottom: `1px solid ${border}`,
      fontFamily: '"Satoshi", "Cabinet Grotesk", system-ui, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${cabinet}30`, color: cabinet,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Briefcase size={16} strokeWidth={2.4} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: text, lineHeight: 1.2 }}>
            Mode intervention cabinet — dossier <strong style={{ color: cabinet }}>{actuelle.nom}</strong>
          </div>
          <div style={{ fontSize: 11, color: sub, marginTop: 2, lineHeight: 1.3 }}>
            Vous intervenez en tant qu'expert-comptable. Les utilisateurs et paramètres de la PME sont en lecture seule.
          </div>
        </div>
      </div>
      <button onClick={retourCabinet} style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 9,
        background: dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.6)',
        border: `1px solid ${border}`,
        color: text, fontFamily: 'inherit', fontWeight: 600, fontSize: 12,
        cursor: 'pointer',
      }}>
        <ArrowLeft size={12} /> Retour au portail cabinet
      </button>
    </div>
  );
}
