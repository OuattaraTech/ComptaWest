/**
 * Configuration pm2 pour ComptaWest API
 * -----------------------------------------------------------------------------
 * pm2 maintient l'application en vie : redémarrage automatique en cas de crash,
 * au reboot du serveur, et gestion centralisée des logs.
 *
 * Installation (une fois, sur le serveur) :
 *   npm install -g pm2
 *
 * Démarrage / exploitation :
 *   pm2 start ecosystem.config.js     # démarre l'API en production
 *   pm2 logs comptawest-api           # suit les logs en direct
 *   pm2 restart comptawest-api        # redémarre après un déploiement
 *   pm2 status                        # état des process
 *   pm2 save && pm2 startup           # relance automatique au reboot serveur
 *
 * Prérequis : un fichier .env valide dans ce dossier (voir .env.example),
 * avec NODE_ENV=production.
 */
module.exports = {
  apps: [
    {
      name: 'comptawest-api',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
