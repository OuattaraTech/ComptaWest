import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS } from './theme';
import { Stop } from './components/Stop';
import { Screenshot, Highlight, BigStat } from './components/Screenshot';
import { Outro } from './components/Outro';

const FPS = 30;
const s = (n: number) => n * FPS;

/**
 * Hook 15 s pour TikTok / Reels / Shorts.
 * 1 capture flash + logo + CTA. Le but : scroll-stopper.
 *
 *   0-3s  : Stop (logo)
 *   3-10s : Capture dashboard avec stat « 1 outil pour TOUT »
 *   10-15s : Outro CTA
 */
export const Video15s: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      <Sequence durationInFrames={s(3)}><Stop /></Sequence>
      <Sequence from={s(3)} durationInFrames={s(7)}>
        <Screenshot src="01-dashboard.png" zoom={{ from: 1.0, to: 1.15 }}>
          <Highlight x={4} y={12} width={92} height={22} delay={15} color={COLORS.EMERAUDE} />
          <BigStat value="1 outil" label="pour TOUT" position="bottom-right" delay={45} color={COLORS.EMERAUDE} />
        </Screenshot>
      </Sequence>
      <Sequence from={s(10)} durationInFrames={s(5)}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
