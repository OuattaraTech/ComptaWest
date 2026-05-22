import { Fragment, useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.jsx';
import { useEntreprise } from '../hooks/useEntreprise.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import api from '../utils/api.jsx';
import {
  Sun, Moon, FileText, Wallet, BarChart3, ArrowRight,
  Truck, Box, UserCheck, Package, BookMarked,
  Smartphone, Camera, ShieldCheck, Sparkles,
  CheckCircle2, Zap, MessageCircle, Lock,
  UserPlus, Send, X, Target,
  Receipt, Briefcase, TrendingDown, Database,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import LogoFournisseur from '../components/LogoFournisseur.jsx';
import LogoApex from '../components/LogoApex.jsx';
import { ouvrirCelebrationModal } from '../components/CelebrationModal.jsx';
import toast from 'react-hot-toast';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

// Palette anti-slop : un seul accent (vert émeraude désaturé < 80%
// de saturation), off-black à la place du #000 pur, gris neutres
// chauds, AUCUNE deuxième couleur d'accent (le précédent dégradé
// teal → bleu électrique est banni par le skill).
const getC = (dark) => dark ? {
  bg: '#0E1116',           // off-black, jamais #000
  surface: '#151A21',      // surface élevée
  card: '#171C24',
  border: '#1F252E',
  borderStrong: '#2A323E',
  accent: '#2DBF9C',       // emerald desaturé (saturation ~58%)
  accentInk: '#0A1411',    // texte sur accent
  text: '#E8EAE3',
  muted: '#7A8492',
  sub: '#A9B1BC',
  red: '#E0606E',
  input: '#11161D',
} : {
  bg: '#F7F8F4',           // off-white, jamais #FFF pur en fond
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E2E4DC',
  borderStrong: '#CACDC2',
  accent: '#0F8A6E',       // emerald profond
  accentInk: '#FFFFFF',
  text: '#0E1116',         // off-black, jamais #000
  muted: '#6B7280',
  sub: '#3C4250',
  red: '#C03A4A',
  input: '#F1F2EC',
};

// Liste des icônes par clé i18n. Les titres et descriptions sont résolus
// au rendu via t('login.features.<key>.title' / '.desc').
const FEATURES = [
  { icon: FileText,   key: 'billing'   },
  { icon: Truck,      key: 'purchases' },
  { icon: Box,        key: 'stock'     },
  { icon: Wallet,     key: 'treasury'  },
  { icon: UserCheck,  key: 'payroll'   },
  { icon: Package,    key: 'assets'    },
  { icon: BookMarked, key: 'accounting'},
  { icon: BarChart3,  key: 'reports'   },
];

const DIFFERENCIATEURS = [
  { icon: Smartphone,  key: 'mobile_money' },
  { icon: Camera,      key: 'ocr'          },
  { icon: ShieldCheck, key: 'fne'          },
];

const Input = ({ label, type = 'text', value, onChange, placeholder, required, C }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    <label style={{ fontSize: 12.5, fontWeight: 600, color: C.sub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}{required && <span style={{ color: C.accent }}> *</span>}
    </label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={{
        background: C.input, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: '13px 14px', color: C.text, fontSize: 15, outline: 'none',
        transition: 'border-color 0.2s', fontFamily: 'inherit',
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

// ─────────────────────────────────────────────────────────────
// Coverflow 3D des documents générés par ApeX. Pattern « Coverflow
// Carousel » du SKILL : la carte active est plate au centre, les
// voisines en biais rotateY vers le spectateur et reculées en Z.
// Les distances latérales (var --cw-dome-x1 / x2) sont en CSS pour
// rester responsives sans déborder. Pas de WebGL, perspective pure.
// ─────────────────────────────────────────────────────────────
function DocCarousel({ docs, C, dark, fontDisplay, fontMono, fontUI }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive(prev => (prev + 1) % docs.length), 3800);
    return () => clearInterval(id);
  }, [paused, docs.length]);

  // Décalage cyclique signé pour 6 cartes : un offset entier dans
  // [-3 .. +3]. abs=0 = focal, abs=1 = voisin immédiat, abs=2 =
  // lointain encore visible, abs=3 = caché derrière la pile.
  const positions = docs.map((doc, i) => {
    let offset = i - active;
    if (offset >  docs.length / 2) offset -= docs.length;
    if (offset < -docs.length / 2) offset += docs.length;
    return { doc, i, offset, abs: Math.abs(offset), sign: Math.sign(offset) };
  });

  return (
    <div className="cw-dome" style={{
      position: 'relative', width: '100%', height: 560,
      perspective: '1600px', perspectiveOrigin: 'center 52%',
    }}
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}>

      {/* Diffusion lumineuse sous la pile (pas de néon) */}
      <div aria-hidden style={{
        position: 'absolute', bottom: '6%', left: '50%',
        transform: 'translateX(-50%)',
        width: 560, height: 200, borderRadius: '50%',
        background: `radial-gradient(ellipse, ${C.accent}${dark ? '22' : '18'}, transparent 70%)`,
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Ligne d'horizon — souligne le demi-cercle */}
      <div aria-hidden className="cw-dome-floor" style={{
        position: 'absolute', bottom: '12%', left: '8%', right: '8%',
        height: 1,
        background: `linear-gradient(90deg, transparent 0%, ${C.borderStrong} 22%, ${C.borderStrong} 78%, transparent 100%)`,
        zIndex: 0,
      }} />

      {/* Stage 3D — chaque carte se positionne indépendamment. Le
          scale global vient des breakpoints CSS et préserve les
          distances relatives (jamais de chevauchement). */}
      <div className="cw-dome-stage" style={{
        position: 'absolute', inset: 0,
        transformStyle: 'preserve-3d',
        transform: 'scale(var(--cw-dome-scale, 1))',
        transformOrigin: 'center center',
      }}>
        {positions.map(({ doc, i, offset, abs, sign }) => {
          // Sélection des variables CSS responsives selon la distance.
          // abs=1 utilise --cw-dome-x1, abs=2 utilise --cw-dome-x2.
          const tx = abs === 0
            ? '0px'
            : `calc(${sign} * var(--cw-dome-x${Math.min(abs, 2)}, ${abs === 1 ? '260px' : '440px'}))`;
          const tz      = abs === 0 ? 80 : -abs * 140;
          const ry      = abs === 0 ? 0  : -sign * (abs === 1 ? 32 : 48);
          const scale   = abs === 0 ? 1  : abs === 1 ? 0.82 : 0.62;
          const opacity = abs === 0 ? 1  : abs === 1 ? 0.78 : abs === 2 ? 0.30 : 0;
          const z       = 100 - abs * 10;
          const pe      = abs >= 3 ? 'none' : 'auto';

          return (
            <button key={doc.key} type="button"
              onClick={() => setActive(i)}
              aria-label={doc.label}
              aria-current={i === active}
              className="cw-dome-card"
              style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: 290, height: 440,
                margin: '-220px 0 0 -145px',
                transform: `translate3d(${tx}, 0, ${tz}px) rotateY(${ry}deg) scale(${scale})`,
                opacity, zIndex: z,
                pointerEvents: pe,
                transition: 'transform 0.95s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
                background: 'transparent', border: 'none', padding: 0,
                cursor: abs === 0 ? 'default' : 'pointer',
                willChange: 'transform, opacity',
              }}>
              <DocCard doc={doc} active={i === active} C={C} dark={dark} fontMono={fontMono} fontDisplay={fontDisplay} />
            </button>
          );
        })}
      </div>

      {/* Légende du document focal — mono + display */}
      <div style={{
        position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)',
        zIndex: 5, textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: fontMono, fontSize: 12.5, color: C.muted,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          / {String(active + 1).padStart(2, '0')} sur {String(docs.length).padStart(2, '0')}
        </div>
        <div key={active} style={{
          fontFamily: fontDisplay, fontSize: 19, fontWeight: 700,
          color: C.text, letterSpacing: '-0.015em',
          animation: 'cw-doc-label 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {docs[active].label}
        </div>
      </div>

      {/* Pagination — barre active expandée */}
      <div style={{
        position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, zIndex: 5, pointerEvents: 'auto',
      }}>
        {docs.map((doc, i) => (
          <button key={doc.key} type="button"
            onClick={() => setActive(i)}
            aria-label={doc.label}
            style={{
              width: i === active ? 32 : 8, height: 4,
              borderRadius: 100,
              background: i === active ? C.accent : C.borderStrong,
              border: 'none', cursor: 'pointer',
              transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s',
              padding: 0,
            }} />
        ))}
      </div>
    </div>
  );
}

// Carte du dôme. Si une image est fournie (frontend/public/documents/),
// elle est rendue en plein cadre ; sinon on tombe sur le mockup
// synthétique qui reprend la mise en page du PDF buildFactureDoc.
function DocCard({ doc, active, C, dark, fontMono, fontDisplay }) {
  const Icon = doc.icon;
  const [imgFailed, setImgFailed] = useState(false);

  const shellStyle = {
    width: 290, height: 440,
    background: '#FFFFFF', color: '#0E1116',
    borderRadius: 14,
    boxShadow: active
      ? '0 36px 90px rgba(14,17,22,0.38), 0 12px 28px rgba(14,17,22,0.18), inset 0 1px 0 rgba(255,255,255,0.7)'
      : '0 16px 40px rgba(14,17,22,0.22), inset 0 1px 0 rgba(255,255,255,0.5)',
    transition: 'box-shadow 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
    transform: 'translateZ(0)',
    willChange: 'transform',
    overflow: 'hidden',
  };

  // Cas 1 : une vraie image du document a été déposée et charge sans
  // erreur — on l'affiche en plein cadre avec un badge ApeX discret.
  if (doc.image && !imgFailed) {
    return (
      <div style={{ ...shellStyle, position: 'relative' }}>
        <img
          src={doc.image}
          alt={doc.label}
          onError={() => setImgFailed(true)}
          draggable={false}
          style={{
            display: 'block', width: '100%', height: '100%',
            objectFit: 'contain', objectPosition: 'center top',
            background: '#FFFFFF',
          }}
        />
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 9px', borderRadius: 100,
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #0F8A6E50',
          color: '#0B6E58',
          fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
          fontFamily: '"Helvetica Neue", Roboto, Arial, sans-serif',
          pointerEvents: 'none',
        }}>
          <Icon size={9} strokeWidth={2.4} /> ApeX
        </div>
      </div>
    );
  }

  // Cas 2 : pas d'image disponible — fallback sur le mockup synthétique
  return (
    <div style={{
      ...shellStyle,
      padding: '20px 22px 16px', display: 'flex', flexDirection: 'column',
      fontFamily: '"Helvetica Neue", Roboto, Arial, sans-serif',
    }}>
      {/* Header émetteur + sceau ApeX */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0E1116', letterSpacing: '-0.005em', lineHeight: 1.15 }}>
            SARL OUATTARA TECH
          </div>
          <div style={{ fontSize: 7.5, color: '#6B7280', marginTop: 2, lineHeight: 1.3 }}>
            Plateau, Abidjan · RCCM CI-ABJ-2024-B-1234
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 7px', borderRadius: 100,
          background: '#0F8A6E10', border: '1px solid #0F8A6E40', color: '#0B6E58',
          fontSize: 7.5, fontWeight: 800, flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          <Icon size={9} strokeWidth={2.4} /> ApeX
        </div>
      </div>

      {/* Signature verte */}
      <div style={{ height: 2, background: '#0F8A6E', borderRadius: 1, margin: '8px 0 10px' }} />

      {/* Headline du document (mono, accent) */}
      <div style={{
        fontFamily: fontMono, fontSize: 11.5, fontWeight: 700,
        color: '#0B6E58', letterSpacing: '0.01em', marginBottom: 10,
        lineHeight: 1.25,
      }}>
        {doc.headline}
      </div>

      {/* Corps spécifique au document */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        {renderDocBody(doc.key, fontMono)}
      </div>

      {/* Pied — uniforme */}
      <div style={{
        fontSize: 7.5, color: '#6B7280', fontStyle: 'italic',
        textAlign: 'center', marginTop: 10, paddingTop: 8,
        borderTop: '0.5px solid #0F8A6E',
      }}>
        Document généré par ApeX · Conforme SYSCOHADA
      </div>
    </div>
  );
}

// Body du mockup selon le type de document. Les libellés métier
// (BILAN, BULLETIN, FEC…) sont en français standard OHADA — pas
// d'i18n ici, ce sont les termes officiels reconnus par la DGI.
function renderDocBody(kind, fontMono) {
  const mono = { fontFamily: fontMono, fontVariantNumeric: 'tabular-nums' };
  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 9, color: '#0E1116' };
  const rowMuted = { ...row, color: '#6B7280' };
  const headerRow = {
    display: 'grid', background: '#0F8A6E', color: '#fff',
    fontSize: 8, fontWeight: 800, padding: '4px 6px', gap: 4,
  };
  const dataRow = {
    display: 'grid', fontSize: 8.5, color: '#0E1116',
    padding: '4px 6px', gap: 4, borderTop: '0.5px solid #E2E4DC',
  };
  const totalRow = {
    display: 'flex', justifyContent: 'space-between',
    padding: '6px 0 2px', fontSize: 10.5, fontWeight: 900,
    color: '#0F8A6E', borderTop: '0.5px solid #E2E4DC', marginTop: 4,
  };

  if (kind === 'facture' || kind === 'devis') {
    return (
      <>
        <div style={{ fontSize: 7.5, color: '#6B7280' }}>
          {kind === 'facture' ? 'Émise le 18/05/2026 · Échéance 17/06/2026' : 'Validité 30 jours · Établi le 18/05/2026'}
        </div>
        <div style={{ fontSize: 8.5, fontWeight: 800, color: '#0E1116', marginTop: 2 }}>
          Banque Atlantique CI
        </div>
        <div style={{ border: '0.5px solid #E2E4DC', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
          <div style={{ ...headerRow, gridTemplateColumns: '1fr 22px 50px 56px' }}>
            <span>Description</span>
            <span style={{ textAlign: 'center' }}>Qté</span>
            <span style={{ textAlign: 'right' }}>P.U.</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {[
            { d: 'Audit SI SYSCOHADA',     q: 1, pu: '750 000', t: '750 000' },
            { d: 'Formation équipe (2 j.)', q: 2, pu: '240 000', t: '480 000' },
          ].map((l, i) => (
            <div key={i} style={{ ...dataRow, gridTemplateColumns: '1fr 22px 50px 56px', background: i % 2 ? '#F7F8F4' : '#fff' }}>
              <span>{l.d}</span>
              <span style={{ textAlign: 'center', ...mono }}>{l.q}</span>
              <span style={{ textAlign: 'right', ...mono }}>{l.pu}</span>
              <span style={{ textAlign: 'right', fontWeight: 600, ...mono }}>{l.t}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div style={rowMuted}><span>Sous-total HT</span><span style={mono}>1 230 000</span></div>
          <div style={rowMuted}><span>TVA (18%)</span><span style={mono}>221 400</span></div>
          <div style={totalRow}>
            <span>{kind === 'facture' ? 'TOTAL TTC' : 'TOTAL ESTIMÉ'}</span>
            <span style={mono}>1 451 400 FCFA</span>
          </div>
        </div>
      </>
    );
  }

  if (kind === 'bulletin') {
    return (
      <>
        <div style={{ fontSize: 7.5, color: '#6B7280' }}>Période · Mai 2026 · Matricule M-014</div>
        <div style={{ fontSize: 8.5, fontWeight: 800, color: '#0E1116', marginTop: 2 }}>
          Adjoua N'Goran · Comptable senior
        </div>
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column' }}>
          <div style={row}><span>Salaire de base</span><span style={mono}>450 000</span></div>
          <div style={row}><span>Indemnité transport</span><span style={mono}>30 000</span></div>
          <div style={row}><span>Prime de rendement</span><span style={mono}>50 000</span></div>
          <div style={{ ...row, paddingTop: 6, borderTop: '0.5px solid #E2E4DC', fontWeight: 700 }}>
            <span>Salaire brut</span><span style={mono}>530 000</span>
          </div>
          <div style={rowMuted}><span>CNPS part salariale (6,3%)</span><span style={mono}>−33 390</span></div>
          <div style={rowMuted}><span>ITS (DGI)</span><span style={mono}>−42 850</span></div>
          <div style={rowMuted}><span>CMU (1 000 / mois)</span><span style={mono}>−1 000</span></div>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ ...totalRow }}>
            <span>NET À PAYER</span>
            <span style={mono}>452 760 FCFA</span>
          </div>
        </div>
      </>
    );
  }

  if (kind === 'bilan') {
    return (
      <>
        <div style={{ fontSize: 7.5, color: '#6B7280' }}>Exercice clos · 31 décembre 2025</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, color: '#0F8A6E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Actif</div>
            <div style={rowMuted}><span>Immobilisations</span><span style={mono}>14,2 M</span></div>
            <div style={rowMuted}><span>Stocks</span><span style={mono}>3,8 M</span></div>
            <div style={rowMuted}><span>Créances</span><span style={mono}>6,1 M</span></div>
            <div style={rowMuted}><span>Trésorerie</span><span style={mono}>4,3 M</span></div>
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, color: '#0F8A6E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Passif</div>
            <div style={rowMuted}><span>Capitaux propres</span><span style={mono}>16,5 M</span></div>
            <div style={rowMuted}><span>Dettes financières</span><span style={mono}>5,2 M</span></div>
            <div style={rowMuted}><span>Fournisseurs</span><span style={mono}>4,8 M</span></div>
            <div style={rowMuted}><span>Dettes fiscales</span><span style={mono}>1,9 M</span></div>
          </div>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div style={totalRow}>
            <span>TOTAL BILAN</span>
            <span style={mono}>28 400 000 FCFA</span>
          </div>
        </div>
      </>
    );
  }

  if (kind === 'amortissement') {
    return (
      <>
        <div style={{ fontSize: 7.5, color: '#6B7280' }}>Bien · Toyota Hilux 2024 · N° inv. IMMO-024</div>
        <div style={{ fontSize: 8.5, color: '#0E1116', marginTop: 2 }}>
          Base amortissable <strong style={{ ...mono }}>18 500 000 FCFA</strong> · linéaire 5 ans
        </div>
        <div style={{ border: '0.5px solid #E2E4DC', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
          <div style={{ ...headerRow, gridTemplateColumns: '34px 1fr 1fr 1fr' }}>
            <span>Année</span>
            <span style={{ textAlign: 'right' }}>Dotation</span>
            <span style={{ textAlign: 'right' }}>Cumul</span>
            <span style={{ textAlign: 'right' }}>VNC</span>
          </div>
          {[
            { y: 2024, dot: '3 700 000', cum: '3 700 000', vnc: '14 800 000' },
            { y: 2025, dot: '3 700 000', cum: '7 400 000', vnc: '11 100 000' },
            { y: 2026, dot: '3 700 000', cum: '11 100 000', vnc: '7 400 000' },
            { y: 2027, dot: '3 700 000', cum: '14 800 000', vnc: '3 700 000' },
            { y: 2028, dot: '3 700 000', cum: '18 500 000', vnc: '0' },
          ].map((r, i) => (
            <div key={r.y} style={{ ...dataRow, gridTemplateColumns: '34px 1fr 1fr 1fr', background: i % 2 ? '#F7F8F4' : '#fff' }}>
              <span style={mono}>{r.y}</span>
              <span style={{ textAlign: 'right', ...mono }}>{r.dot}</span>
              <span style={{ textAlign: 'right', ...mono }}>{r.cum}</span>
              <span style={{ textAlign: 'right', fontWeight: 600, ...mono }}>{r.vnc}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (kind === 'grandlivre') {
    return (
      <>
        <div style={{ fontSize: 7.5, color: '#6B7280' }}>Exercice 2025 · 14 287 écritures validées · Extrait pour la DGI</div>
        <div style={{
          marginTop: 4, padding: '6px 7px',
          background: '#0E1116', color: '#E8EAE3',
          borderRadius: 5, ...mono,
          fontSize: 7, lineHeight: 1.55, overflow: 'hidden',
        }}>
          <div style={{ color: '#7A8492' }}>Journal|Pièce|Date|Compte|Libellé|Débit|Crédit</div>
          <div>VTE|F-2026-0042|20260518|411000|Banque Atlantique|1451400|0</div>
          <div>VTE|F-2026-0042|20260518|701000|Vente prestations|0|1230000</div>
          <div>VTE|F-2026-0042|20260518|443100|TVA collectée 18%|0|221400</div>
          <div>ACH|D-2026-0094|20260517|601000|Fournitures bureau|85000|0</div>
          <div>BAN|REL-05|20260520|521000|Encaissement Wave|1451400|0</div>
          <div style={{ color: '#7A8492' }}>... 14 281 lignes supplémentaires</div>
        </div>
        <div style={{ marginTop: 'auto', fontSize: 8.5, color: '#0E1116' }}>
          Encodage <strong style={mono}>UTF-8</strong> · Séparateur <strong style={mono}>|</strong> · Article 17 OHADA · Écritures intangibles
        </div>
      </>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Carrousel horizontal des 8 modules. Scroll natif + scroll-snap
// (drag, touch et clavier OK), flèches lumineuses émeraude pour
// défiler à la main, contour qui s'illumine au survol. Chaque
// carte liste toutes les fonctionnalités du module — pas d'icône
// (la promesse fonctionnelle parle d'elle-même).
// ─────────────────────────────────────────────────────────────
function FeatScroller({ features, t, C, dark, fontDisplay, fontMono, fontUI }) {
  const scrollerRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [progress, setProgress] = useState(0);

  // Met à jour les flèches actives + la barre de progression à chaque scroll.
  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < maxScroll - 4);
    setProgress(maxScroll > 0 ? el.scrollLeft / maxScroll : 0);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  // Défilement d'une carte à la fois (sens : -1 = gauche, +1 = droite).
  const scrollByCard = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const firstCard = el.querySelector('.cw-feat-card');
    const cardWidth = firstCard ? firstCard.offsetWidth + 18 : 400;
    el.scrollBy({ left: dir * cardWidth, behavior: 'smooth' });
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Track horizontale — scroll natif + snap, scrollbar masquée */}
      <div ref={scrollerRef} className="cw-feats-scroll" style={{
        display: 'flex', gap: 18,
        overflowX: 'auto', overflowY: 'visible',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        paddingBottom: 24,
        paddingLeft: 4, paddingRight: 4,
        marginLeft: -4, marginRight: -4,
      }}>
        {features.map(({ key }, idx) => {
          const items = t(`login.features.${key}.items`, { returnObjects: true }) || [];
          return (
            <article key={key} className="cw-feat-card" style={{
              flex: '0 0 auto',
              width: 'min(380px, 82vw)',
              scrollSnapAlign: 'start',
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              padding: '32px 28px',
              display: 'flex', flexDirection: 'column', gap: 18,
              position: 'relative',
              transition: 'border-color 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s',
              boxShadow: dark
                ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
                : 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(14,17,22,0.04)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = C.accent;
              e.currentTarget.style.transform = 'translateY(-2px)';
              // Contour qui s'illumine — anneau extérieur très subtil
              // teinté de l'accent (pas du néon, on reste dans la spec)
              e.currentTarget.style.boxShadow = dark
                ? `0 0 0 1px ${C.accent}55, 0 18px 40px ${C.accent}22, inset 0 1px 0 rgba(255,255,255,0.06)`
                : `0 0 0 1px ${C.accent}55, 0 16px 36px ${C.accent}18, inset 0 1px 0 rgba(255,255,255,0.7)`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = dark
                ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
                : 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(14,17,22,0.04)';
            }}>
              {/* Numéro mono en kicker — pas d'icône */}
              <div style={{
                fontFamily: fontMono, fontSize: 12.5,
                color: C.accent, fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                / Module {String(idx + 1).padStart(2, '0')} sur {String(features.length).padStart(2, '0')}
              </div>

              <h3 style={{
                fontFamily: fontDisplay,
                fontSize: 24, fontWeight: 700,
                color: C.text, letterSpacing: '-0.02em',
                lineHeight: 1.15, margin: 0,
              }}>
                {t(`login.features.${key}.title`)}
              </h3>

              <p style={{
                fontSize: 14.5, color: C.sub, lineHeight: 1.55,
                margin: 0,
              }}>
                {t(`login.features.${key}.desc`)}
              </p>

              {/* Liste détaillée des fonctionnalités — tirets fins + accent */}
              <ul style={{
                listStyle: 'none', padding: 0, margin: 0,
                display: 'flex', flexDirection: 'column', gap: 10,
                paddingTop: 16, borderTop: `1px solid ${C.border}`,
              }}>
                {Array.isArray(items) && items.map((item, i) => (
                  <li key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 11,
                    fontSize: 13.5, color: C.sub, lineHeight: 1.5,
                  }}>
                    <span aria-hidden style={{
                      marginTop: 8, width: 14, height: 1,
                      background: C.accent, flexShrink: 0,
                    }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      {/* Flèches lumineuses — disques émeraude avec inner border refraction
          (style Liquid Glass du SKILL) et halo tinted très diffus. */}
      {[
        { dir: -1, side: 'left',  active: canLeft,  Icon: ChevronLeft  },
        { dir: +1, side: 'right', active: canRight, Icon: ChevronRight },
      ].map(({ dir, side, active, Icon }) => (
        <button
          key={side}
          type="button"
          onClick={() => scrollByCard(dir)}
          disabled={!active}
          aria-label={dir > 0 ? 'Module suivant' : 'Module précédent'}
          className="cw-feat-arrow"
          style={{
            position: 'absolute', top: '50%', [side]: -8,
            transform: 'translateY(-50%)',
            width: 52, height: 52, borderRadius: '50%',
            background: active ? C.accent : (dark ? C.surface : '#FFFFFF'),
            color: active ? C.accentInk : C.muted,
            border: `1px solid ${active ? C.accent : C.border}`,
            cursor: active ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
            transition: 'background 0.25s, color 0.25s, box-shadow 0.4s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: active
              ? `0 0 0 4px ${C.accent}22, 0 12px 28px ${C.accent}40, inset 0 1px 0 rgba(255,255,255,0.25)`
              : (dark ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : '0 4px 12px rgba(14,17,22,0.08), inset 0 1px 0 rgba(255,255,255,0.6)'),
            opacity: active ? 1 : 0.5,
          }}
          onMouseEnter={e => {
            if (!active) return;
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.06)';
            e.currentTarget.style.boxShadow = `0 0 0 6px ${C.accent}30, 0 16px 36px ${C.accent}55, inset 0 1px 0 rgba(255,255,255,0.3)`;
          }}
          onMouseLeave={e => {
            if (!active) return;
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            e.currentTarget.style.boxShadow = `0 0 0 4px ${C.accent}22, 0 12px 28px ${C.accent}40, inset 0 1px 0 rgba(255,255,255,0.25)`;
          }}>
          <Icon size={22} strokeWidth={2.2} />
        </button>
      ))}

      {/* Barre de progression du scroll — discrète, sous la track */}
      <div style={{
        position: 'relative',
        marginTop: -10, marginLeft: 4, marginRight: 4,
        height: 3, borderRadius: 100,
        background: C.border, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: '32%',
          background: C.accent, borderRadius: 100,
          transform: `translateX(${progress * (100 / 0.32 - 100)}%)`,
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: `0 0 8px ${C.accent}80`,
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Visuels expressifs des trois différenciateurs (section
// « Ce qu'aucun tableur ne vous donnera »). Au lieu d'un cadre
// vide avec une icône, chaque mockup illustre concrètement
// la promesse : WhatsApp + paiement Wave, OCR avant/après,
// sceau FNE avec ligne de scan. Tout en émeraude unique
// (pas de palette multicolore, conforme au SKILL).
// ─────────────────────────────────────────────────────────────
function DiffShowcase({ kind, C, dark, fontMono, fontUI }) {
  const shell = {
    position: 'relative', width: '100%', aspectRatio: '4 / 3',
    borderRadius: 16, overflow: 'hidden',
    background: dark
      ? `linear-gradient(155deg, ${C.surface} 0%, ${C.card} 100%)`
      : `linear-gradient(155deg, #FFFFFF 0%, ${C.input} 100%)`,
    border: `1px solid ${C.border}`,
    boxShadow: `inset 0 1px 0 ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'}`,
  };

  if (kind === 'mobile_money') {
    // Conversation WhatsApp avec lien de paiement Wave qui passe en « payée ».
    return (
      <div style={shell}>
        <div style={{
          position: 'absolute', inset: '12% 14% 12% 14%',
          background: '#E5DDD5',     // fond WhatsApp authentique (beige clair)
          borderRadius: 14,
          padding: '14px 12px 16px',
          display: 'flex', flexDirection: 'column', gap: 9,
          fontFamily: '"Helvetica Neue", Roboto, Arial, sans-serif',
          boxShadow: '0 14px 30px rgba(14,17,22,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
        }}>
          {/* En-tête WhatsApp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid rgba(14,17,22,0.08)' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: '#1FA855', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
            }}>BA</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0E1116' }}>Banque Atlantique CI</div>
              <div style={{ fontSize: 8.5, color: '#6B7280' }}>en ligne</div>
            </div>
            <MessageCircle size={14} strokeWidth={1.6} color="#6B7280" />
          </div>

          {/* Bulle 1 — message envoyé (vert pâle, droite) */}
          <div style={{
            alignSelf: 'flex-end', maxWidth: '78%',
            background: '#DCF8C6', borderRadius: '10px 10px 2px 10px',
            padding: '7px 10px 6px', position: 'relative',
            boxShadow: '0 1px 1px rgba(14,17,22,0.06)',
          }}>
            <div style={{ fontSize: 9.5, color: '#0E1116', lineHeight: 1.35 }}>
              Bonjour, voici la facture <strong>F-2026-0042</strong> · 1 451 400 FCFA. Lien Wave :
            </div>
            <div style={{
              marginTop: 5, padding: '5px 8px', borderRadius: 6,
              background: 'rgba(31,168,85,0.10)', border: '1px solid rgba(31,168,85,0.25)',
              fontSize: 8.5, color: '#0B6E58', fontFamily: fontMono, wordBreak: 'break-all',
            }}>apex.ci/p/F-2026-0042</div>
            <div style={{ fontSize: 7.5, color: '#6B7280', textAlign: 'right', marginTop: 3 }}>
              09:42 <span style={{ color: '#34B7F1' }}>✓✓</span>
            </div>
          </div>

          {/* Bulle 2 — réponse client (blanc, gauche) avec micro-animation */}
          <div className="cw-diff-fade-in" style={{
            alignSelf: 'flex-start', maxWidth: '70%',
            background: '#FFFFFF', borderRadius: '10px 10px 10px 2px',
            padding: '7px 10px 6px',
            boxShadow: '0 1px 1px rgba(14,17,22,0.06)',
          }}>
            <div style={{ fontSize: 9.5, color: '#0E1116', lineHeight: 1.35 }}>
              C'est payé, merci !
            </div>
            <div style={{ fontSize: 7.5, color: '#6B7280', textAlign: 'right', marginTop: 3 }}>
              13:54
            </div>
          </div>

          {/* Notif système — paiement confirmé */}
          <div style={{
            alignSelf: 'center',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 100,
            background: 'rgba(15,138,110,0.12)',
            border: '1px solid rgba(15,138,110,0.30)',
            color: '#0B6E58', fontSize: 8.5, fontWeight: 700,
          }}>
            <span className="cw-diff-pulse" style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#0F8A6E', flexShrink: 0,
            }} />
            Wave · 1 451 400 FCFA reçus · F-2026-0042 marquée payée
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'ocr') {
    // Reçu froissé à gauche → formulaire pré-rempli à droite (avant/après).
    return (
      <div style={shell}>
        <div style={{
          position: 'absolute', inset: '12% 8% 12% 8%',
          display: 'grid', gridTemplateColumns: '0.85fr auto 1fr',
          gap: 16, alignItems: 'center',
        }}>
          {/* Reçu froissé (avant OCR) */}
          <div style={{
            position: 'relative',
            background: '#FAFAF6', color: '#0E1116',
            borderRadius: 6, padding: '14px 12px',
            fontFamily: '"Courier New", monospace', fontSize: 8.5,
            boxShadow: '0 10px 24px rgba(14,17,22,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
            transform: 'rotate(-3deg)',
            border: '1px solid rgba(14,17,22,0.08)',
            lineHeight: 1.4,
          }}>
            <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 6, fontSize: 9.5 }}>
              SHELL CI
            </div>
            <div style={{ borderTop: '1px dashed #6B7280', borderBottom: '1px dashed #6B7280', padding: '4px 0', marginBottom: 6 }}>
              <div>17/05/26  14:32</div>
              <div>Station Plateau</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Super 95L</span><span>42 500</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA 18%</span><span>7 650</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #0E1116', marginTop: 4, paddingTop: 4 }}>
              <span>TOTAL</span><span>50 150</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 7, color: '#6B7280', marginTop: 6 }}>
              Merci de votre visite
            </div>
          </div>

          {/* Flèche OCR animée */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: C.accent, fontFamily: fontMono, fontSize: 8.5, fontWeight: 700,
          }}>
            <div className="cw-diff-arrow" style={{
              width: 28, height: 28, borderRadius: '50%',
              background: C.accent, color: C.accentInk,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={14} strokeWidth={2.2} />
            </div>
            <div style={{ letterSpacing: '0.06em' }}>OCR</div>
          </div>

          {/* Formulaire pré-rempli (après OCR) */}
          <div style={{
            background: dark ? '#171C24' : '#FFFFFF', color: C.text,
            borderRadius: 8, padding: '12px 11px',
            border: `1px solid ${C.border}`,
            boxShadow: '0 10px 24px rgba(14,17,22,0.10), inset 0 1px 0 rgba(255,255,255,0.5)',
            display: 'flex', flexDirection: 'column', gap: 7,
            fontFamily: fontUI,
          }}>
            {[
              { lbl: 'Fournisseur', val: 'SHELL CI',     delay: '0.1s' },
              { lbl: 'Date',        val: '17/05/2026',   delay: '0.5s' },
              { lbl: 'HT',          val: '42 500',       delay: '0.9s' },
              { lbl: 'TVA 18%',     val: '7 650',        delay: '1.3s' },
              { lbl: 'Compte',      val: '6061 Carburant', delay: '1.7s' },
            ].map((f, i) => (
              <div key={f.lbl} className="cw-diff-fill" style={{
                display: 'grid', gridTemplateColumns: '52px 1fr 12px',
                gap: 7, alignItems: 'center',
                animationDelay: f.delay,
              }}>
                <div style={{ fontSize: 7.5, color: C.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {f.lbl}
                </div>
                <div style={{
                  fontSize: 9.5, fontWeight: 600, color: C.text,
                  padding: '3px 6px', borderRadius: 4,
                  background: dark ? '#11161D' : '#F7F8F4',
                  borderLeft: `2px solid ${C.accent}`,
                }}>
                  {f.val}
                </div>
                <CheckCircle2 size={11} color={C.accent} strokeWidth={2.2} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'fne') {
    // Sceau officiel FNE avec QR code + ligne de scan animée.
    return (
      <div style={shell}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'relative',
            background: '#FFFFFF', color: '#0E1116',
            borderRadius: 12, padding: '20px 22px',
            width: '78%', maxWidth: 360,
            boxShadow: '0 18px 40px rgba(14,17,22,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
            fontFamily: '"Helvetica Neue", Roboto, Arial, sans-serif',
            border: '1px solid rgba(15,138,110,0.30)',
          }}>
            {/* Tampon DGI en filigrane */}
            <div aria-hidden style={{
              position: 'absolute', top: 16, right: 18,
              width: 64, height: 64, borderRadius: '50%',
              border: '2px solid rgba(15,138,110,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-14deg)',
              color: 'rgba(15,138,110,0.40)',
              fontSize: 8, fontWeight: 800, textAlign: 'center', lineHeight: 1.1,
              letterSpacing: '0.05em',
            }}>
              DGI<br/>CI<br/>FNE
            </div>

            <div style={{ fontSize: 8.5, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Direction Générale des Impôts
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0E1116', marginBottom: 12 }}>
              Certificat fiscal d'émission
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {/* QR code scannable — pointe vers le portail FNE/DGI fictif
                  mais cohérent. Niveau M (15% error correction) suffit pour
                  une scène mockup. Fond noir + modules blancs pour contraste
                  fort à cette taille. */}
              <div style={{
                position: 'relative', flexShrink: 0,
                padding: 4, background: '#0E1116', borderRadius: 6,
                lineHeight: 0,
              }}>
                <QRCodeSVG
                  value="https://fne.dgi.ci/verify/FNE-2026-CI-0042-7B3A"
                  size={70}
                  bgColor="#0E1116"
                  fgColor="#FFFFFF"
                  level="M"
                />
                <div className="cw-diff-scan" aria-hidden style={{
                  position: 'absolute', left: 4, right: 4, top: 4,
                  height: 2, background: '#0F8A6E',
                  boxShadow: '0 0 8px #0F8A6E',
                  pointerEvents: 'none',
                }} />
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 8, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                  Numéro FNE
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0F8A6E', fontFamily: fontMono, letterSpacing: '-0.005em', marginBottom: 7 }}>
                  FNE-2026-CI<br/>0042-7B3A
                </div>
                <div className="cw-diff-pop" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 100,
                  background: 'rgba(15,138,110,0.12)',
                  border: '1px solid rgba(15,138,110,0.40)',
                  color: '#0B6E58', fontSize: 8, fontWeight: 800,
                }}>
                  <CheckCircle2 size={9} strokeWidth={2.4} />
                  Transmis DGI · 600 ms
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 12, paddingTop: 8,
              borderTop: '1px dashed rgba(14,17,22,0.15)',
              fontSize: 7.5, color: '#6B7280', fontStyle: 'italic',
            }}>
              Vérifiable sur le portail FNE de la DGI Côte d'Ivoire
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Matrice de permissions (extrait). Visualise quels rôles ont
// accès à quels modules — l'extrait reprend les 8 rôles métier
// principaux et 7 modules clés, calqués sur la matrice réelle
// du back (cf. memory project_roles + permissions.js). Trois
// états : accès complet (•), lecture seule (◐), pas d'accès.
// ─────────────────────────────────────────────────────────────
function PermissionsMatrix({ C, dark, t, fontDisplay, fontMono, fontUI }) {
  // F = full / R = read-only / N = none. L'ordre des rôles suit la
  // hiérarchie habituelle ; l'ordre des modules suit l'ordre de la
  // sidebar applicative pour rester reconnaissable.
  const ROLES = [
    { key: 'proprietaire',     short: 'Prop.'  },
    { key: 'admin',            short: 'Admin'  },
    { key: 'expert_comptable', short: 'EC'     },
    { key: 'comptable',        short: 'Cpta.'  },
    { key: 'rh',               short: 'RH'     },
    { key: 'commercial',       short: 'Comm.'  },
    { key: 'magasinier',       short: 'Maga.'  },
    { key: 'auditeur',         short: 'Audit.' },
  ];
  // Modules × états par rôle (8 rôles, 7 modules = 56 cellules).
  // Très volontairement asymétrique : le commercial n'a rien sur
  // la compta, le RH n'a rien sur les ventes, l'auditeur est
  // toujours en lecture, etc. — calqué sur la vraie matrice back.
  const MODULES = [
    { key: 'factures',     access: ['F', 'F', 'F', 'F', 'N', 'F', 'R', 'R'] },
    { key: 'depenses',     access: ['F', 'F', 'F', 'F', 'N', 'R', 'F', 'R'] },
    { key: 'tresorerie',   access: ['F', 'F', 'F', 'F', 'N', 'N', 'N', 'R'] },
    { key: 'paie',         access: ['F', 'F', 'R', 'R', 'F', 'N', 'N', 'R'] },
    { key: 'produits',     access: ['F', 'F', 'R', 'R', 'N', 'F', 'F', 'R'] },
    { key: 'comptabilite', access: ['F', 'F', 'F', 'F', 'N', 'N', 'N', 'R'] },
    { key: 'rapports',     access: ['F', 'F', 'F', 'R', 'R', 'R', 'R', 'F'] },
  ];

  const DOT_SIZE = 14;

  const dotStyle = (state) => {
    const base = {
      width: DOT_SIZE, height: DOT_SIZE, borderRadius: '50%',
      margin: '0 auto',
    };
    if (state === 'F') return {
      ...base, background: C.accent,
      boxShadow: `inset 0 0 0 1px ${C.accent}`,
    };
    if (state === 'R') return {
      ...base, background: 'transparent',
      boxShadow: `inset 0 0 0 1.5px ${C.accent}`,
      position: 'relative',
    };
    // 'N' : juste un point fin neutre
    return {
      ...base, width: 4, height: 4,
      background: C.borderStrong, marginTop: 5,
    };
  };

  return (
    <div style={{
      background: dark ? C.surface : '#FFFFFF',
      border: `1px solid ${C.border}`,
      borderRadius: 16, padding: '24px 22px 20px',
      boxShadow: dark
        ? '0 16px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)'
        : '0 12px 30px rgba(14,17,22,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
      overflow: 'hidden',
    }}>
      {/* En-tête : badge caption + légende inline */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 18, gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{
          fontFamily: fontMono, fontSize: 11.5, fontWeight: 600,
          color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          / {t('login.team_matrix_caption')}
        </div>
        <div style={{
          display: 'flex', gap: 14, flexWrap: 'wrap',
          fontSize: 11, color: C.muted, fontFamily: fontUI,
        }}>
          {[
            { state: 'F', label: t('login.team_legend_full') },
            { state: 'R', label: t('login.team_legend_read') },
            { state: 'N', label: t('login.team_legend_none') },
          ].map(({ state, label }) => (
            <span key={state} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                ...dotStyle(state),
                width: state === 'N' ? 4 : 10,
                height: state === 'N' ? 4 : 10,
                marginTop: state === 'N' ? 0 : 0,
              }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Table CSS pure — pas de <table> pour garder la flexibilité
          des largeurs sur mobile. Header sticky horizontalement. */}
      <div style={{ overflowX: 'auto', margin: '0 -22px', padding: '0 22px' }} className="cw-team-matrix-scroll">
        <div style={{
          display: 'grid',
          gridTemplateColumns: `minmax(140px, 1.2fr) repeat(${ROLES.length}, minmax(54px, 1fr))`,
          gap: 0,
          minWidth: 540,
        }}>
          {/* Header : « Module » + libellés courts des rôles */}
          <div style={cellHeader(C, fontUI, true)}>Module</div>
          {ROLES.map(r => (
            <div key={r.key} style={cellHeader(C, fontUI)} title={t(`roles.${r.key}`)}>
              {r.short}
            </div>
          ))}

          {/* Lignes : module + 8 dots */}
          {MODULES.map((m, rowIdx) => (
            <Fragment key={m.key}>
              <div style={cellModule(C, fontUI, rowIdx === MODULES.length - 1)}>
                {t(`nav.${m.key}`)}
              </div>
              {m.access.map((state, colIdx) => (
                <div key={colIdx} style={cellDot(C, rowIdx === MODULES.length - 1)}>
                  <div style={dotStyle(state)} aria-label={
                    state === 'F' ? t('login.team_legend_full')
                    : state === 'R' ? t('login.team_legend_read')
                    : t('login.team_legend_none')
                  } />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helpers de styles pour la matrice (réduit la duplication)
const cellHeader = (C, fontUI, first) => ({
  fontFamily: fontUI, fontSize: 10.5, fontWeight: 700,
  color: C.muted, letterSpacing: '0.07em', textTransform: 'uppercase',
  padding: '0 6px 12px',
  textAlign: first ? 'left' : 'center',
  borderBottom: `1px solid ${C.border}`,
});
const cellModule = (C, fontUI, last) => ({
  fontFamily: fontUI, fontSize: 13, fontWeight: 600,
  color: C.text, padding: '12px 6px',
  borderBottom: last ? 'none' : `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
});
const cellDot = (C, last) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '12px 6px',
  borderBottom: last ? 'none' : `1px solid ${C.border}`,
});

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const { chargerEntreprises } = useEntreprise();
  const { dark, toggle } = useTheme();
  const C = getC(dark);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nom: '', email: '', mot_de_passe: '',
    entreprise: '', pays: "Côte d'Ivoire"
  });

  // Palier choisi par le visiteur sur /tarifs avant d'arriver ici.
  const PALIERS_VALIDES = ['decouverte', 'starter', 'pro', 'cabinet'];
  const planParametre = searchParams.get('plan');
  const [planChoisi, setPlanChoisi] = useState(
    PALIERS_VALIDES.includes(planParametre) ? planParametre : null
  );

  useEffect(() => {
    if (planChoisi) {
      setMode('register');
      const id = setTimeout(() => {
        document.getElementById('cw-auth-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(id);
    }
  }, [planChoisi]);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('cw_entreprise_id');
      await api.post('/auth/demo');
      await login('demo@comptawest.ci', 'demo1234');
      await chargerEntreprises();
      toast.success(t('login.success_demo'));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('login.error_demo'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.mot_de_passe);
      } else {
        if (form.mot_de_passe.length < 8) {
          toast.error(t('login.error_password_short'));
          return;
        }
        await register(form);
      }
      await chargerEntreprises();

      let palierAppliqueAvecSucces = false;
      if (mode === 'register' && planChoisi && planChoisi !== 'decouverte') {
        try {
          await api.put('/abonnement', { palier: planChoisi, periodicite: 'mensuel' });
          palierAppliqueAvecSucces = true;
        } catch (errPlan) {
          console.warn('[login] application palier échouée:', errPlan.message);
        }
      }

      if (mode === 'register') {
        ouvrirCelebrationModal({
          palier: palierAppliqueAvecSucces ? planChoisi : 'decouverte',
          isNewSignup: true,
        });
      } else {
        toast.success(t('login.success_login'));
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('login.error_login'));
    } finally {
      setLoading(false);
    }
  };

  // Familles typo Cabinet Grotesk (display) + Satoshi (UI) + JetBrains Mono
  // (chiffres et URL). Importées depuis Fontshare en <link> dans le <style>.
  // Cabinet Grotesk remplace Inter (interdit par le skill).
  const fontDisplay = '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif';
  const fontUI      = '"Satoshi", "Cabinet Grotesk", system-ui, sans-serif';
  const fontMono    = '"JetBrains Mono", ui-monospace, "SF Mono", monospace';

  // Catalogue des 6 documents générés par ApeX (alignés sur le back :
  // rapportsController.buildFactureDoc / buildBilanDoc, paieController
  // bulletin, immobilisationsController plan d'amortissement,
  // comptabiliteController.exportFEC qui produit en réalité un
  // Grand-Livre OHADA — voir commentaire dans le controller).
  //
  // L'attribut `image` pointe vers un fichier optionnel posé dans
  // `frontend/public/documents/`. Si l'image existe, elle remplace le
  // mockup synthétique ; sinon on retombe automatiquement sur le
  // mockup JSX (fallback géré par onError dans DocCard).
  // Format conseillé : PNG / JPG, ratio portrait ≈ 290/440 (par ex.
  // 580 × 880 px pour le rendu rétina).
  const APEX_DOCS = [
    { key: 'facture',       label: t('login.doc_facture'),       icon: ShieldCheck,  headline: 'FACTURE N° F-2026-0042',      image: '/documents/facture.png'       },
    { key: 'devis',         label: t('login.doc_devis'),         icon: FileText,     headline: 'DEVIS N° D-2026-0017',        image: '/documents/devis.png'         },
    { key: 'bulletin',      label: t('login.doc_bulletin'),      icon: Briefcase,    headline: 'BULLETIN DE PAIE · MAI 2026', image: '/documents/bulletin.png'      },
    { key: 'bilan',         label: t('login.doc_bilan'),         icon: BookMarked,   headline: 'BILAN AU 31/12/2025',         image: '/documents/bilan.png'         },
    { key: 'amortissement', label: t('login.doc_amortissement'), icon: TrendingDown, headline: 'PLAN D\'AMORTISSEMENT',       image: '/documents/amortissement.png' },
    { key: 'grandlivre',    label: t('login.doc_grandlivre'),    icon: Database,     headline: 'GRAND-LIVRE · EXERCICE 2025', image: '/documents/grandlivre.png'    },
  ];

  return (
    <div style={{
      minHeight: '100dvh',                         // dvh : pas h-screen (bug iOS)
      background: C.bg, color: C.text,
      transition: 'background 0.2s',
      display: 'flex', flexDirection: 'column',
      fontFamily: fontUI,
      overflowX: 'hidden',
    }}>
      {/* Imports CDN : police Cabinet Grotesk + Satoshi + JetBrains Mono */}
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&f[]=satoshi@400,500,700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        body { background: ${C.bg}; }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────
          NAV — pill flottante asymétrique (logo gauche, actions droite)
          Pas de menu centré : décalé pour casser la symétrie.
          ───────────────────────────────────────────────────────────── */}
      <div className="cw-nav" style={{
        position: 'fixed', top: 18, left: 0, right: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 28px', pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          padding: '10px 18px', borderRadius: 100,
          background: dark ? 'rgba(14,17,22,0.7)' : 'rgba(247,248,244,0.78)',
          backdropFilter: 'blur(14px)',
          border: `1px solid ${C.border}`,
          boxShadow: `inset 0 1px 0 ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)'}`,
          display: 'flex', alignItems: 'center',
        }}>
          <LogoApex
            height={44}
            textColor={C.text}
            textSize={20}
            gap={11}
            fallback={(
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: C.accent, color: C.accentInk,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 21, fontWeight: 800,
              }}>₣</div>
            )}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <div style={{
            padding: '6px 8px', borderRadius: 100,
            background: dark ? 'rgba(14,17,22,0.7)' : 'rgba(247,248,244,0.78)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center',
          }}>
            <LanguageSwitcher C={C} dark={dark} />
          </div>
          <button onClick={toggle} aria-label={dark ? t('parametres.theme_light') : t('parametres.theme_dark')}
            style={{
              padding: '8px 12px', borderRadius: 100,
              background: dark ? 'rgba(14,17,22,0.7)' : 'rgba(247,248,244,0.78)',
              backdropFilter: 'blur(14px)',
              border: `1px solid ${C.border}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, color: C.sub,
              fontFamily: fontUI,
            }}>
            {dark ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          HERO — asymétrie : colonne texte large à gauche, décalage en
          padding, mockup à droite légèrement tilté, énorme espace
          négatif sous l'accroche. Pas de centrage, pas de gradient
          texte, accent unique.
          ───────────────────────────────────────────────────────────── */}
      <section className="cw-hero" style={{
        position: 'relative',
        padding: '160px clamp(28px, 6vw, 96px) 120px',
        background: C.bg,
      }}>
        {/* Diffusion subtile (pas de halo néon) : tache organique très
            faiblement teintée de l'accent, fortement floutée. */}
        <div aria-hidden style={{
          position: 'absolute', top: '12%', right: '-8%',
          width: 560, height: 560, borderRadius: '50%',
          background: dark
            ? `radial-gradient(circle, ${C.accent}14, transparent 70%)`
            : `radial-gradient(circle, ${C.accent}10, transparent 70%)`,
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />

        <div className="cw-hero-grid" style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '1.35fr 0.95fr',     // asymétrie (pas 1:1)
          gap: 72, alignItems: 'center',
          maxWidth: 1320, margin: '0 auto',
        }}>
          {/* COLONNE GAUCHE — accroche typographique */}
          <div style={{ paddingRight: 'clamp(0px, 2vw, 32px)' }}>
            {/* Badge sobre — bordure pleine, pas de glow */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '8px 14px 8px 10px', borderRadius: 100,
              background: 'transparent',
              border: `1px solid ${C.borderStrong}`,
              fontSize: 12.5, fontWeight: 600, color: C.sub,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              marginBottom: 28, fontFamily: fontUI,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: C.accent,
              }} />
              {t('login.new_badge')}
            </div>

            {/* H1 : Cabinet Grotesk, contraste par poids et couleur,
                PAS de gradient text-fill, max 2-3 lignes, large
                container, hiérarchie via couleur accent sur le mot
                fort uniquement. */}
            <h1 className="cw-headline" style={{
              fontFamily: fontDisplay,
              fontSize: 'clamp(2.4rem, 5.2vw, 4.6rem)',
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.035em',
              color: C.text,
              margin: '0 0 28px 0',
              maxWidth: '14ch',
            }}>
              {t('login.hero_title_line1')}{' '}
              <span style={{ color: C.accent, fontWeight: 800 }}>
                {t('login.hero_title_highlight')}
              </span>{' '}
              <span style={{ color: C.muted, fontWeight: 500 }}>
                {t('login.hero_title_line2')}
              </span>
            </h1>

            <p style={{
              fontSize: 18, color: C.sub, lineHeight: 1.6,
              margin: '0 0 36px 0', maxWidth: '52ch',
            }}>
              {t('login.hero_subtitle')}
            </p>

            {/* Bullets — typographie sobre, pas d'icônes carrées colorées */}
            <ul style={{
              listStyle: 'none', padding: 0, margin: '0 0 40px 0',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {[t('login.hero_bullet_1'), t('login.hero_bullet_2'), t('login.hero_bullet_3')].map((b, i) => (
                <li key={i} style={{
                  display: 'flex', alignItems: 'baseline', gap: 12,
                  fontSize: 15.5, color: C.sub, lineHeight: 1.55,
                }}>
                  <span style={{
                    width: 22, fontFamily: fontMono, fontSize: 12.5,
                    color: C.accent, fontWeight: 600,
                  }}>0{i + 1}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* CTA — contraste impeccable, pas de glow */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 36 }}>
              <button onClick={handleDemoLogin} disabled={loading}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '16px 28px', borderRadius: 12, border: 'none',
                  background: C.text, color: C.bg,
                  fontFamily: fontUI, fontSize: 15.5, fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                  letterSpacing: '-0.005em',
                }}>
                <Zap size={17} strokeWidth={2} />
                {loading ? t('login.demo_connecting') : t('login.cta_primary')}
                <ArrowRight size={17} strokeWidth={2} />
              </button>
              <button onClick={() => navigate('/tarifs')}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderStrong; e.currentTarget.style.color = C.text; }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 9,
                  padding: '15px 26px', borderRadius: 12,
                  background: 'transparent',
                  border: `1px solid ${C.borderStrong}`,
                  color: C.text, fontFamily: fontUI, fontSize: 15.5, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'color 0.2s, border-color 0.2s',
                }}>
                {t('login.cta_secondary')} <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Réassurance — petites mentions, séparées par un trait fin */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 14,
              fontSize: 13, color: C.muted, fontFamily: fontUI,
              borderTop: `1px solid ${C.border}`, paddingTop: 18,
            }}>
              {[
                t('login.trust_no_cc'),
                t('login.trust_free_demo'),
                t('login.trust_syscohada'),
              ].map((txt, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <CheckCircle2 size={15} strokeWidth={1.8} color={C.accent} />
                  {txt}
                </span>
              ))}
            </div>
          </div>

          {/* COLONNE DROITE — Dôme rotatif des documents générés par
              ApeX. 6 livrables (facture, devis, bulletin, bilan,
              plan d'amortissement, FEC) défilent sur un arc 3D ; le
              SKILL liste le Dome Gallery comme pattern recommandé. */}
          <div className="cw-mockup-wrapper" style={{ position: 'relative' }}>
            <DocCarousel
              docs={APEX_DOCS}
              C={C}
              dark={dark}
              fontDisplay={fontDisplay}
              fontMono={fontMono}
              fontUI={fontUI}
            />

            {/* Légende textuelle sobre, asymétrique sous le dôme */}
            <div style={{
              marginTop: 32, paddingTop: 20,
              borderTop: `1px solid ${C.border}`,
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14,
              alignItems: 'flex-start',
            }}>
              <div style={{
                fontFamily: fontMono, fontSize: 12.5,
                color: C.accent, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                whiteSpace: 'nowrap', paddingTop: 1,
              }}>
                / 06 · livrables
              </div>
              <div>
                <div style={{
                  fontFamily: fontDisplay, fontSize: 17, fontWeight: 700,
                  color: C.text, marginBottom: 6, letterSpacing: '-0.01em',
                }}>
                  {t('login.doc_caption_label')}
                </div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.55 }}>
                  {t('login.doc_caption_help')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats sous le hero — chiffres mono, asymétriques (4 colonnes
            de largeurs inégales pour casser le pattern 4-en-grille). */}
        <div className="cw-stats" style={{
          position: 'relative', marginTop: 112,
          display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr', gap: 32,
          maxWidth: 1320, marginLeft: 'auto', marginRight: 'auto',
          paddingTop: 32, borderTop: `1px solid ${C.border}`,
        }}>
          {[
            { v: '30+',  l: t('login.stat_features')     },
            { v: '10',   l: t('login.stat_roles')        },
            { v: '100%', l: t('login.stat_syscohada')    },
            { v: '3',    l: t('login.stat_mobile_money') },
          ].map((s, i) => (
            <div key={i}>
              <div style={{
                fontFamily: fontMono,
                fontSize: 38, fontWeight: 500,
                color: C.text, letterSpacing: '-0.04em',
                lineHeight: 1,
              }}>
                {s.v}
              </div>
              <div style={{ fontSize: 13.5, color: C.muted, marginTop: 8, fontFamily: fontUI }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PARTENAIRES — marquee asymétrique, intro à gauche
          ───────────────────────────────────────────────────────────── */}
      <section className="cw-section" style={{
        padding: '40px clamp(28px, 6vw, 96px)',
        background: dark ? '#0B0D11' : '#F1F2EC',
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}>
        <div style={{
          maxWidth: 1320, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'minmax(0, 0.7fr) minmax(0, 2fr)',
          gap: 32, alignItems: 'center',
        }} className="cw-partners-grid">
          <div style={{
            fontSize: 12.5, color: C.muted, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: fontUI,
          }}>
            {t('login.partners_intro')}
          </div>
          <div className="cw-marquee" style={{
            display: 'flex', alignItems: 'center', gap: 44,
            overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
          }}>
            <div className="cw-marquee-track" style={{
              display: 'flex', alignItems: 'center', gap: 44,
              opacity: 0.85, flexShrink: 0,
            }}>
              {[0, 1].map((dup) => (
                <div key={dup} style={{ display: 'flex', alignItems: 'center', gap: 44, flexShrink: 0 }}>
                  <LogoFournisseur fournisseur="wave"         size={42} radius={10} />
                  <LogoFournisseur fournisseur="orange_money" size={42} radius={10} />
                  <LogoFournisseur fournisseur="mtn_momo"     size={42} radius={10} />
                  <div style={{ height: 42, display: 'flex', alignItems: 'center' }}>
                    <img
                      src="/logos/dgi.png"
                      alt="DGI Côte d'Ivoire"
                      style={{ height: 42, width: 'auto', maxWidth: 110, objectFit: 'contain', display: 'block' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{
                      display: 'none',
                      height: 42, borderRadius: 10,
                      background: dark ? C.surface : '#FFFFFF',
                      border: `1px solid ${C.border}`,
                      padding: '5px 12px 5px 6px',
                      alignItems: 'center', gap: 10,
                    }}>
                      <div style={{ display: 'flex', height: 24, width: 18, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ width: '33.33%', background: '#F77F00' }} />
                        <div style={{ width: '33.33%', background: '#FFFFFF' }} />
                        <div style={{ width: '33.33%', background: '#009E60' }} />
                      </div>
                      <div style={{ lineHeight: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.text, letterSpacing: '0.04em' }}>DGI</div>
                        <div style={{ fontSize: 7.5, color: C.muted, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>Côte d'Ivoire</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 42, display: 'flex', alignItems: 'center' }}>
                    <img
                      src="https://cdn.simpleicons.org/whatsapp/1FA855"
                      alt="WhatsApp"
                      style={{ height: 38, width: 38, display: 'block' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{
                      display: 'none',
                      width: 38, height: 38, borderRadius: 10,
                      background: '#1FA855', color: '#fff',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MessageCircle size={22} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          COMMENT ÇA MARCHE — timeline verticale asymétrique :
          rail gauche avec numéros mono géants, contenu à droite,
          larges marges blanches négatives. Plus de grille 3 colonnes.
          ───────────────────────────────────────────────────────────── */}
      <section className="cw-section" style={{
        padding: '128px clamp(28px, 6vw, 96px)',
        background: C.bg,
      }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.4fr)',
          gap: 'clamp(32px, 6vw, 96px)', alignItems: 'flex-start',
        }} className="cw-how-wrap">
          {/* Titre LEFT-aligned, asymétrique */}
          <div style={{ position: 'sticky', top: 100 }} className="cw-how-head">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 12.5, fontWeight: 700, color: C.accent,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18,
              fontFamily: fontUI,
            }}>
              <Target size={14} strokeWidth={2} />
              {t('login.how_title')}
            </div>
            <h2 style={{
              fontFamily: fontDisplay,
              fontSize: 'clamp(2rem, 3.6vw, 3rem)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: C.text,
              margin: '0 0 16px 0',
              lineHeight: 1.05,
            }}>
              {t('login.how_title')}
            </h2>
            <p style={{
              fontSize: 16, color: C.sub,
              lineHeight: 1.6, margin: 0, maxWidth: '34ch',
            }}>
              {t('login.how_subtitle')}
            </p>
          </div>

          {/* Étapes en colonne verticale, séparateurs fins (pas de cards) */}
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }} className="cw-how-list">
            {[
              { icon: UserPlus, key: 'step1', duration: t('login.how_step1_time') },
              { icon: Camera,   key: 'step2', duration: t('login.how_step2_time') },
              { icon: Send,     key: 'step3', duration: t('login.how_step3_time') },
            ].map(({ icon: Icon, key, duration }, i) => (
              <li key={key} style={{
                display: 'grid',
                gridTemplateColumns: '88px 1fr',
                gap: 28,
                padding: '32px 0',
                borderTop: i === 0 ? `1px solid ${C.border}` : 'none',
                borderBottom: `1px solid ${C.border}`,
                alignItems: 'flex-start',
              }}>
                <div style={{
                  fontFamily: fontMono,
                  fontSize: 56, fontWeight: 400,
                  color: C.muted, letterSpacing: '-0.04em',
                  lineHeight: 0.9,
                }}>
                  0{i + 1}
                </div>
                <div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 9,
                    marginBottom: 12,
                  }}>
                    <Icon size={20} strokeWidth={1.8} color={C.accent} />
                    <span style={{
                      fontSize: 12, color: C.muted, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      fontFamily: fontUI,
                    }}>{duration}</span>
                  </div>
                  <h3 style={{
                    fontFamily: fontDisplay,
                    fontSize: 22, fontWeight: 700,
                    color: C.text, margin: '0 0 10px 0',
                    letterSpacing: '-0.015em', lineHeight: 1.2,
                  }}>
                    {t(`login.how_${key}_title`)}
                  </h3>
                  <p style={{
                    fontSize: 15.5, color: C.sub, lineHeight: 1.6,
                    margin: 0, maxWidth: '52ch',
                  }}>
                    {t(`login.how_${key}_desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          DIFFÉRENCIATEURS — zig-zag 2 colonnes alternées (interdiction
          stricte du « 3 cartes égales »). Texte / visuel inversés à
          chaque ligne pour rompre le rythme.
          ───────────────────────────────────────────────────────────── */}
      <section className="cw-section" style={{
        padding: '128px clamp(28px, 6vw, 96px)',
        background: dark ? '#0B0D11' : '#F1F2EC',
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          {/* En-tête section LEFT-aligned, pas centré */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 56, alignItems: 'flex-end', marginBottom: 88,
          }} className="cw-diff-head">
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 12.5, fontWeight: 700, color: C.accent,
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14,
                fontFamily: fontUI,
              }}>
                <Sparkles size={14} strokeWidth={1.8} />
                {t('login.differentiators_label')}
              </div>
              <h2 style={{
                fontFamily: fontDisplay,
                fontSize: 'clamp(2.2rem, 4vw, 3.4rem)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: C.text, margin: 0, lineHeight: 1.02,
                maxWidth: '14ch',
              }}>
                {t('login.diff_section_title')}
              </h2>
            </div>
            <p style={{
              fontSize: 16, color: C.sub, lineHeight: 1.6,
              margin: 0, maxWidth: '46ch', justifySelf: 'end',
            }}>
              {t('login.diff_section_subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }} className="cw-diff-list">
            {DIFFERENCIATEURS.map(({ icon: Icon, key }, i) => {
              const reverse = i % 2 === 1;          // zig-zag
              return (
                <div key={key} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'clamp(32px, 6vw, 88px)',
                  alignItems: 'center',
                  padding: '64px 0',
                  borderTop: i === 0 ? `1px solid ${C.borderStrong}` : 'none',
                  borderBottom: `1px solid ${C.borderStrong}`,
                  direction: reverse ? 'rtl' : 'ltr',
                }} className="cw-diff-row">
                  {/* Bloc texte (le RTL le repositionne automatiquement) */}
                  <div style={{ direction: 'ltr' }}>
                    {/* Numéro + icône inline en kicker */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      marginBottom: 20, padding: '6px 12px 6px 6px',
                      borderRadius: 100, border: `1px solid ${C.border}`,
                      background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
                    }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: C.accent, color: C.accentInk,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={14} strokeWidth={2} />
                      </span>
                      <span style={{
                        fontFamily: fontMono, fontSize: 12.5, color: C.muted,
                        letterSpacing: '0.1em',
                      }}>
                        / {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <h3 style={{
                      fontFamily: fontDisplay,
                      fontSize: 'clamp(1.7rem, 2.8vw, 2.4rem)',
                      fontWeight: 700,
                      color: C.text,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1,
                      margin: '0 0 18px 0',
                      maxWidth: '20ch',
                    }}>
                      {t(`login.differentiators.${key}.title`)}
                    </h3>
                    <p style={{
                      fontSize: 16, color: C.sub, lineHeight: 1.65,
                      margin: '0 0 28px 0', maxWidth: '48ch',
                    }}>
                      {t(`login.differentiators.${key}.desc`)}
                    </p>

                    {/* Stat clé chiffrée — typographie display + mono */}
                    <div style={{
                      display: 'flex', alignItems: 'baseline', gap: 14,
                      paddingTop: 20, borderTop: `1px solid ${C.border}`,
                      maxWidth: '44ch',
                    }}>
                      <div style={{
                        fontFamily: fontDisplay,
                        fontSize: 'clamp(2rem, 2.8vw, 2.6rem)',
                        fontWeight: 700, color: C.accent,
                        letterSpacing: '-0.035em', lineHeight: 1,
                        whiteSpace: 'nowrap',
                      }}>
                        {t(`login.differentiators.${key}.metric_value`)}
                      </div>
                      <div style={{
                        fontSize: 13.5, color: C.muted, lineHeight: 1.45,
                        fontFamily: fontUI,
                      }}>
                        {t(`login.differentiators.${key}.metric_label`)}
                      </div>
                    </div>

                    {/* Citation terrain — italique, ressemble à un quote-pull */}
                    <div style={{
                      marginTop: 20, paddingLeft: 14,
                      borderLeft: `2px solid ${C.accent}`,
                      fontSize: 15.5, color: C.sub,
                      fontStyle: 'italic', lineHeight: 1.55,
                      maxWidth: '44ch',
                    }}>
                      {t(`login.differentiators.${key}.quote`)}
                    </div>
                  </div>

                  {/* Visuel expressif : mini-mockup spécifique au différenciateur */}
                  <div style={{ direction: 'ltr' }}>
                    <DiffShowcase
                      kind={key}
                      C={C}
                      dark={dark}
                      fontMono={fontMono}
                      fontUI={fontUI}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          APERÇU TABLEAU DE BORD — split asymétrique 1:1.8, capture
          dans cadre navigateur très large, argumentaire condensé
          ───────────────────────────────────────────────────────────── */}
      <section className="cw-section" style={{
        padding: '128px clamp(28px, 6vw, 96px)',
        background: C.bg,
      }}>
        <div style={{
          maxWidth: 1320, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.6fr)',
          gap: 'clamp(40px, 6vw, 96px)', alignItems: 'center',
        }} className="cw-dashboard-grid">
          <div style={{ paddingTop: 8 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 12.5, fontWeight: 700, color: C.accent,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14,
              fontFamily: fontUI,
            }}>
              <BarChart3 size={14} strokeWidth={1.8} />
              {t('login.dashboard_label')}
            </div>
            <h2 style={{
              fontFamily: fontDisplay,
              fontSize: 'clamp(1.9rem, 3.2vw, 2.8rem)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: C.text, margin: '0 0 18px 0',
              lineHeight: 1.08,
            }}>
              {t('login.dashboard_title')}
            </h2>
            <p style={{ fontSize: 16, color: C.sub, lineHeight: 1.6, margin: '0 0 24px 0' }}>
              {t('login.dashboard_subtitle')}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3, 4].map(n => (
                <li key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{
                    marginTop: 6, width: 16, height: 1,
                    background: C.accent, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 15.5, color: C.sub, lineHeight: 1.55 }}>
                    {t(`login.dashboard_bullet_${n}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="cw-dashboard-frame-wrapper" style={{
            position: 'relative',
            transform: 'translateX(clamp(0px, 1.6vw, 24px))',  // offset asymétrique
          }}>
            <div style={{
              position: 'relative', zIndex: 1,
              background: dark ? C.surface : '#FFFFFF',
              borderRadius: 14, overflow: 'hidden',
              border: `1px solid ${C.border}`,
              boxShadow: dark
                ? '0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)'
                : '0 20px 60px -10px rgba(14,17,22,0.18), inset 0 1px 0 rgba(255,255,255,0.6)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: dark ? '#0B0D11' : '#F1F2EC',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#E0606E' }} />
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#E0A040' }} />
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: C.accent }} />
                </div>
                <div style={{
                  flex: 1, padding: '5px 12px', borderRadius: 6,
                  background: dark ? C.input : '#FFFFFF',
                  border: `1px solid ${C.border}`,
                  fontSize: 11, color: C.muted,
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>
                  <Lock size={10} strokeWidth={1.8} color={C.accent} />
                  <span style={{ fontFamily: fontMono }}>{t('login.dashboard_url')}</span>
                </div>
              </div>

              <div style={{ position: 'relative', background: dark ? '#0B0D11' : '#F7F8F4' }}>
                <img
                  src="/screenshots/dashboard.png"
                  alt={t('login.dashboard_image_alt')}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                  }}
                />
                <div style={{
                  display: 'none',
                  aspectRatio: '16 / 10',
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 12,
                  color: C.muted, fontSize: 13,
                  background: dark
                    ? 'repeating-linear-gradient(45deg, #0B0D11, #0B0D11 14px, #11141A 14px, #11141A 28px)'
                    : 'repeating-linear-gradient(45deg, #F7F8F4, #F7F8F4 14px, #F1F2EC 14px, #F1F2EC 28px)',
                }}>
                  <BarChart3 size={36} strokeWidth={1.5} color={C.accent} />
                  <div style={{ fontWeight: 700 }}>{t('login.dashboard_image_placeholder')}</div>
                  <div style={{ fontSize: 11, fontFamily: fontMono, color: C.muted }}>
                    frontend/public/screenshots/dashboard.png
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          ÉQUIPE & PERMISSIONS — matrice rôles × modules. Argumentaire
          à gauche, vraie matrice visuelle à droite (8 rôles × 7
          modules). Donne instantanément confiance : « ah, ils ont
          vraiment réfléchi à qui peut faire quoi ».
          ───────────────────────────────────────────────────────────── */}
      <section className="cw-section" style={{
        padding: '128px clamp(28px, 6vw, 96px)',
        background: dark ? '#0B0D11' : '#F1F2EC',
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          {/* En-tête asymétrique 2 colonnes (titre / sous-titre droite) */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 56, alignItems: 'flex-end', marginBottom: 72,
          }} className="cw-team-head">
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 12.5, fontWeight: 700, color: C.accent,
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14,
                fontFamily: fontUI,
              }}>
                <ShieldCheck size={14} strokeWidth={1.8} />
                {t('login.team_label')}
              </div>
              <h2 style={{
                fontFamily: fontDisplay,
                fontSize: 'clamp(2rem, 3.6vw, 3rem)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: C.text, margin: 0, lineHeight: 1.05,
                maxWidth: '18ch',
              }}>
                {t('login.team_title')}
              </h2>
            </div>
            <p style={{
              fontSize: 16, color: C.sub, lineHeight: 1.6,
              margin: 0, maxWidth: '52ch', justifySelf: 'end',
            }}>
              {t('login.team_subtitle')}
            </p>
          </div>

          {/* Split asymétrique : argumentaire à gauche, matrice à droite */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.5fr)',
            gap: 'clamp(32px, 5vw, 72px)', alignItems: 'flex-start',
          }} className="cw-team-grid">
            {/* Colonne argumentaire — 4 bullets concrets */}
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'flex', flexDirection: 'column', gap: 24,
            }}>
              {[1, 2, 3, 4].map(n => (
                <li key={n} style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr',
                  gap: 16, alignItems: 'flex-start',
                  paddingBottom: 22, borderBottom: n < 4 ? `1px solid ${C.border}` : 'none',
                }}>
                  <span style={{
                    fontFamily: fontMono, fontSize: 13,
                    color: C.accent, fontWeight: 600,
                    letterSpacing: '0.06em', paddingTop: 4,
                  }}>
                    0{n}
                  </span>
                  <span style={{
                    fontSize: 14.5, color: C.sub, lineHeight: 1.55,
                  }}>
                    {t(`login.team_bullet_${n}`)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Colonne visuelle — vraie matrice rôles × modules */}
            <PermissionsMatrix C={C} dark={dark} t={t}
              fontDisplay={fontDisplay} fontMono={fontMono} fontUI={fontUI} />
          </div>

          {/* Pied : 3 stats clés sur la dimension équipe/contrôle */}
          <div style={{
            marginTop: 64, paddingTop: 36,
            borderTop: `1px solid ${C.border}`,
            display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 1fr', gap: 32,
          }} className="cw-team-stats">
            {[
              { v: t('login.team_stat_roles_value'),   l: t('login.team_stat_roles_label')   },
              { v: t('login.team_stat_actions_value'), l: t('login.team_stat_actions_label') },
              { v: t('login.team_stat_audit_value'),   l: t('login.team_stat_audit_label')   },
            ].map((s, i) => (
              <div key={i}>
                <div style={{
                  fontFamily: fontDisplay,
                  fontSize: 'clamp(2rem, 3vw, 2.6rem)',
                  fontWeight: 700, color: C.accent,
                  letterSpacing: '-0.035em', lineHeight: 1, marginBottom: 8,
                }}>
                  {s.v}
                </div>
                <div style={{
                  fontSize: 13.5, color: C.muted, lineHeight: 1.4,
                  fontFamily: fontUI,
                }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          FONCTIONNALITÉS — bento asymétrique (grid-flow-dense, lignes
          de 1 carte large + 3 normales + 2 + 2 — pas de 4×1 régulier)
          ───────────────────────────────────────────────────────────── */}
      <section className="cw-section" style={{
        padding: '128px clamp(28px, 6vw, 96px) 88px',
        background: C.bg,
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.1fr 1fr',
            gap: 48, alignItems: 'flex-end', marginBottom: 56,
          }} className="cw-feats-head">
            <h2 style={{
              fontFamily: fontDisplay,
              fontSize: 'clamp(1.9rem, 3.2vw, 2.6rem)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: C.text, margin: 0, lineHeight: 1.05,
              maxWidth: '18ch',
            }}>
              {t('login.features_section_title')}
            </h2>
            <p style={{
              fontSize: 15.5, color: C.sub, lineHeight: 1.6,
              margin: 0, maxWidth: '52ch',
            }}>
              {t('login.features_section_subtitle')}
            </p>
          </div>

          <FeatScroller features={FEATURES} t={t} C={C} dark={dark}
            fontDisplay={fontDisplay} fontMono={fontMono} fontUI={fontUI} />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          TARIFICATION — 4 paliers en grille de largeurs inégales
          (1.1fr 0.9fr 1.2fr 0.9fr) pour casser la symétrie « 4 cartes »
          ───────────────────────────────────────────────────────────── */}
      <section className="cw-section" style={{
        padding: '128px clamp(28px, 6vw, 96px)',
        background: dark ? '#0B0D11' : '#F1F2EC',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 48, alignItems: 'flex-end', marginBottom: 72,
          }} className="cw-pricing-head">
            <h2 style={{
              fontFamily: fontDisplay,
              fontSize: 'clamp(2rem, 3.4vw, 2.8rem)',
              fontWeight: 700, letterSpacing: '-0.025em',
              color: C.text, margin: 0, lineHeight: 1.05,
              maxWidth: '16ch',
            }}>
              {t('login.pricing_title')}
            </h2>
            <p style={{
              fontSize: 16, color: C.sub, lineHeight: 1.6,
              margin: 0, maxWidth: '46ch', justifySelf: 'end',
            }}>
              {t('login.pricing_subtitle')}
            </p>
          </div>

          <div className="cw-pricing-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 0.95fr 1.15fr 0.95fr',
            gap: 16, alignItems: 'stretch',
          }}>
            {[
              { code: 'decouverte', prix: 0,     highlight: false },
              { code: 'starter',    prix: 9000,  highlight: false },
              { code: 'pro',        prix: 25000, highlight: true  },
              { code: 'cabinet',    prix: 60000, highlight: false },
            ].map(({ code, prix, highlight }) => (
              <div key={code} style={{
                background: highlight
                  ? (dark ? C.surface : '#FFFFFF')
                  : 'transparent',
                border: highlight
                  ? `1px solid ${C.accent}`
                  : `1px solid ${C.border}`,
                borderRadius: 16, padding: '28px 22px',
                position: 'relative',
                boxShadow: highlight
                  ? (dark
                      ? `inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.30)`
                      : `inset 0 1px 0 rgba(255,255,255,0.7), 0 6px 18px rgba(14,17,22,0.06)`)
                  : 'none',
                display: 'flex', flexDirection: 'column',
              }}>
                {highlight && (
                  <div style={{
                    position: 'absolute', top: -1, right: -1,
                    padding: '5px 11px',
                    background: C.accent, color: C.accentInk,
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                    whiteSpace: 'nowrap', borderRadius: '0 16px 0 12px',
                    fontFamily: fontUI,
                  }}>
                    {t('tarifs.palier_pro_badge')}
                  </div>
                )}

                <div style={{
                  fontFamily: fontMono,
                  fontSize: 12, fontWeight: 500, color: highlight ? C.accent : C.muted,
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
                }}>
                  / {t(`tarifs.palier_${code}`)}
                </div>
                <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 24, lineHeight: 1.5, minHeight: 40 }}>
                  {t(`tarifs.palier_${code}_tagline`)}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 22 }}>
                  <span style={{
                    fontFamily: fontDisplay,
                    fontSize: 36, fontWeight: 700, color: C.text,
                    letterSpacing: '-0.035em', lineHeight: 1,
                  }}>
                    {prix === 0 ? '0' : prix.toLocaleString('fr-FR')}
                  </span>
                  <span style={{ fontSize: 13, color: C.muted, fontWeight: 600, fontFamily: fontUI }}>
                    {t('tarifs.currency_suffix')}
                  </span>
                  {prix > 0 && (
                    <span style={{ fontSize: 12.5, color: C.muted, marginLeft: 2 }}>
                      {t('tarifs.per_month')}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => navigate('/tarifs')}
                  style={{
                    marginTop: 'auto', padding: '12px 16px', borderRadius: 10,
                    border: highlight ? 'none' : `1px solid ${C.borderStrong}`,
                    background: highlight ? C.accent : 'transparent',
                    color: highlight ? C.accentInk : C.text,
                    fontFamily: fontUI, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (!highlight) e.currentTarget.style.borderColor = C.accent;
                  }}
                  onMouseLeave={e => {
                    if (!highlight) e.currentTarget.style.borderColor = C.borderStrong;
                  }}>
                  {t('tarifs.cta_choose')} <ArrowRight size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 36, paddingTop: 24,
            borderTop: `1px solid ${C.border}`,
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 24,
            alignItems: 'center',
          }} className="cw-pricing-foot">
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
              {t('login.pricing_note')}
            </div>
            <button onClick={() => navigate('/tarifs')} style={{
              padding: '13px 24px', borderRadius: 11,
              border: `1px solid ${C.borderStrong}`, background: 'transparent',
              color: C.text, fontFamily: fontUI, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              whiteSpace: 'nowrap',
              transition: 'border-color 0.2s, color 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderStrong; e.currentTarget.style.color = C.text; }}>
              {t('tarifs.faq_title')} & {t('tarifs.page_subtitle').split('.')[0]} <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          FORMULAIRE D'AUTHENTIFICATION — split asymétrique : argumentaire
          discret à gauche, formulaire à droite, ancré dans une carte
          unique (la seule justifiée par la hiérarchie d'élévation)
          ───────────────────────────────────────────────────────────── */}
      <section id="cw-auth-form" className="cw-section" style={{
        padding: '128px clamp(28px, 6vw, 96px)',
        background: C.bg,
      }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.85fr)',
          gap: 'clamp(40px, 6vw, 96px)', alignItems: 'center',
        }} className="cw-auth-wrap">
          <div className="cw-auth-side">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12.5, fontWeight: 700, color: C.accent,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18,
              fontFamily: fontUI,
            }}>
              <Zap size={14} strokeWidth={1.8} />
              {t('login.welcome')}
            </div>
            <h2 style={{
              fontFamily: fontDisplay,
              fontSize: 'clamp(2rem, 3.6vw, 3rem)',
              fontWeight: 700, letterSpacing: '-0.03em',
              color: C.text, margin: '0 0 20px 0',
              lineHeight: 1.05, maxWidth: '14ch',
            }}>
              {t('login.demo_title')}
            </h2>
            <p style={{
              fontSize: 16, color: C.sub, lineHeight: 1.6,
              margin: '0 0 28px 0', maxWidth: '44ch',
            }}>
              {t('login.demo_description')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {[
                t('login.register_advantages_1'),
                t('login.register_advantages_2'),
                t('login.register_advantages_3'),
                t('login.footer_secure'),
                t('login.footer_syscohada'),
                t('login.footer_dgi'),
              ].map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{
                    fontFamily: fontMono, fontSize: 12.5,
                    color: C.accent, fontWeight: 600,
                    width: 26, flexShrink: 0,
                  }}>
                    /{String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 15, color: C.sub, lineHeight: 1.55 }}>{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Carte formulaire — la seule carte avec ombre, car la
              hiérarchie d'élévation est ici fonctionnelle. */}
          <div style={{
            background: dark ? C.surface : '#FFFFFF',
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: '36px 32px',
            boxShadow: dark
              ? '0 20px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 16px 40px -8px rgba(14,17,22,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
          }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: fontMono, fontSize: 12, fontWeight: 500,
                color: C.muted, letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: 8,
              }}>
                / {mode === 'login' ? t('login.welcome_back') : t('login.welcome')}
              </div>
              <div style={{
                fontFamily: fontDisplay,
                fontSize: 28, fontWeight: 700, color: C.text,
                letterSpacing: '-0.025em', lineHeight: 1.1,
              }}>
                {mode === 'login' ? t('login.title_login') : t('login.title_register')}
              </div>
              <div style={{ fontSize: 14.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                {mode === 'login' ? t('login.subtitle_login') : t('login.subtitle_register')}
              </div>
            </div>

            <div style={{
              display: 'flex', background: C.input,
              borderRadius: 10, padding: 4, marginBottom: 22,
            }}>
              {['login', 'register'].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: fontUI, fontSize: 14, fontWeight: 600,
                  transition: 'background 0.2s, color 0.2s',
                  background: mode === m ? (dark ? C.card : '#FFFFFF') : 'transparent',
                  color: mode === m ? C.text : C.muted,
                  boxShadow: mode === m ? `inset 0 0 0 1px ${C.border}` : 'none',
                }}>
                  {m === 'login' ? t('login.tab_login') : t('login.tab_register')}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'register' && planChoisi && (
                <div style={{
                  background: 'transparent',
                  border: `1px solid ${C.accent}`, borderRadius: 11,
                  padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <CheckCircle2 size={17} color={C.accent} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 800 }}>{t(`tarifs.palier_${planChoisi}`)}</span>
                    {' — '}
                    <span style={{ color: C.muted }}>{t(`tarifs.palier_${planChoisi}_tagline`)}</span>
                  </div>
                  <button type="button" onClick={() => setPlanChoisi(null)}
                    title={t('common.cancel')}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: C.muted, padding: 4, display: 'flex',
                    }}>
                    <X size={14} strokeWidth={1.8} />
                  </button>
                </div>
              )}

              {mode === 'register' && (
                <>
                  <Input label={t('login.name')} value={form.nom} onChange={set('nom')} placeholder="Ouattara Koffi" required C={C} />
                  <Input label={t('login.company_name')} value={form.entreprise} onChange={set('entreprise')} placeholder="SARL MonEntreprise" C={C} />
                </>
              )}
              <Input label={t('login.email')} type="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.ci" required C={C} />
              <Input label={t('login.password')} type="password" value={form.mot_de_passe} onChange={set('mot_de_passe')} placeholder="••••••••" required C={C} />

              <button type="submit" disabled={loading} style={{
                marginTop: 10, padding: '14px 0', borderRadius: 12, border: 'none',
                background: loading ? C.input : C.text,
                color: loading ? C.muted : C.bg,
                fontFamily: fontUI, fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'translateY(1px) scale(0.99)'; }}
                onMouseUp={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}>
                {loading ? t('login.submitting') : (
                  <>
                    {mode === 'login' ? t('login.submit') : t('login.register_submit')}
                    <ArrowRight size={15} strokeWidth={2} />
                  </>
                )}
              </button>
            </form>

            {mode === 'login' && (
              <div style={{
                marginTop: 22, padding: '16px 18px',
                background: C.input, borderRadius: 12,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  fontFamily: fontMono, fontSize: 11.5, color: C.muted,
                  marginBottom: 8, fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <Target size={12} strokeWidth={1.8} color={C.accent} /> {t('login.demo_title')}
                </div>
                <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 14, lineHeight: 1.5 }}>
                  {t('login.demo_features')}
                </div>
                <button onClick={handleDemoLogin} disabled={loading} style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  border: `1px solid ${C.accent}`,
                  background: 'transparent',
                  color: C.accent, fontFamily: fontUI, fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = C.accentInk; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.accent; }}
                >
                  {loading ? t('login.demo_connecting') : t('login.demo_button')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pied de page minimal */}
        <div style={{
          maxWidth: 1180, margin: '88px auto 0',
          paddingTop: 32, borderTop: `1px solid ${C.border}`,
          display: 'flex', gap: 24, alignItems: 'center',
          fontSize: 12.5, color: C.muted, fontFamily: fontUI,
          flexWrap: 'wrap', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Lock size={13} strokeWidth={1.8} />
            {t('login.footer_secure')}
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{t('login.footer_syscohada')}</span>
            <span>{t('login.footer_dgi')}</span>
            <a href="/cgu" style={{ color: C.muted, textDecoration: 'none', borderBottom: `1px dotted ${C.border}` }}
               onMouseEnter={e => e.currentTarget.style.color = C.accent}
               onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              {t('login.footer_cgu')}
            </a>
            <a href="/confidentialite" style={{ color: C.muted, textDecoration: 'none', borderBottom: `1px dotted ${C.border}` }}
               onMouseEnter={e => e.currentTarget.style.color = C.accent}
               onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              {t('login.footer_confidentialite')}
            </a>
          </div>
        </div>
      </section>

      {/* Animations & responsive — micro-interactions sobres,
          asymétries qui s'effondrent proprement en mobile (variance
          forcée à 1 sur < 768px pour empêcher le scroll horizontal). */}
      <style>{`
        /* Coverflow : x1 = écart latéral des cartes voisines (260 px),
           x2 = écart des cartes lointaines (440 px). Distances
           calibrées pour des cartes 290 px : rotation 32° + scale 0.82
           sur abs=1 laisse ~14 px de marge avec la carte centrale,
           donc jamais de chevauchement. Le SCALE global réduit tout
           proportionnellement sur petit écran (cartes ET distances). */
        :root {
          --cw-dome-x1: 260px;
          --cw-dome-x2: 440px;
          --cw-dome-scale: 1;
        }

        @keyframes cw-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .cw-marquee-track { animation: cw-marquee 32s linear infinite; }
        .cw-marquee-track:hover { animation-play-state: paused; }

        @keyframes cw-doc-label {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* Carrousel des modules : scrollbar masquée mais scroll natif
           toujours fonctionnel (clavier, molette, drag tactile). */
        .cw-feats-scroll::-webkit-scrollbar { display: none; }
        .cw-feats-scroll { -ms-overflow-style: none; }

        /* Focus visible accessible sur les flèches */
        .cw-feat-arrow:focus-visible {
          outline: 2px solid ${C.accent};
          outline-offset: 4px;
        }

        /* — Micro-animations des mockups différenciateurs — */
        @keyframes cw-diff-pulse {
          0%, 100% { box-shadow: 0 0 0 0   rgba(15,138,110,0.55); }
          70%      { box-shadow: 0 0 0 6px rgba(15,138,110,0);    }
        }
        .cw-diff-pulse { animation: cw-diff-pulse 1.8s ease-in-out infinite; }

        @keyframes cw-diff-fade-in {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0);   }
        }
        .cw-diff-fade-in { animation: cw-diff-fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }

        /* OCR : remplissage progressif des champs, l'un après l'autre */
        @keyframes cw-diff-fill {
          0%   { opacity: 0; transform: translateX(8px); }
          100% { opacity: 1; transform: translateX(0);   }
        }
        .cw-diff-fill {
          opacity: 0;
          animation: cw-diff-fill 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* OCR : flèche centrale qui respire doucement */
        @keyframes cw-diff-arrow {
          0%, 100% { transform: scale(1);    }
          50%      { transform: scale(1.12); }
        }
        .cw-diff-arrow { animation: cw-diff-arrow 2.2s ease-in-out infinite; }

        /* FNE : ligne de scan qui balaie le QR code de haut en bas */
        @keyframes cw-diff-scan {
          0%   { transform: translateY(0);    opacity: 1; }
          70%  { transform: translateY(64px); opacity: 1; }
          100% { transform: translateY(64px); opacity: 0; }
        }
        .cw-diff-scan { animation: cw-diff-scan 2.4s ease-in-out infinite; }

        /* FNE : badge « Transmis DGI » qui pop en spring overshoot */
        @keyframes cw-diff-pop {
          0%   { opacity: 0; transform: scale(0.6); }
          60%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1);   }
        }
        .cw-diff-pop { animation: cw-diff-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 1.4s both; }

        .cw-dome-card:focus-visible {
          outline: 2px solid ${C.accent};
          outline-offset: 4px;
          border-radius: 16px;
        }

        @media (max-width: 1280px) {
          :root { --cw-dome-scale: 0.82; }
        }
        @media (max-width: 980px) {
          :root { --cw-dome-scale: 0.78; }
          .cw-hero { padding: 132px 24px 80px !important; }
          .cw-hero-grid { grid-template-columns: 1fr !important; gap: 64px !important; }
          .cw-mockup-wrapper { max-width: 620px; margin: 0 auto; }
          .cw-dome { height: 480px !important; }
          .cw-stats { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
          .cw-partners-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .cw-how-wrap { grid-template-columns: 1fr !important; gap: 40px !important; }
          .cw-how-head { position: static !important; }
          .cw-diff-head { grid-template-columns: 1fr !important; gap: 16px !important; }
          .cw-diff-head > p { justify-self: start !important; }
          .cw-diff-row { grid-template-columns: 1fr !important; direction: ltr !important; gap: 24px !important; padding: 40px 0 !important; }
          .cw-dashboard-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .cw-team-head { grid-template-columns: 1fr !important; gap: 16px !important; }
          .cw-team-head > p { justify-self: start !important; }
          .cw-team-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .cw-team-stats { grid-template-columns: 1fr !important; gap: 24px !important; }
          .cw-dashboard-frame-wrapper { transform: none !important; max-width: 620px; margin: 0 auto; }
          .cw-feats-head, .cw-pricing-head { grid-template-columns: 1fr !important; gap: 16px !important; }
          .cw-pricing-head > p { justify-self: start !important; }
          /* Le carrousel reste horizontal sur mobile (les cartes
             gardent leur largeur min/max, le scroll-snap continue
             à snapper carte par carte). Rien à overrider ici. */
          .cw-pricing-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .cw-pricing-foot { grid-template-columns: 1fr !important; }
          .cw-auth-wrap { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
        @media (max-width: 560px) {
          :root { --cw-dome-scale: 0.6; }
          .cw-nav { padding: 0 16px !important; top: 12px !important; }
          /* Mobile : on n'override pas non plus, le scroll horizontal
             reste la meilleure UX (cartes pleine largeur via 82vw). */
          .cw-pricing-grid { grid-template-columns: 1fr !important; }
          .cw-dome { height: 400px !important; }
        }
      `}</style>
    </div>
  );
}
