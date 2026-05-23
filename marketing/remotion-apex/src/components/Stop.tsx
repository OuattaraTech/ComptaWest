import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { LogoApex } from './LogoApex';

/**
 * Bascule narrative : « Stop. Ta PME mérite mieux qu'un tableur. »
 * Le mot STOP arrive en gros et le logo ApeX apparaît.
 */
export const Stop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stopScale = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const tagOpacity = spring({ frame: frame - fps * 0.8, fps, config: { damping: 20 } });
  const logoSpring = spring({ frame: frame - fps * 1.5, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{
      background: COLORS.NOIR,
      justifyContent: 'center', alignItems: 'center',
      gap: 40,
    }}>
      <div style={{
        fontFamily: FONTS.bold, fontSize: 240, fontWeight: 900,
        color: COLORS.ROUGE, letterSpacing: '-0.05em',
        transform: `scale(${stopScale})`,
      }}>STOP.</div>

      <div style={{
        fontFamily: FONTS.bold, fontSize: 52, fontWeight: 700,
        color: COLORS.BLANC, textAlign: 'center', lineHeight: 1.2,
        maxWidth: 900, opacity: tagOpacity,
      }}>
        Ta PME mérite mieux<br />
        <span style={{ color: COLORS.EMERAUDE }}>qu'un tableur.</span>
      </div>

      <div style={{ marginTop: 40, transform: `scale(${logoSpring})` }}>
        <LogoApex size={240} withText />
      </div>
    </AbsoluteFill>
  );
};
