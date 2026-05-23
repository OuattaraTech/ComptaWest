import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { LogoApex } from './LogoApex';

/**
 * Outro CTA : URL apex.ci + slogan + provocation finale.
 */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoSpring = spring({ frame, fps, config: { damping: 12 } });
  const urlSpring = spring({ frame: frame - fps * 0.5, fps, config: { damping: 14 } });
  const provoOpacity = spring({ frame: frame - fps * 2, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill style={{
      background: COLORS.NOIR,
      justifyContent: 'center', alignItems: 'center',
      flexDirection: 'column', gap: 60, padding: 80,
    }}>
      <div style={{ transform: `scale(${logoSpring})` }}>
        <LogoApex size={280} withText />
      </div>

      <div style={{
        fontFamily: FONTS.mono, fontSize: 130, fontWeight: 900,
        color: COLORS.EMERAUDE, letterSpacing: '-0.04em',
        transform: `scale(${urlSpring})`,
      }}>apex.ci</div>

      <div style={{
        fontFamily: FONTS.bold, fontSize: 40, fontWeight: 700,
        color: COLORS.BLANC, textAlign: 'center', lineHeight: 1.3,
        transform: `scale(${urlSpring})`,
      }}>
        La gestion de ta PME,<br />
        <span style={{ color: COLORS.VERT_CLAIR }}>made in Côte d'Ivoire 🇨🇮</span>
      </div>

      <div style={{
        marginTop: 30, opacity: provoOpacity,
        fontFamily: FONTS.bold, fontSize: 36, fontWeight: 400, fontStyle: 'italic',
        color: COLORS.GRIS_TEXTE, textAlign: 'center',
      }}>
        Tu ne veux toujours pas essayer ?
      </div>
    </AbsoluteFill>
  );
};
