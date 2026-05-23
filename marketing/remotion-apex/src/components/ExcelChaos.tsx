import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLORS, FONTS } from '../theme';

/**
 * Scène d'ouverture : feuille Excel chaotique avec erreurs #REF! qui clignotent.
 * Composée de cellules positionnées en grille avec animations de tremblement
 * et apparitions séquentielles d'erreurs en rouge.
 */
export const ExcelChaos: React.FC = () => {
  const frame = useCurrentFrame();
  const shake = interpolate(frame, [0, 5, 10, 15, 20], [0, 4, -4, 3, 0], {
    extrapolateRight: 'extend',
  }) * Math.sin(frame * 0.5);

  // Grille de cellules : on simule un tableau Excel
  const cellules: Array<{ x: number; y: number; v: string; err?: boolean; delay?: number }> = [
    { x: 0, y: 0, v: 'Mois' }, { x: 1, y: 0, v: 'CA' }, { x: 2, y: 0, v: 'Charges' }, { x: 3, y: 0, v: 'Net' },
    { x: 0, y: 1, v: 'Jan' }, { x: 1, y: 1, v: '4 200 000' }, { x: 2, y: 1, v: '3 100 000' }, { x: 3, y: 1, v: '1 100 000' },
    { x: 0, y: 2, v: 'Fév' }, { x: 1, y: 2, v: '#REF!', err: true, delay: 10 }, { x: 2, y: 2, v: '#DIV/0!', err: true, delay: 18 }, { x: 3, y: 2, v: '#VALUE!', err: true, delay: 26 },
    { x: 0, y: 3, v: 'Mar' }, { x: 1, y: 3, v: '#NAME?', err: true, delay: 34 }, { x: 2, y: 3, v: '#REF!', err: true, delay: 42 }, { x: 3, y: 3, v: '#N/A', err: true, delay: 50 },
    { x: 0, y: 4, v: 'Avr' }, { x: 1, y: 4, v: '#REF!', err: true, delay: 58 }, { x: 2, y: 4, v: '#REF!', err: true, delay: 64 }, { x: 3, y: 4, v: '#REF!', err: true, delay: 70 },
  ];

  return (
    <AbsoluteFill style={{
      background: '#FFFFFF',
      padding: 60,
      transform: `translateX(${shake}px) translateY(${shake * 0.5}px)`,
    }}>
      {/* Onglets type Excel */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 30,
        fontFamily: FONTS.mono, fontSize: 28, color: '#333',
      }}>
        {['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', '+40 autres'].map((o, i) => (
          <div key={i} style={{
            padding: '8px 18px',
            background: i === 0 ? '#E8E8E8' : '#F5F5F5',
            borderTop: '3px solid #4A90E2',
            borderRadius: '6px 6px 0 0',
            opacity: i === 7 ? 0.5 : 1,
          }}>{o}</div>
        ))}
      </div>

      {/* Grille du tableau */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '180px 280px 280px 280px',
        gap: 0,
        border: '2px solid #999',
      }}>
        {cellules.map((c, i) => {
          const visible = !c.delay || frame >= c.delay;
          const isHeader = c.y === 0;
          const blink = c.err && frame > (c.delay || 0) ? Math.sin(frame * 0.8) > 0 : true;
          return (
            <div key={i} style={{
              gridColumn: c.x + 1,
              gridRow: c.y + 1,
              padding: '24px 18px',
              fontFamily: FONTS.mono,
              fontSize: 36,
              fontWeight: isHeader || c.err ? 900 : 400,
              color: c.err ? (blink ? COLORS.ROUGE : '#FCA5A5') : '#222',
              background: isHeader ? '#4A90E2' : c.err ? COLORS.ROUGE_DOUX : '#FFF',
              ...(isHeader ? { color: '#FFF' } : {}),
              borderRight: '1px solid #CCC',
              borderBottom: '1px solid #CCC',
              opacity: visible ? 1 : 0,
              transform: visible && c.err ? `scale(${1 + Math.sin(frame * 0.4) * 0.05})` : 'scale(1)',
              transition: 'transform 0.1s',
              textAlign: c.x === 0 || isHeader ? 'left' : 'right',
            }}>
              {c.v}
            </div>
          );
        })}
      </div>

      {/* Curseur de souris qui clique frénétiquement */}
      <div style={{
        position: 'absolute',
        left: 540 + Math.sin(frame * 0.3) * 80,
        top: 900 + Math.cos(frame * 0.4) * 50,
        fontSize: 70,
      }}>👆</div>
    </AbsoluteFill>
  );
};
