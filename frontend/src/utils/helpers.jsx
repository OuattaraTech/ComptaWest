import i18next from 'i18next';

// Locale BCP47 dérivée de i18next pour les Intl.* — utilisée par formatDate
// et formatFCFA. fr-FR par défaut, en-US si la langue active commence par "en".
const numberLocale = () => (i18next.language?.startsWith('en') ? 'en-US' : 'fr-FR');

export const formatFCFA = (val, short = false) => {
  const n = parseFloat(val) || 0;
  if (short) {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString(numberLocale());
  }
  return new Intl.NumberFormat(numberLocale()).format(Math.round(n));
};

export const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(numberLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
};

export const initiales = (nom = '') =>
  nom.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

export const truncate = (str, n = 30) =>
  str?.length > n ? str.slice(0, n) + '…' : str || '';
