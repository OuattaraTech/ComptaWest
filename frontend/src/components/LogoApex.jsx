import { useState } from 'react';

/**
 * Logo ApeX — tente /logos/apex.svg, puis /logos/apex.png, puis fallback.
 * Pose ton fichier dans frontend/public/logos/ (apex.svg de préférence, sinon apex.png).
 *
 * Quand l'image se charge, on affiche UNIQUEMENT l'image (qui contient déjà le mot
 * « ApeX »). Le texte « ApeX » n'est rendu qu'en mode fallback (image indisponible).
 * Le sous-titre, lui, est toujours rendu s'il est fourni.
 *
 * Props :
 *   height         hauteur du logo en px (défaut 28)
 *   direction      'row' (image à gauche) | 'column' (image au-dessus) — défaut 'row'
 *   subtitle       texte/Node sous (ou à droite de) le logo — toujours affiché si fourni
 *   subtitleColor  couleur du sous-titre
 *   subtitleSize   taille en px du sous-titre (défaut 10)
 *   subtitleLetterSpacing  défaut '0.06em'
 *   subtitleUppercase      défaut false
 *   textColor      couleur du mot « ApeX » (fallback)
 *   textSize       taille du mot « ApeX » (défaut height * 0.4)
 *   gap            espace entre image et bloc texte (défaut 10)
 *   fallback       Node remplaçant l'image si elle échoue (ex. pictogramme ₣)
 */
export default function LogoApex({
  height = 28,
  direction = 'row',
  subtitle,
  subtitleColor = '#9BAACC',
  subtitleSize = 10,
  subtitleLetterSpacing = '0.06em',
  subtitleUppercase = false,
  textColor = '#fff',
  textSize,
  gap = 10,
  fallback,
}) {
  // Logo de marque complet (texte « APEX » + pictogramme) — fichier
  // rectangulaire dédié à la sidebar et aux previews sociales. Le
  // pictogramme carré (favicon) vit séparément dans /favicon.svg.
  const [src, setSrc] = useState('/logos/apex.png');
  const [imageFailed, setImageFailed] = useState(false);

  const handleError = () => setImageFailed(true);

  const computedTextSize = textSize ?? Math.round(height * 0.4);
  const hasTextBlock = imageFailed || !!subtitle;

  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: direction,
      alignItems: 'center',
      gap,
    }}>
      {!imageFailed ? (
        <img
          src={src}
          alt="ApeX"
          style={{ height, width: 'auto', objectFit: 'contain', display: 'block' }}
          onError={handleError}
        />
      ) : (
        fallback || null
      )}

      {hasTextBlock && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: direction === 'column' ? 'center' : 'flex-start',
          gap: 3, lineHeight: 1,
        }}>
          {imageFailed && (
            <span style={{
              fontSize: computedTextSize,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: textColor,
            }}>
              ApeX
            </span>
          )}
          {subtitle && (
            <span style={{
              fontSize: subtitleSize,
              color: subtitleColor,
              letterSpacing: subtitleLetterSpacing,
              textTransform: subtitleUppercase ? 'uppercase' : 'none',
              fontWeight: 600,
            }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
