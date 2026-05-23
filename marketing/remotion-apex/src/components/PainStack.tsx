import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';

/**
 * Scène d'agitation : empile rapidement 3 douleurs concrètes du gérant CI.
 * Chaque douleur arrive avec un effet de chute et reste à l'écran (pile).
 */
const DOULEURS = [
  { icone: '📄', titre: '80 000 FCFA d\'amende', sous: 'Facture sans numéro FNE' },
  { icone: '⏱', titre: '6 heures perdues', sous: 'Pour 3 bulletins CNPS' },
  { icone: '💸', titre: 'Paiement Wave perdu', sous: 'Reçu hier — toujours pas écrit' },
];

export const PainStack: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{
      background: COLORS.NOIR,
      justifyContent: 'center', alignItems: 'center',
      padding: 80,
    }}>
      {DOULEURS.map((d, i) => {
        const start = i * fps * 1.2;     // chaque douleur tombe 1,2s après la précédente
        const progress = spring({
          frame: frame - start,
          fps,
          config: { damping: 12, stiffness: 100 },
        });
        return (
          <div key={i} style={{
            background: COLORS.NOIR_DOUX,
            border: `2px solid ${COLORS.ROUGE}`,
            borderRadius: 24,
            padding: '36px 50px',
            marginBottom: 30,
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 30,
            opacity: progress,
            transform: `translateY(${(1 - progress) * -200}px) scale(${0.8 + progress * 0.2})`,
          }}>
            <div style={{ fontSize: 90 }}>{d.icone}</div>
            <div>
              <div style={{
                fontFamily: FONTS.bold, fontSize: 64, fontWeight: 900,
                color: COLORS.ROUGE, lineHeight: 1.1,
              }}>{d.titre}</div>
              <div style={{
                fontFamily: FONTS.bold, fontSize: 36, fontWeight: 400,
                color: COLORS.GRIS_TEXTE, marginTop: 8,
              }}>{d.sous}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
