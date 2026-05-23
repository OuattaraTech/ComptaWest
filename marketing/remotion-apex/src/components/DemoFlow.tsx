import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS } from '../theme';
import { Screenshot, Highlight, Callout, BigStat, Cursor } from './Screenshot';

/**
 * Démo motion design avec les VRAIES captures d'écran ApeX.
 * Chaque scène = 1 capture + Ken Burns + 1 ou 2 surbrillances + 1 stat.
 *
 * Les fichiers doivent être dans public/ avec ces noms exacts (voir
 * CAPTURES_REQUISES.md). Si une capture manque, la scène s'affichera
 * en noir au lieu de planter.
 */
const SCENE_FRAMES = 30 * 6; // 6 secondes par scène

export const DemoFlow: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      {/* ── SCÈNE 1 : Facture FNE certifiée ─────────────────────────────── */}
      <Sequence durationInFrames={SCENE_FRAMES}>
        <Screenshot
          src="04-facture-pdf.png"
          zoom={{ from: 1.0, to: 1.12 }}
          pan={{ x: 0, y: -3 }}
        >
          {/* Highlight sur le sticker FNE en haut à droite */}
          <Highlight x={72} y={4} width={22} height={18} delay={30} color={COLORS.EMERAUDE} />
          <Callout x={62} y={28} text="Sticker FNE certifié DGI" arrow="top" delay={45} />
          <BigStat value="1 clic" label="pour certifier" position="bottom-right" delay={75} />
        </Screenshot>
      </Sequence>

      {/* ── SCÈNE 2 : Mobile Money intégré ──────────────────────────────── */}
      <Sequence from={SCENE_FRAMES} durationInFrames={SCENE_FRAMES}>
        <Screenshot
          src="08-mobile-money.png"
          zoom={{ from: 1.0, to: 1.1 }}
          pan={{ x: 0, y: 0 }}
        >
          <Highlight x={5} y={20} width={90} height={45} delay={20} color={COLORS.BLEU} />
          <Callout x={50} y={12} text="Wave · Orange · MTN intégrés" arrow="bottom" delay={40} color={COLORS.BLEU} />
          <BigStat value="10 sec" label="paiement reçu" position="bottom-right" delay={75} color={COLORS.BLEU} />
        </Screenshot>
      </Sequence>

      {/* ── SCÈNE 3 : Bulletin de paie ITS 2024 ─────────────────────────── */}
      <Sequence from={SCENE_FRAMES * 2} durationInFrames={SCENE_FRAMES}>
        <Screenshot
          src="06-paie-bulletin.png"
          zoom={{ from: 1.0, to: 1.1 }}
          pan={{ x: -2, y: -2 }}
        >
          <Highlight x={45} y={50} width={50} height={20} delay={30} color={COLORS.ORANGE} />
          <Callout x={50} y={42} text="Conforme réforme ITS 2024" arrow="bottom" delay={45} color={COLORS.ORANGE} />
          <BigStat value="30 sec" label="par employé" position="bottom-right" delay={75} color={COLORS.ORANGE} />
        </Screenshot>
      </Sequence>

      {/* ── SCÈNE 4 : Dashboard SYSCOHADA / KPIs ────────────────────────── */}
      <Sequence from={SCENE_FRAMES * 3} durationInFrames={SCENE_FRAMES}>
        <Screenshot
          src="01-dashboard.png"
          zoom={{ from: 1.0, to: 1.08 }}
          pan={{ x: 0, y: 2 }}
        >
          <Highlight x={5} y={15} width={90} height={25} delay={20} color={COLORS.VERT_CLAIR} />
          <Callout x={50} y={45} text="Bilan SYSCOHADA en 1 clic" arrow="top" delay={45} color={COLORS.VERT_CLAIR} />
          <BigStat value="1 clic" label="rapport annuel" position="bottom-right" delay={75} color={COLORS.VERT_CLAIR} />
        </Screenshot>
      </Sequence>
    </AbsoluteFill>
  );
};
