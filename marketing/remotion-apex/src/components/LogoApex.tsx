import { COLORS } from '../theme';

/**
 * Pictogramme A-montagne ApeX en SVG inline.
 * Reprend exactement le favicon officiel : fond noir arrondi, sommet
 * vert clair, base blanche en V.
 */
export const LogoApex: React.FC<{ size?: number; withText?: boolean }> = ({
  size = 200,
  withText = false,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <rect width="64" height="64" rx="10" fill={COLORS.NOIR} />
        <path d="M32 18 L40 32 L24 32 Z" fill={COLORS.VERT_CLAIR} />
        <path d="M32 28 L52 50 L43 50 L32 38 L21 50 L12 50 Z" fill={COLORS.BLANC} />
      </svg>
      {withText && (
        <span
          style={{
            fontSize: size * 0.55,
            fontWeight: 900,
            color: COLORS.BLANC,
            letterSpacing: '-0.04em',
          }}
        >
          ApeX
        </span>
      )}
    </div>
  );
};
