require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const logger = require('./utils/logger');

// ── Vérification des variables critiques au boot ──────────────────────────
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET manquant ou trop court (32 caractères minimum requis).');
  console.error('   Génère une clé : node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

if (isProd && !process.env.FRONTEND_URL) {
  console.error('❌ FRONTEND_URL doit être défini en production (CORS).');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// ── Sécurité ──────────────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiter global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, réessayez dans 15 minutes.' },
}));

// ── Logging ───────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Parsing ───────────────────────────────────────────────────────────────
// On expose req.rawBody pour les webhooks signés (Wave HMAC-SHA256). Sans
// le corps brut on ne peut pas recalculer la signature côté serveur.
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', app: 'ComptaWest API v2', version: '2.1.0', env: process.env.NODE_ENV });
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} introuvable` });
});

// ── Erreur globale ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Erreur non gérée', {
    method: req.method, url: req.originalUrl,
    message: err.message, stack: err.stack,
  });
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Erreur serveur interne'
    : err.message || 'Erreur serveur interne';
  res.status(status).json({ success: false, message });
});

// ── Filets de sécurité process ────────────────────────────────────────────
// Une promesse rejetée non gérée ou une exception non capturée laisseraient
// sinon le process dans un état indéterminé sans aucune trace.
process.on('unhandledRejection', (reason) => {
  logger.error('Promesse rejetée non gérée', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Exception non capturée', { message: err.message, stack: err.stack });
  // L'état est potentiellement corrompu : on sort proprement, le process
  // manager (pm2/systemd) redémarre l'application.
  process.exit(1);
});

app.listen(PORT, () => {
  logger.info(`ComptaWest API v2.1 démarrée sur le port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
  });
});

module.exports = app;