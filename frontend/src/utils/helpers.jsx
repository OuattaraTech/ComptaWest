export const formatFCFA = (val, short = false) => {
  const n = parseFloat(val) || 0;
  if (short) {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString('fr-FR');
  }
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
};

export const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const statutConfig = {
  payee:      { label: 'Payée',       bg: '#00D4AA22', color: '#00D4AA' },
  en_attente: { label: 'En attente',  bg: '#F5A62322', color: '#F5A623' },
  retard:     { label: 'En retard',   bg: '#FF5C6B22', color: '#FF5C6B' },
  brouillon:  { label: 'Brouillon',   bg: '#6B7A9922', color: '#6B7A99' },
  envoyee:    { label: 'Envoyée',     bg: '#4E8BF522', color: '#4E8BF5' },
  annulee:    { label: 'Annulée',     bg: '#FF5C6B22', color: '#FF5C6B' },
};

export const StatutBadge = ({ statut }) => {
  const cfg = statutConfig[statut] || { label: statut, bg: '#6B7A9922', color: '#6B7A99' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  );
};

export const initiales = (nom = '') =>
  nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

export const truncate = (str, n = 30) =>
  str?.length > n ? str.slice(0, n) + '…' : str || '';
