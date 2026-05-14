const { Pool } = require('pg');
require('dotenv').config();

// SSL : requis par la plupart des bases managées (Supabase, RDS, Render…).
//   DB_SSL=true                      → active le chiffrement TLS
//   DB_SSL_REJECT_UNAUTHORIZED=false → tolère un certificat auto-signé
//                                      (laisser à true si un CA valide est utilisé)
const ssl = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : false;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'comptawest',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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
