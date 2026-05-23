import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { Screenshot, Highlight, Callout, BigStat } from './Screenshot';

/**
 * Tour produit complet : 10 captures réelles ApeX animées en motion
 * design pro (style Stripe / Linear / Notion). Chaque capture a :
 *   - effet Ken Burns (zoom + pan lent)
 *   - 1 surbrillance émeraude sur la zone clé
 *   - 1 callout flottant qui décrit la valeur
 *   - 1 stat chiffrée en bottom-right
 *   - 1 titre overlay en top-left (« 1/10 · Dashboard » etc.)
 *
 * Durée totale ajustable via DUREE_CAPTURE (défaut 5s par capture).
 */
const DUREE_CAPTURE = 30 * 5; // 5 secondes par capture × 10 = 50 secondes

type SceneDef = {
  fichier: string;
  titre: string;
  callout: string;
  stat: { v: string; l: string };
  hl?: { x: number; y: number; w: number; h: number; delay?: number };
  pan?: { x: number; y: number };
  couleur: string;
};

const SCENES: SceneDef[] = [
  {
    fichier: '01-dashboard.png',
    titre: 'Dashboard',
    callout: 'KPIs en temps réel',
    stat: { v: '1 vue', l: 'tout ton business' },
    hl: { x: 4, y: 12, w: 92, h: 22, delay: 20 },
    pan: { x: 0, y: 2 },
    couleur: COLORS.EMERAUDE,
  },
  {
    fichier: '02-factures-liste.png',
    titre: 'Facturation',
    callout: 'Toutes tes factures, tous statuts',
    stat: { v: '8 factures', l: 'tous statuts gérés' },
    hl: { x: 4, y: 22, w: 92, h: 55, delay: 20 },
    pan: { x: 0, y: -3 },
    couleur: COLORS.EMERAUDE,
  },
  {
    fichier: '03-facture-modale.png',
    titre: 'Création express',
    callout: 'Facture créée en 3 clics',
    stat: { v: '3 clics', l: 'pour émettre' },
    hl: { x: 20, y: 20, w: 60, h: 60, delay: 20 },
    couleur: COLORS.EMERAUDE,
  },
  {
    fichier: '04-facture-pdf.png',
    titre: 'PDF certifié FNE',
    callout: 'Sticker DGI scannable inclus',
    stat: { v: '1 clic', l: 'pour certifier' },
    hl: { x: 70, y: 4, w: 25, h: 20, delay: 25 },
    pan: { x: 0, y: -3 },
    couleur: COLORS.EMERAUDE,
  },
  {
    fichier: '08-mobile-money.png',
    titre: 'Mobile Money',
    callout: 'Wave · Orange · MTN intégrés',
    stat: { v: '10 sec', l: 'paiement encaissé' },
    hl: { x: 5, y: 20, w: 90, h: 45, delay: 20 },
    couleur: COLORS.BLEU,
  },
  {
    fichier: '07-tresorerie.png',
    titre: 'Trésorerie',
    callout: '3 comptes, vue unifiée',
    stat: { v: 'Temps réel', l: 'soldes consolidés' },
    hl: { x: 4, y: 20, w: 92, h: 50, delay: 20 },
    couleur: COLORS.BLEU,
  },
  {
    fichier: '05-paie-liste.png',
    titre: 'Paie & RH',
    callout: 'Bulletins ITS 2024 conformes',
    stat: { v: '30 sec', l: 'par bulletin' },
    hl: { x: 4, y: 22, w: 92, h: 45, delay: 20 },
    couleur: COLORS.ORANGE,
  },
  {
    fichier: '06-paie-bulletin.png',
    titre: 'Bulletin détaillé',
    callout: 'CNPS · ITS · Charges patronales',
    stat: { v: 'Auto', l: 'CGI CI à jour' },
    hl: { x: 45, y: 50, w: 50, h: 20, delay: 25 },
    pan: { x: -1, y: -2 },
    couleur: COLORS.ORANGE,
  },
  {
    fichier: '09-comptabilite.png',
    titre: 'Comptabilité SYSCOHADA',
    callout: 'Écritures générées en auto',
    stat: { v: 'Zéro', l: 'saisie manuelle' },
    hl: { x: 4, y: 18, w: 92, h: 55, delay: 20 },
    couleur: COLORS.VERT_CLAIR,
  },
  {
    fichier: '10-fne-wizard.png',
    titre: 'FNE prêt-à-brancher',
    callout: 'Wizard guidé en 6 étapes',
    stat: { v: 'Conforme', l: 'DGI Côte d\'Ivoire' },
    hl: { x: 4, y: 15, w: 92, h: 60, delay: 20 },
    couleur: COLORS.VERT_CLAIR,
  },
];

/** Compteur de scène en top-left + titre */
const SceneHeader: React.FC<{ index: number; total: number; titre: string }> = ({ index, total, titre }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  return (
    <div style={{
      position: 'absolute', top: 60, left: 60,
      fontFamily: FONTS.bold, color: COLORS.BLANC,
      opacity: enter, transform: `translateX(${(1 - enter) * -30}px)`,
      pointerEvents: 'none',
    }}>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 22, color: COLORS.EMERAUDE,
        fontWeight: 700, letterSpacing: '0.1em',
      }}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
      <div style={{ fontSize: 56, fontWeight: 900, marginTop: 4, letterSpacing: '-0.03em' }}>{titre}</div>
    </div>
  );
};

export const DemoFlow: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.NOIR }}>
      {SCENES.map((s, i) => (
        <Sequence key={i} from={i * DUREE_CAPTURE} durationInFrames={DUREE_CAPTURE}>
          <Screenshot
            src={s.fichier}
            zoom={{ from: 1.0, to: 1.08 }}
            pan={s.pan || { x: 0, y: 0 }}
          >
            {s.hl && (
              <Highlight
                x={s.hl.x} y={s.hl.y}
                width={s.hl.w} height={s.hl.h}
                delay={s.hl.delay || 20}
                color={s.couleur}
              />
            )}
            <BigStat
              value={s.stat.v}
              label={s.stat.l}
              position="bottom-right"
              delay={60}
              color={s.couleur}
            />
          </Screenshot>
          <SceneHeader index={i} total={SCENES.length} titre={s.titre} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const DEMO_FLOW_DURATION = SCENES.length * DUREE_CAPTURE;
