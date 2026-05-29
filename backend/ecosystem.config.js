/**
 * Configuration pm2 pour ApeX API — mode CLUSTER (multi-CPU).
 * -----------------------------------------------------------------------------
 * Mode cluster : pm2 lance N workers Node.js (un par CPU par défaut).
 * Le load balancer interne de pm2 distribue les requêtes round-robin.
 * Résultat : capacité multipliée par N (sur un VPS 4 CPU → 4× plus de
 * requêtes simultanées qu'en mode fork mono-process).
 *
 * Paramétrage du nombre d'instances via env PM2_INSTANCES :
 *   - 'max'   (défaut) : utilise tous les CPU disponibles
 *   - 2-4     : limite raisonnable pour un VPS modeste
 *   - 1       : équivalent mode fork (dev/debug)
 *
 * Démarrage / exploitation :
 *   pm2 start ecosystem.config.js     # démarre en cluster
 *   pm2 reload apex-api               # redémarre sans interruption (zero-downtime)
 *   pm2 logs apex-api                 # suit les logs en direct
 *   pm2 status                        # état des workers
 *   pm2 monit                         # CPU/RAM en temps réel
 *   pm2 save && pm2 startup           # relance automatique au reboot
 *
 * IMPORTANT pour la BDD : chaque worker a son propre pool PG (taille
 * DB_POOL_MAX dans .env). Avec 4 workers et pool max=50, le total
 * descendances = 4 × 50 = 200 connexions vers PostgreSQL. Vérifier que
 * `max_connections` de PostgreSQL est ≥ workers × pool_max + marge.
 */
module.exports = {
  apps: [
    {
      name: 'apex-api',
      script: 'src/index.js',
      cwd: __dirname,
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      max_memory_restart: '500M',
      kill_timeout: 5000,
      listen_timeout: 8000,
      // env appliqué par défaut. Override possible avec
      // `pm2 start ecosystem.config.js --env test` pour profil test.
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
      env_test: {
        NODE_ENV: 'test',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
