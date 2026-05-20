import { useAnnees } from '../hooks/useAnnees.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';

// Au-delà de ce seuil, on bascule en menu déroulant. La rangée de boutons
// reste lisible jusqu'à 5-6 années ; au-delà elle déborde ou wrappe sur
// deux lignes, ce qui détone visuellement à côté du reste du header.
const SEUIL_DROPDOWN = 6;

export default function SelecteurAnnee({ annee, setAnnee, couleurActif = '#00D4AA' }) {
  const { actuelle } = useEntreprise();
  const { annees } = useAnnees(actuelle?.id);
  const { dark } = useTheme();

  // Mode dropdown — préserve la place dans le header pour les PME qui
  // utilisent ApeX depuis plusieurs années.
  if (annees.length > SEUIL_DROPDOWN) {
    return (
      <select
        value={annee}
        onChange={e => setAnnee(e.target.value)}
        style={{
          padding: '6px 28px 6px 14px', borderRadius: 8,
          border: `1px solid ${couleurActif}`,
          background: dark ? '#161F2E' : '#F1F5F9',
          color: dark ? '#E2E8F0' : '#1E293B',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          appearance: 'none',
          backgroundImage: `linear-gradient(45deg, transparent 50%, ${couleurActif} 50%), linear-gradient(135deg, ${couleurActif} 50%, transparent 50%)`,
          backgroundPosition: `right 12px top 12px, right 7px top 12px`,
          backgroundSize: '5px 5px',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {annees.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    );
  }

  // Mode boutons — affichage compact privilégié quand peu d'années.
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {annees.map(a => (
        <button key={a} onClick={() => setAnnee(a)} style={{
          padding: '6px 14px', borderRadius: 8,
          border: `1px solid ${annee === a ? couleurActif : dark ? '#1E2D40' : '#D1DBE8'}`,
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: annee === a ? couleurActif : dark ? '#161F2E' : '#F1F5F9',
          color: annee === a ? '#000' : dark ? '#6B7A99' : '#64748B',
          transition: 'all 0.15s',
        }}>
          {a}
        </button>
      ))}
    </div>
  );
}
