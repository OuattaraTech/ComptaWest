#!/usr/bin/env node
/**
 * ApeX — pré-vérification de l'environnement de production.
 * -----------------------------------------------------------------------------
 * À lancer AVANT `pm2 start ecosystem.config.js` en prod. Il :
 *   - charge backend/.env via dotenv
 *   - vérifie chaque variable critique (présence + qualité)
 *   - refuse de poursuivre si une variable indispensable manque
 *   - liste les variables optionnelles manquantes comme avertissements
 *
 * Exit codes :
 *   0  → l'environnement est prêt
 *   1  → au moins un check bloquant a échoué
 *
 * Usage :
 *   node scripts/check-prod-ready.js
 *   NODE_ENV=production node scripts/check-prod-ready.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

const errors = [];
const warnings = [];
const oks = [];

function ok(msg) { oks.push(msg); }
function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

const env = process.env;

// ---------- NODE_ENV ----------
if (env.NODE_ENV !== 'production') {
  err(`NODE_ENV doit être "production" (actuel : "${env.NODE_ENV || '(absent)'}")`);
} else {
  ok('NODE_ENV=production');
}

// ---------- PORT ----------
const port = parseInt(env.PORT, 10);
if (!port || port < 1 || port > 65535) {
  err(`PORT invalide : "${env.PORT || '(absent)'}"`);
} else {
  ok(`PORT=${port}`);
}

// ---------- Base de données ----------
const dbVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
for (const v of dbVars) {
  if (!env[v]) err(`Variable ${v} absente`);
}
if (env.DB_PASSWORD && /remplacer|changeme|password|123|admin/i.test(env.DB_PASSWORD)) {
  err('DB_PASSWORD ressemble à une valeur par défaut — remplacez par un secret aléatoire');
}
if (env.DB_PASSWORD && env.DB_PASSWORD.length < 12) {
  warn(`DB_PASSWORD court (${env.DB_PASSWORD.length} chars) — viser ≥ 20 chars`);
}
if (env.DB_HOST && env.DB_HOST !== 'localhost' && env.DB_HOST !== '127.0.0.1') {
  if (env.DB_SSL !== 'true') {
    warn(`DB distante (${env.DB_HOST}) sans SSL — recommandé : DB_SSL=true`);
  }
}
if (dbVars.every(v => env[v])) ok('DB_* renseignées');

// ---------- JWT ----------
if (!env.JWT_SECRET) {
  err('JWT_SECRET absent');
} else if (env.JWT_SECRET.length < 32) {
  err(`JWT_SECRET trop court (${env.JWT_SECRET.length} chars, min 32, recommandé 64)`);
} else if (/remplacer|changeme|secret|123/i.test(env.JWT_SECRET)) {
  err('JWT_SECRET ressemble à une valeur par défaut — générez-en un avec `crypto.randomBytes(64)`');
} else if (env.JWT_SECRET.length < 64) {
  warn(`JWT_SECRET=${env.JWT_SECRET.length} chars — recommandé ≥ 64`);
  ok('JWT_SECRET défini');
} else {
  ok(`JWT_SECRET défini (${env.JWT_SECRET.length} chars)`);
}

// ---------- URLs publiques ----------
const urlVars = ['FRONTEND_URL', 'PUBLIC_URL', 'BACKEND_BASE_URL', 'FRONTEND_BASE_URL'];
for (const v of urlVars) {
  const u = env[v];
  if (!u) {
    warn(`${v} absent — repli sur valeur de ecosystem.config.js`);
    continue;
  }
  if (!u.startsWith('https://')) {
    err(`${v} doit être en https:// (actuel : "${u}")`);
  } else if (/localhost|127\.0\.0\.1/.test(u)) {
    err(`${v} pointe vers localhost en production : "${u}"`);
  } else {
    ok(`${v}=${u}`);
  }
}

// ---------- Resend (email) ----------
if (!env.RESEND_API_KEY) {
  warn('RESEND_API_KEY absente — emails désactivés (invitations cabinet/PME sans envoi)');
} else if (!env.RESEND_API_KEY.startsWith('re_')) {
  err('RESEND_API_KEY mal formée (doit commencer par "re_")');
} else {
  ok('RESEND_API_KEY définie');
}

if (env.EMAIL_FROM && env.EMAIL_FROM.includes('onboarding@resend.dev')) {
  warn('EMAIL_FROM utilise resend.dev (dev only) — passez à noreply@useapex.ci');
}

// ---------- OCR (optionnel) ----------
if (!env.MISTRAL_API_KEY) {
  warn('MISTRAL_API_KEY absente — scanner OCR en mode démo');
} else {
  ok('MISTRAL_API_KEY définie');
}

// ---------- Sentry (optionnel) ----------
if (!env.SENTRY_DSN) {
  warn('SENTRY_DSN absent — capture d\'erreurs en local uniquement');
} else if (!env.SENTRY_DSN.startsWith('https://')) {
  err('SENTRY_DSN doit être une URL https://...sentry.io/...');
} else {
  ok('SENTRY_DSN défini');
}

// ---------- Trust proxy (Caddy/CF en front) ----------
if (env.TRUST_PROXY !== '1' && env.TRUST_PROXY !== 'true') {
  warn('TRUST_PROXY non actif — IP client mal détectée derrière Caddy/Cloudflare');
}

// ---------- pm2 cluster ----------
if (!env.PM2_INSTANCES) {
  ok('PM2_INSTANCES par défaut (max = un worker par CPU)');
} else {
  ok(`PM2_INSTANCES=${env.PM2_INSTANCES}`);
}

// ---------- Rapport ----------
console.log(`\n${BOLD}${BLUE}=== ApeX — vérification prod ===${RESET}\n`);
for (const m of oks) console.log(`  ${GREEN}✓${RESET} ${m}`);
for (const m of warnings) console.log(`  ${YELLOW}⚠${RESET} ${m}`);
for (const m of errors) console.log(`  ${RED}✗${RESET} ${m}`);

console.log(`\n${BOLD}Résumé :${RESET} ` +
  `${GREEN}${oks.length} OK${RESET}, ` +
  `${YELLOW}${warnings.length} avertissements${RESET}, ` +
  `${RED}${errors.length} erreurs${RESET}\n`);

if (errors.length > 0) {
  console.log(`${RED}${BOLD}KO — corrigez les erreurs avant de démarrer pm2.${RESET}\n`);
  process.exit(1);
}
console.log(`${GREEN}${BOLD}OK — prêt à démarrer.${RESET}\n`);
process.exit(0);
