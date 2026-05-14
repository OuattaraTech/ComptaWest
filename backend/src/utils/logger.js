/**
 * Logger applicatif minimal — zéro dépendance.
 *
 * En production (NODE_ENV=production) : sortie JSON sur une ligne, prête à être
 * collectée par pm2, journald ou un agrégateur de logs (Loki, Datadog…).
 * En développement : sortie lisible.
 *
 * Pour brancher un service de monitoring (Sentry…), il suffit d'ajouter
 * l'appel correspondant dans la fonction `emit` ci-dessous.
 */
const isProd = process.env.NODE_ENV === 'production';

const emit = (level, message, meta) => {
  const entry = { ts: new Date().toISOString(), level, message };
  if (meta && typeof meta === 'object') Object.assign(entry, meta);

  const line = isProd
    ? JSON.stringify(entry)
    : `[${entry.ts}] ${level.toUpperCase().padEnd(5)} ${message}` +
      (meta ? ` ${JSON.stringify(meta)}` : '');

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

module.exports = {
  info:  (message, meta) => emit('info', message, meta),
  warn:  (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
};
