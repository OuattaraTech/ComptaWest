import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS } from './theme';
import { ExcelChaos } from './components/ExcelChaos';
import { Stop } from './components/Stop';
import { Outro } from './components/Outro';

const FPS = 30;
const s = (n: number) => n * FPS;

/**
 * Version 15 secondes — TikTok / Reels / Shorts hook ultra-court.
 * Objectif : faire SCROLL-STOPPER. Pas de vente, juste de la curiosité.
 *
 *   0-5s  : Excel chaos
 *   5-10s : Stop + logo
 *   10-15s : Outro avec apex.ci
 */
export const Video15s: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      <Sequence from={s(0)}  durationInFrames={s(5)}><ExcelChaos /></Sequence>
      <Sequence from={s(5)}  durationInFrames={s(5)}><Stop /></Sequence>
      <Sequence from={s(10)} durationInFrames={s(5)}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
