import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS } from './theme';
import { Stop } from './components/Stop';
import { DemoFlow, DEMO_FLOW_DURATION } from './components/DemoFlow';
import { Outro } from './components/Outro';

const FPS = 30;
const s = (n: number) => n * FPS;

/**
 * Vidéo principale 90 s — 100 % motion design sur captures réelles.
 *
 *   0-8s    : Stop  (logo ApeX + slogan « ta gestion mérite mieux »)
 *   8-58s   : DemoFlow (10 captures × 5s avec Ken Burns, surbrillances,
 *             stats chiffrées, compteur 01-10 en top-left)
 *   58-90s  : Outro (CTA apex.ci + provocation finale + logo)
 *
 * Plus de PainStack ni Pricing dessinés en SVG : tout le corps de la
 * vidéo est basé sur les VRAIES captures ApeX du dossier public/.
 */
export const Video90s: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      <Sequence durationInFrames={s(8)}>
        <Stop />
      </Sequence>
      <Sequence from={s(8)} durationInFrames={DEMO_FLOW_DURATION}>
        <DemoFlow />
      </Sequence>
      <Sequence from={s(8) + DEMO_FLOW_DURATION} durationInFrames={s(90) - s(8) - DEMO_FLOW_DURATION}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
