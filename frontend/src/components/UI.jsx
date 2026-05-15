/**
 * Composants UI partagés ComptaWest
 * Chaque composant lit le thème lui-même via useTheme()
 * → Ils se mettent à jour automatiquement en dark/light mode
 */
import { useTheme } from '../hooks/useTheme.jsx';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

// ─── Palette centralisée ──────────────────────────────────────────────────
export const getC = (dark) => dark ? {
  bg:         '#0B0F1A',
  card:       '#111827',
  cardAlt:    '#151E2D',
  border:     '#1E2D40',
  accent:     '#00D4AA',
  gold:       '#F5A623',
  red:        '#FF5C6B',
  blue:       '#4E8BF5',
  purple:     '#A855F7',
  text:       '#E8EDF5',
  muted:      '#6B7A99',
  sub:        '#9BAACC',
  input:      '#0D1525',
  hover:      '#1A2640',
  sidebar:    '#080E1A',
  tooltipBg:  '#1A2235',
  shadow:     'none',
} : {
  bg:         '#EEF2F7',
  card:       '#FFFFFF',
  cardAlt:    '#F8FAFD',
  border:     '#C8D8EA',
  accent:     '#007A63',
  gold:       '#A0660A',
  red:        '#C01833',
  blue:       '#1A52B0',
  purple:     '#5B21B6',
  text:       '#0A1628',
  muted:      '#526480',
  sub:        '#1E3A5F',
  input:      '#FFFFFF',
  hover:      '#E4EDF6',
  sidebar:    '#FFFFFF',
  tooltipBg:  '#1E293B',
  shadow:     '0 2px 12px rgba(10,22,40,0.08)',
};

// ─── Input ────────────────────────────────────────────────────────────────
export const Input = ({ label, value, onChange, placeholder, required, type = 'text', disabled }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 700, color: C.sub,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {label}{required && <span style={{ color: C.accent }}> *</span>}
      </label>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required} disabled={disabled}
        style={{
          background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
          padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
          fontFamily: 'inherit', transition: 'all 0.15s',
          opacity: disabled ? 0.5 : 1,
        }}
        onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}18`; }}
        onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
};

// ─── Select ───────────────────────────────────────────────────────────────
export const Select = ({ label, value, onChange, children, required }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{
          fontSize: 11, fontWeight: 700, color: C.sub,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {label}{required && <span style={{ color: C.accent }}> *</span>}
        </label>
      )}
      <select value={value} onChange={onChange} style={{
        background: C.input, border: `1.5px solid ${C.border}`, borderRadius: 9,
        padding: '10px 13px', color: C.text, fontSize: 13, outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23${dark ? '6B7A99' : '526480'}' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: 36,
      }}
        onFocus={e => e.target.style.borderColor = C.accent}
        onBlur={e => e.target.style.borderColor = C.border}
      >
        {children}
      </select>
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────
export const Modal = ({ title, onClose, children, width = 540 }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: dark ? 'rgba(0,0,0,0.8)' : 'rgba(10,22,40,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
        width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto',
        boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.6)' : '0 20px 60px rgba(10,22,40,0.18)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '22px 26px 18px', borderBottom: `1px solid ${C.border}`,
          background: dark ? 'transparent' : C.cardAlt,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{
            background: C.hover, border: `1px solid ${C.border}`, borderRadius: 8,
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.muted, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.red + '20'; e.currentTarget.style.color = C.red; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.muted; }}
          ><X size={16} /></button>
        </div>
        <div style={{ padding: '24px 26px' }}>{children}</div>
      </div>
    </div>
  );
};

// ─── KpiCard ──────────────────────────────────────────────────────────────
export const KpiCard = ({ label, value, sub, icon: Icon, color, alert }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  return (
    <div style={{
      background: C.card,
      border: `1.5px solid ${alert ? color + '70' : C.border}`,
      borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden',
      boxShadow: dark ? 'none' : C.shadow,
      transition: 'all 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${color}30, transparent 70%)`,
        borderRadius: '0 16px 0 80px',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <div style={{ padding: '7px', borderRadius: 10, background: `${color}18`, flexShrink: 0 }}>
          <Icon size={16} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'monospace', letterSpacing: '-0.02em', marginBottom: 6 }}>
        {typeof value === 'number' ? new Intl.NumberFormat('fr-FR').format(Math.round(value)) : value}
        {typeof value === 'number' && <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 5 }}>FCFA</span>}
      </div>
      <div style={{ fontSize: 12, color: alert ? color : C.muted, fontWeight: alert ? 600 : 400 }}>{sub}</div>
    </div>
  );
};

// ─── Metric (Rapports) ───────────────────────────────────────────────────
export const Metric = ({ label, value, sub, icon: Icon, color }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '18px 20px', position: 'relative', overflow: 'hidden',
      boxShadow: dark ? 'none' : C.shadow, transition: 'all 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 55, height: 55,
        background: `radial-gradient(circle at top right, ${color}25, transparent 70%)`,
        borderRadius: '0 14px 0 55px',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
        <Icon size={16} color={color} />
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{sub}</div>}
    </div>
  );
};

// ─── CustomTooltip (recharts) ─────────────────────────────────────────────
export const CustomTooltip = ({ active, payload, label }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.tooltipBg, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    }}>
      <div style={{ color: C.sub, marginBottom: 7, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: 14, justifyContent: 'space-between', marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
            {new Intl.NumberFormat('fr-FR').format(Math.round(p.value))} FCFA
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Bouton primaire ──────────────────────────────────────────────────────
export const BtnPrimary = ({ children, onClick, disabled, color, type = 'button', style = {} }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  const bg = color || C.accent;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: '11px 22px', borderRadius: 10, border: 'none',
      background: disabled ? C.border : bg,
      color: disabled ? C.muted : (dark ? '#000' : '#fff'),
      fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s', ...style,
    }}>
      {children}
    </button>
  );
};

// ─── Bouton secondaire ────────────────────────────────────────────────────
export const BtnSecondary = ({ children, onClick, type = 'button', style = {} }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  return (
    <button type={type} onClick={onClick} style={{
      padding: '11px 22px', borderRadius: 10, border: `1.5px solid ${C.border}`,
      background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.15s', ...style,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.sub; e.currentTarget.style.color = C.text; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
    >
      {children}
    </button>
  );
};

// ─── Badge statut ─────────────────────────────────────────────────────────
export const StatutBadge = ({ statut }) => {
  const { t, i18n } = useTranslation();
  // Couleurs par statut ; le libellé est résolu via t('statut.<key>').
  const COULEURS = {
    payee:      { bg: '#00D4AA20', color: '#00A882', border: '#00D4AA40' },
    en_attente: { bg: '#F5A62320', color: '#A0660A', border: '#F5A62340' },
    retard:     { bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
    brouillon:  { bg: '#6B7A9920', color: '#6B7A99', border: '#6B7A9940' },
    envoyee:    { bg: '#4E8BF520', color: '#1A52B0', border: '#4E8BF540' },
    annulee:    { bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
    a_payer:    { bg: '#F5A62320', color: '#A0660A', border: '#F5A62340' },
    en_retard:  { bg: '#FF5C6B20', color: '#C01833', border: '#FF5C6B40' },
    exoneree:   { bg: '#4E8BF520', color: '#1A52B0', border: '#4E8BF540' },
  };
  const cfg = COULEURS[statut] || { bg: '#6B7A9920', color: '#6B7A99', border: '#6B7A9940' };
  // Si la clé n'existe pas dans le bundle de traduction, on retombe sur le statut brut
  const key = `statut.${statut}`;
  const label = i18n.exists(key) ? t(key) : statut;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  );
};

// ─── Helper : évalue si une sortie est possible sur un compte ─────────────
// Renvoie { ok, bloquant, niveau: 'ok'|'avertissement'|'blocage', solde_apres, message }
export const evaluerSortie = (compte, montant) => {
  if (!compte) return { ok: true, bloquant: false, niveau: 'ok', solde_apres: null, message: '' };
  const m = parseFloat(montant) || 0;
  const solde = parseFloat(compte.solde_actuel) || 0;
  const soldeApres = Math.round((solde - m) * 100) / 100;
  const decAutorise = !!compte.decouvert_autorise;
  const decMax = parseFloat(compte.decouvert_max) || 0;
  const plancher = decAutorise ? -decMax : 0;

  if (m <= 0) return { ok: true, bloquant: false, niveau: 'ok', solde_apres: soldeApres, message: '' };

  if (soldeApres < plancher - 0.001) {
    // Dépassement : blocage
    const manque = Math.round((plancher - soldeApres) * 100) / 100;
    return {
      ok: false, bloquant: true, niveau: 'blocage', solde_apres: soldeApres,
      message: decAutorise && decMax > 0
        ? `Découvert autorisé (−${new Intl.NumberFormat('fr-FR').format(decMax)}) dépassé. Il manque ${new Intl.NumberFormat('fr-FR').format(manque)} ${compte.devise || 'FCFA'}.`
        : `Solde insuffisant : ${new Intl.NumberFormat('fr-FR').format(solde)} disponible, ${new Intl.NumberFormat('fr-FR').format(m)} demandé. Il manque ${new Intl.NumberFormat('fr-FR').format(manque)} ${compte.devise || 'FCFA'}.`,
    };
  }
  if (soldeApres < -0.001) {
    // Découvert autorisé mais le compte passe en négatif : avertissement
    return {
      ok: true, bloquant: false, niveau: 'avertissement', solde_apres: soldeApres,
      message: `Le compte passera à découvert : solde après opération ${new Intl.NumberFormat('fr-FR').format(soldeApres)} ${compte.devise || 'FCFA'}.`,
    };
  }
  return { ok: true, bloquant: false, niveau: 'ok', solde_apres: soldeApres, message: '' };
};

// ─── Bandeau d'alerte de solde ────────────────────────────────────────────
// Affiche le solde après opération et un message selon le niveau de risque.
export const AlerteSolde = ({ compte, montant }) => {
  const { dark } = useTheme();
  const C = getC(dark);
  if (!compte) return null;
  const ev = evaluerSortie(compte, montant);
  const m = parseFloat(montant) || 0;
  if (m <= 0) return null;

  const cfg = {
    ok:            { color: C.accent, bg: `${C.accent}12`, border: `${C.accent}40`, icon: CheckCircle,   titre: 'Solde suffisant' },
    avertissement: { color: C.gold,   bg: `${C.gold}15`,   border: `${C.gold}50`,   icon: AlertTriangle, titre: 'Compte à découvert' },
    blocage:       { color: C.red,    bg: `${C.red}15`,    border: `${C.red}50`,    icon: AlertCircle,   titre: 'Opération impossible' },
  }[ev.niveau];
  const Icon = cfg.icon;

  const fmtN = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10,
      padding: '10px 13px', display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <Icon size={15} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.titre}</div>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 2, lineHeight: 1.45 }}>
          {ev.message || (
            <>Solde de <strong>{compte.nom}</strong> : {fmtN(compte.solde_actuel)} → <strong>{fmtN(ev.solde_apres)} {compte.devise || 'FCFA'}</strong> après opération</>
          )}
        </div>
      </div>
    </div>
  );
};
