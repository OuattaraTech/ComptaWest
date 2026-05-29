/**
 * Wrapper Sentry optionnel pour ApeX.
 *
 * Stratégie : ne pas ajouter de dépendance lourde tant que Sentry n'est
 * pas réellement utilisé. Si SENTRY_DSN est défini en env ET que le
 * package @sentry/node est installé (npm install @sentry/node), le
 * module s'initialise et capture les erreurs 5xx + les exceptions
 * non gérées. Sinon il devient un no-op silencieux.
 *
 * Activer Sentry en production :
 *   1. Créer un compte gratuit sur sentry.io (5 000 events/mois free)
 *   2. Créer un projet "Node.js" → copier le DSN
 *   3. Ajouter en .env :  SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/yyy
 *   4. npm install @sentry/node @sentry/profiling-node
 *   5. Redémarrer : npm run prod:reload
 *
 * Capture automatiquement :
 *   - Toutes les 5xx levées par le middleware d'erreur global
 *   - Les exceptions non gérées (uncaughtException)
 *   - Les promise rejections non capturées (unhandledRejection)
 *
 * Capture manuelle disponible via require('./utils/sentry').captureException(err, ctx)
 */
let Sentry = null;
let initialized = false;

function init() {
  if (initialized) return Sentry;
  initialized = true;

  if (!process.env.SENTRY_DSN) {
    return null;
  }

  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || 'apex@2.1.0',
      // Échantillonnage : 100% des erreurs, 10% des transactions perf
      sampleRate: 1.0,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES || '0.1'),
      // Ne pas envoyer les requêtes de healthcheck (bruit)
      beforeSend(event) {
        const url = event.request?.url || '';
        if (url.includes('/health')) return null;
        return event;
      },
    });
    console.log('[Sentry] initialisé pour environnement', process.env.NODE_ENV);
    return Sentry;
  } catch (err) {
    console.warn('[Sentry] SENTRY_DSN défini mais @sentry/node non installé. Exécuter : npm install @sentry/node');
    return null;
  }
}

function captureException(err, context = {}) {
  const s = init();
  if (s) {
    s.captureException(err, { extra: context });
  }
}

function expressErrorHandler() {
  return (err, req, res, next) => {
    const s = init();
    if (s && (err.status === undefined || err.status >= 500)) {
      s.captureException(err, {
        extra: {
          method: req.method,
          url: req.originalUrl,
          user_id: req.user?.id,
          entreprise_id: req.entrepriseId,
        },
      });
    }
    next(err);
  };
}

module.exports = { init, captureException, expressErrorHandler };
