import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS } from './theme';
import { ExcelChaos } from './components/ExcelChaos';
import { Stop } from './components/Stop';
import { DemoFlow } from './components/DemoFlow';
import { Outro } from './components/Outro';

const FPS = 30;
const s = (n: number) => n * FPS;

/**
 * Version 30 secondes — pour Facebook/Instagram Ads payantes où chaque
 * seconde coûte. Pas d'empilement de douleurs : juste le hook visuel,
 * la bascule, une démo condensée, et le CTA.
 *
 *   0-5s   : Excel chaos
 *   5-12s  : Stop + logo
 *   12-24s : Démo flow condensée (les 4 écrans passent vite)
 *   24-30s : Outro CTA
 */
export const Video30s: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      <Sequence from={s(0)}  durationInFrames={s(5)}><ExcelChaos /></Sequence>
      <Sequence from={s(5)}  durationInFrames={s(7)}><Stop /></Sequence>
      <Sequence from={s(12)} durationInFrames={s(12)}><DemoFlow /></Sequence>
      <Sequence from={s(24)} durationInFrames={s(6)}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
