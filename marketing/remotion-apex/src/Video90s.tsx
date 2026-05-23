import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS } from './theme';
import { ExcelChaos } from './components/ExcelChaos';
import { PainStack } from './components/PainStack';
import { Stop } from './components/Stop';
import { DemoFlow } from './components/DemoFlow';
import { Pricing } from './components/Pricing';
import { Outro } from './components/Outro';

const FPS = 30;
const s = (n: number) => n * FPS;

/**
 * Vidéo principale 90 secondes — structure PAS-CTA
 *   0-12s  : Excel chaos (problème)
 *   12-25s : Pain stack (agitation, empile 3 douleurs)
 *   25-35s : « Stop. Ta PME mérite mieux. » (bascule)
 *   35-65s : Démo flow (4 écrans : facture, paiement, paie, bilan)
 *   65-78s : Pricing (démo gratuite — urgence)
 *   78-90s : Outro (CTA apex.ci)
 */
export const Video90s: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      <Sequence from={s(0)}  durationInFrames={s(12)}><ExcelChaos /></Sequence>
      <Sequence from={s(12)} durationInFrames={s(13)}><PainStack /></Sequence>
      <Sequence from={s(25)} durationInFrames={s(10)}><Stop /></Sequence>
      <Sequence from={s(35)} durationInFrames={s(30)}><DemoFlow /></Sequence>
      <Sequence from={s(65)} durationInFrames={s(13)}><Pricing /></Sequence>
      <Sequence from={s(78)} durationInFrames={s(12)}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
