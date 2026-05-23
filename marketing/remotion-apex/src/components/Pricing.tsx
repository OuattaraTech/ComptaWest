import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';

/**
 * Scène prix + démo gratuite : crée l'urgence d'agir maintenant.
 * Le prix « 60 000 FCFA/mois » apparaît, puis le « 0 € démo » l'écrase.
 */
export const Pricing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prixOpacity = spring({ frame, fps, config: { damping: 12 } });
  const barreScale = spring({ frame: frame - fps * 0.8, fps, config: { damping: 10 } });
  const demoSpring = spring({ frame: frame - fps * 1.5, fps, config: { damping: 8, stiffness: 150 } });

  return (
    <AbsoluteFill style={{
      background: COLORS.NOIR,
      justifyContent: 'center', alignItems: 'center',
      flexDirection: 'column', gap: 60, padding: 80,
    }}>
      {/* Prix premium barré */}
      <div style={{
        position: 'relative', opacity: prixOpacity,
        fontFamily: FONTS.bold, color: COLORS.GRIS_TEXTE,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>Palier Cabinet</div>
        <div style={{ fontSize: 110, fontWeight: 900, fontFamily: FONTS.mono, position: 'relative' }}>
          60 000
          {/* Trait rouge qui barre le prix */}
          <div style={{
            position: 'absolute', left: '-5%', right: '-5%',
            top: '50%', height: 8, background: COLORS.ROUGE,
            transform: `translateY(-50%) scaleX(${barreScale}) rotate(-3deg)`,
            transformOrigin: 'left center',
            borderRadius: 4,
          }} />
        </div>
        <div style={{ fontSize: 36, marginTop: 8 }}>FCFA / mois</div>
      </div>

      {/* Démo gratuite — élément clé */}
      <div style={{
        background: COLORS.EMERAUDE, borderRadius: 36,
        padding: '50px 80px', textAlign: 'center',
        transform: `scale(${demoSpring})`,
        boxShadow: `0 30px 80px ${COLORS.EMERAUDE}66`,
      }}>
        <div style={{
          fontFamily: FONTS.bold, fontSize: 56, fontWeight: 900,
          color: COLORS.NOIR, lineHeight: 1.1,
        }}>DÉMO GRATUITE</div>
        <div style={{
          fontFamily: FONTS.bold, fontSize: 32, fontWeight: 700,
          color: COLORS.NOIR, marginTop: 12, opacity: 0.85,
        }}>Sans carte bancaire · Sans engagement</div>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 26, fontWeight: 700,
          color: COLORS.NOIR, marginTop: 16, padding: '8px 24px',
          background: 'rgba(0,0,0,0.15)', borderRadius: 12, display: 'inline-block',
        }}>Compte créé en 30 secondes</div>
      </div>
    </AbsoluteFill>
  );
};
