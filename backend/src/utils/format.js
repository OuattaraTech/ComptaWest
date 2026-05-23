/**
 * Helpers de formatage partagés (français Côte d'Ivoire).
 * Utilisés dans les générateurs PDF (facture, bulletin de paie, rapports).
 */

const fmtMontant = (n) => {
  const num = Math.round(Number(n) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/**
 * Formate une date en français (Code du travail ivoirien recommande
 * un libellé en clair sur les bulletins de paie).
 *
 * @param {Date|string} d
 * @param {object} [opts] - { withWeekday: bool, short: bool }
 * @returns {string} ex. « lundi 23 mai 2026 » ou « 23/05/2026 »
 */
const fmtDateFr = (d, { withWeekday = false, short = false } = {}) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return String(d).slice(0, 10);

  if (short) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${date.getFullYear()}`;
  }

  // Format long en français : « lundi 23 mai 2026 » ou « 23 mai 2026 »
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

/**
 * Convertit un montant en lettres françaises (jusqu'à 999 999 999 999).
 * Respecte les règles d'orthographe : invariabilité de « cent » et
 * « vingt » devant mille/million/milliard, élision dans « et un ».
 *
 * Source historique : rapportsController.js — déplacé ici pour
 * réutilisation par paieController (bulletins de paie).
 */
const montantEnLettres = (n) => {
  const num = Math.round(Math.abs(Number(n) || 0));
  if (num === 0) return 'zéro';
  const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  const moinsMille = (n, isMultiplier = false) => {
    if (n === 0) return '';
    if (n < 20) return unites[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      if (d === 7 || d === 9) {
        const reste = 10 + u;
        return dizaines[d] + (u === 1 && d === 7 ? ' et ' : '-') + unites[reste];
      }
      if (u === 0) return dizaines[d] + (d === 8 && !isMultiplier ? 's' : '');
      if (u === 1 && d !== 8) return dizaines[d] + ' et un';
      return dizaines[d] + '-' + unites[u];
    }
    const c = Math.floor(n / 100);
    const reste = n % 100;
    const centaine = c === 1 ? 'cent' : unites[c] + ' cent' + (reste === 0 && !isMultiplier ? 's' : '');
    return reste === 0 ? centaine : centaine + ' ' + moinsMille(reste, false);
  };

  const milliards = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const milliers = Math.floor((num % 1000000) / 1000);
  const reste = num % 1000;

  const parts = [];
  if (milliards) parts.push((milliards === 1 ? 'un' : moinsMille(milliards, true)) + ' milliard' + (milliards > 1 ? 's' : ''));
  if (millions)  parts.push((millions  === 1 ? 'un' : moinsMille(millions,  true)) + ' million'  + (millions  > 1 ? 's' : ''));
  if (milliers)  parts.push((milliers  === 1 ? '' : moinsMille(milliers,  true) + ' ') + 'mille');
  if (reste)     parts.push(moinsMille(reste, false));
  return parts.join(' ').trim();
};

module.exports = { fmtMontant, fmtDateFr, montantEnLettres };
