const { Pool } = require('pg');
require('dotenv').config();

// SSL : requis par la plupart des bases managées (Supabase, RDS, Render…).
//   DB_SSL=true                      → active le chiffrement TLS
//   DB_SSL_REJECT_UNAUTHORIZED=false → tolère un certificat auto-signé
//                                      (laisser à true si un CA valide est utilisé)
const ssl = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : false;

// Taille du pool : par défaut 50 connexions, paramétrable via env.
// En cluster pm2 (N workers), chaque worker a son propre pool de cette
// taille → conn total = N × max. Avec max_connections=100 sur PostgreSQL,
// rester à pool_max × workers ≤ 80 pour garder de la marge admin.
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'comptawest',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl,
  max: parseInt(process.env.DB_POOL_MAX) || 50,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_MS) || 10000,
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_TIMEOUT_MS) || 5000,
});

// Log connexion sans crasher le serveur sur erreur temporaire
pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ PostgreSQL connecté');
  }
});

pool.on('error', (err) => {
  console.error('❌ Erreur pool PostgreSQL:', err.message);
  // Ne pas faire process.exit — laisser le pool gérer la reconnexion
});

module.exports = pool;
