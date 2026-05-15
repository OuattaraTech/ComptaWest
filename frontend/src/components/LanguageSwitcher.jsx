/**
 * Sélecteur de langue compact (toggle FR ⇄ EN).
 *
 * Variants :
 *   - "chip" (défaut) : pilule cliquable affichant le code court
 *   - "dropdown" : select natif avec libellé complet (pour la page Paramètres)
 */
import { Globe } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage.jsx';

export default function LanguageSwitcher({ variant = 'chip', C, dark }) {
  const { langue, change, langues } = useLanguage();

  if (variant === 'dropdown') {
    return (
      <select
        value={langue}
        onChange={e => change(e.target.value)}
        style={{
          background: C?.input || '#0F1626',
          border: `1.5px solid ${C?.border || '#1F2A3F'}`,
          borderRadius: 9,
          padding: '10px 13px',
          color: C?.text || '#E2E8F0',
          fontSize: 13,
          outline: 'none',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        {langues.map(l => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    );
  }

  // variant 'chip' : toggle compact
  const muted = C?.muted || '#6B7A99';
  const text = C?.text || '#E2E8F0';
  const border = C?.border || '#1F2A3F';
  const hover = C?.hover || 'rgba(255,255,255,0.04)';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: 3, borderRadius: 9, border: `1px solid ${border}`,
      background: hover,
    }}>
      <Globe size={13} color={muted} style={{ marginLeft: 6, marginRight: 2 }} />
      {langues.map(l => {
        const active = langue === l.code;
        return (
          <button
            key={l.code}
            onClick={() => change(l.code)}
            type="button"
            title={l.label}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              background: active ? (C?.accent || '#00D4AA') : 'transparent',
              color: active ? '#000' : muted,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              cursor: active ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}
