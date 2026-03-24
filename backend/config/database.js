const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'comptawest',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
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
