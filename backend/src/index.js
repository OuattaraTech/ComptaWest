require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');

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
app.use(express.json({ limit: '10mb' }));
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
  console.error('Erreur non gérée:', err.stack);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Erreur serveur interne'
    : err.message || 'Erreur serveur interne';
  res.status(status).json({ success: false, message });
});

app.listen(PORT, () => {
  console.log(`🚀 ComptaWest API v2.1 → http://localhost:${PORT}`);
  console.log(`📊 Mode: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;