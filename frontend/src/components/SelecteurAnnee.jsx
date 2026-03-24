import { useAnnees } from '../hooks/useAnnees.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';

export default function SelecteurAnnee({ annee, setAnnee, couleurActif = '#00D4AA' }) {
  const { actuelle } = useEntreprise();
  const { annees } = useAnnees(actuelle?.id);
  const { dark } = useTheme();

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
