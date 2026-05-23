import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS, FONTS } from './theme';
import { Stop } from './components/Stop';
import { Screenshot, Highlight, BigStat } from './components/Screenshot';
import { Outro } from './components/Outro';

const FPS = 30;
const s = (n: number) => n * FPS;

/**
 * Version 30 secondes pour Facebook / Instagram Ads.
 * On condense : 4 captures clés × 4s + intro/outro courtes.
 *
 *   0-3s   : Stop  (logo flash)
 *   3-19s  : 4 captures essentielles (Dashboard, Facture FNE, Mobile Money, Paie)
 *   19-30s : Outro CTA
 */
const CAPTURES_ADS = [
  { fichier: '01-dashboard.png',     stat: { v: '1 vue',    l: 'tout ton business' },        couleur: COLORS.EMERAUDE,    hl: { x: 4, y: 12, w: 92, h: 22 } },
  { fichier: '04-facture-pdf.png',   stat: { v: '1 clic',   l: 'facture FNE certifiée' },   couleur: COLORS.EMERAUDE,    hl: { x: 70, y: 4, w: 25, h: 20 } },
  { fichier: '08-mobile-money.png',  stat: { v: '10 sec',   l: 'Wave Orange MTN' },          couleur: COLORS.BLEU,        hl: { x: 5, y: 20, w: 90, h: 45 } },
  { fichier: '06-paie-bulletin.png', stat: { v: 'Auto',     l: 'paie ITS 2024' },            couleur: COLORS.ORANGE,      hl: { x: 45, y: 50, w: 50, h: 20 } },
];

export const Video30s: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      <Sequence durationInFrames={s(3)}><Stop /></Sequence>
      {CAPTURES_ADS.map((c, i) => (
        <Sequence key={i} from={s(3) + i * s(4)} durationInFrames={s(4)}>
          <Screenshot src={c.fichier} zoom={{ from: 1.0, to: 1.08 }}>
            <Highlight x={c.hl.x} y={c.hl.y} width={c.hl.w} height={c.hl.h} delay={10} color={c.couleur} />
            <BigStat value={c.stat.v} label={c.stat.l} position="bottom-right" delay={30} color={c.couleur} />
          </Screenshot>
        </Sequence>
      ))}
      <Sequence from={s(3) + s(16)} durationInFrames={s(11)}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
