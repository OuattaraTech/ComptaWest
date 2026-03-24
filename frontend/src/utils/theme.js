/**
 * Palettes de couleurs — ComptaWest
 * Utiliser getTheme(dark) pour obtenir les couleurs selon le mode
 */

export const DARK = {
  bg:     '#0B0F1A',
  card:   '#111827',
  border: '#1E2D40',
  accent: '#00D4AA',
  gold:   '#F5A623',
  red:    '#FF5C6B',
  blue:   '#4E8BF5',
  purple: '#A855F7',
  text:   '#E8EDF5',
  muted:  '#6B7A99',
  sub:    '#9BAACC',
  input:  '#161F2E',
  hover:  '#161F2E',
  sidebar: '#0D1220',
  tooltipBg: '#1A2235',
};

export const LIGHT = {
  bg:     '#F0F4F8',
  card:   '#FFFFFF',
  border: '#D1DBE8',
  accent: '#00A882',
  gold:   '#D4880A',
  red:    '#E03050',
  blue:   '#2D6FD4',
  purple: '#7C3AED',
  text:   '#0F172A',
  muted:  '#64748B',
  sub:    '#475569',
  input:  '#F8FAFC',
  hover:  '#F1F5F9',
  sidebar: '#FFFFFF',
  tooltipBg: '#1E293B',
};

export const getTheme = (dark) => dark ? DARK : LIGHT;
