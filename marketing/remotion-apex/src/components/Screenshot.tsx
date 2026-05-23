import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';

/**
 * Composant Screenshot avec effet Ken Burns (zoom + pan lent) sur une
 * capture d'écran réelle ApeX. Style « Stripe video product page ».
 *
 * Props :
 *   src           — fichier image dans public/ (ex. "01-dashboard.png")
 *   zoom          — { from: 1, to: 1.15 } amplitude du zoom progressif
 *   pan           — { x: 0, y: 0 } translation finale en % (-10 = vers la droite)
 *   fadeInFrames  — durée du fade in (défaut 15)
 *   shadow        — ombre portée pour donner du relief (défaut true)
 *   curve         — wave brève visible (mockup mobile/desktop)
 */
export const Screenshot: React.FC<{
  src: string;
  zoom?: { from: number; to: number };
  pan?: { x: number; y: number };
  fadeInFrames?: number;
  shadow?: boolean;
  rounded?: boolean;
  children?: React.ReactNode;     // ex. <Highlight />, <Callout />
}> = ({
  src,
  zoom = { from: 1.0, to: 1.08 },
  pan = { x: 0, y: 0 },
  fadeInFrames = 15,
  shadow = true,
  rounded = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Ken Burns : zoom + pan tout au long de la séquence
  const scale = interpolate(frame, [0, durationInFrames], [zoom.from, zoom.to]);
  const translateX = interpolate(frame, [0, durationInFrames], [0, pan.x]);
  const translateY = interpolate(frame, [0, durationInFrames], [0, pan.y]);

  // Fade in en début de séquence
  const opacity = interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: COLORS.NOIR,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 60,
      opacity,
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: rounded ? 24 : 0,
        overflow: 'hidden',
        boxShadow: shadow ? '0 30px 100px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)' : 'none',
        transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
        transformOrigin: 'center center',
      }}>
        <Img
          src={staticFile(src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            display: 'block',
          }}
        />
        {/* Overlay enfants (highlights, callouts, curseur) en absolute */}
        {children}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Highlight : rectangle pulsant en surbrillance pour attirer l'attention
 * sur une zone précise de la capture (un bouton, un champ, etc.).
 * Coordonnées en % de la capture (0-100).
 */
export const Highlight: React.FC<{
  x: number; y: number; width: number; height: number;
  delay?: number;
  color?: string;
  glow?: boolean;
}> = ({ x, y, width, height, delay = 0, color = COLORS.EMERAUDE, glow = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12 },
  });
  // Effet de pulse (battement) après apparition
  const pulse = 1 + Math.sin((frame - delay) * 0.15) * 0.04;

  return (
    <div style={{
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: `${width}%`,
      height: `${height}%`,
      border: `3px solid ${color}`,
      borderRadius: 12,
      boxShadow: glow ? `0 0 30px ${color}, inset 0 0 20px ${color}40` : `0 0 10px ${color}`,
      opacity: opacity * 0.95,
      transform: `scale(${pulse})`,
      transformOrigin: 'center center',
      pointerEvents: 'none',
    }} />
  );
};

/**
 * Callout : flèche + texte de légende qui pointe vers un élément de la
 * capture. Style « tutoriel produit ».
 */
export const Callout: React.FC<{
  x: number; y: number;
  text: string;
  arrow?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  color?: string;
}> = ({ x, y, text, arrow = 'bottom', delay = 0, color = COLORS.EMERAUDE }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  return (
    <div style={{
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%, -50%) scale(${enter})`,
      pointerEvents: 'none',
      opacity: enter,
    }}>
      <div style={{
        background: color,
        color: COLORS.NOIR,
        padding: '12px 22px',
        borderRadius: 12,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 26,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        boxShadow: `0 12px 40px ${color}66`,
        position: 'relative',
      }}>
        {text}
        {/* Petite flèche pointant vers la zone */}
        <div style={{
          position: 'absolute',
          ...(arrow === 'bottom' && { bottom: -10, left: '50%', transform: 'translateX(-50%) rotate(45deg)' }),
          ...(arrow === 'top'    && { top: -10,    left: '50%', transform: 'translateX(-50%) rotate(45deg)' }),
          ...(arrow === 'left'   && { left: -10,   top:  '50%', transform: 'translateY(-50%) rotate(45deg)' }),
          ...(arrow === 'right'  && { right: -10,  top:  '50%', transform: 'translateY(-50%) rotate(45deg)' }),
          width: 20, height: 20, background: color,
        }} />
      </div>
    </div>
  );
};

/**
 * Cursor : curseur de souris animé qui se déplace vers un point et clique.
 * Sert à simuler une interaction utilisateur sur la capture.
 */
export const Cursor: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  clickAt?: number;     // frame du clic
}> = ({ from, to, clickAt = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mouvement avec courbe douce ease-out
  const progress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.5 },
  });
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;

  // Effet de clic : pulse à clickAt
  const clickPulse = frame > clickAt && frame < clickAt + 15
    ? 1 - (frame - clickAt) / 15
    : 0;

  return (
    <>
      <div style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-30%, -30%)',
        fontSize: 50,
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
        pointerEvents: 'none',
      }}>👆</div>
      {clickPulse > 0 && (
        <div style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: 80, height: 80,
          transform: `translate(-50%, -50%) scale(${1 + (1 - clickPulse)})`,
          border: `3px solid ${COLORS.EMERAUDE}`,
          borderRadius: '50%',
          opacity: clickPulse,
          pointerEvents: 'none',
        }} />
      )}
    </>
  );
};

/**
 * BigStat : grand chiffre qui sort en superposition avec un label en bas.
 * Sert à valoriser une métrique (« 1 clic », « 10 secondes », « 30 sec »).
 */
export const BigStat: React.FC<{
  value: string;
  label: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  delay?: number;
  color?: string;
}> = ({ value, label, position = 'top-right', delay = 0, color = COLORS.EMERAUDE }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 10, stiffness: 120 },
  });

  const positions = {
    'top-left':     { top: 60,    left: 60,    right: 'auto', bottom: 'auto' },
    'top-right':    { top: 60,    right: 60,   left: 'auto', bottom: 'auto' },
    'bottom-left':  { bottom: 60, left: 60,    top: 'auto',  right: 'auto' },
    'bottom-right': { bottom: 60, right: 60,   top: 'auto',  left: 'auto'  },
    'center':       { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  };

  return (
    <div style={{
      position: 'absolute',
      ...(positions[position] as React.CSSProperties),
      background: color,
      color: COLORS.NOIR,
      padding: '24px 36px',
      borderRadius: 20,
      fontFamily: "'Inter', system-ui, sans-serif",
      transform: `${position === 'center' ? 'translate(-50%, -50%) ' : ''}scale(${enter})`,
      opacity: enter,
      boxShadow: `0 20px 60px ${color}66`,
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, opacity: 0.85 }}>{label}</div>
    </div>
  );
};
