# Déploiement ApeX — Guide opérationnel

Cible : un VPS Linux (Ubuntu 22.04+ / Debian 12) ou une plateforme PaaS
type Render, Fly.io, Railway. Le pipeline ci-dessous décrit le mode VPS
puis liste les ajustements spécifiques PaaS.

---

## 1. Prérequis serveur

| Composant      | Version min | Rôle |
|----------------|-------------|------|
| Node.js        | 18 LTS      | Runtime backend + frontend (build) |
| npm            | 9+          | Installation des dépendances |
| PostgreSQL     | 14          | Base de données principale |
| nginx          | 1.20+       | Reverse proxy + TLS |
| certbot        | 2.x         | Émission des certificats Let's Encrypt |
| pm2            | 5.x         | Process manager (cluster mode) |
| git            | 2.x         | Récupération du code |
| awscli / rclone| optionnel   | Upload des backups vers S3-compatible |

```bash
sudo apt update && sudo apt install -y \
  nodejs npm postgresql postgresql-contrib nginx certbot \
  python3-certbot-nginx git curl ufw
sudo npm install -g pm2
```

Configurer le firewall :

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 2. Base de données

```bash
sudo -u postgres psql
```

```sql
CREATE USER comptawest_user WITH PASSWORD '<mot_de_passe_solide>';
CREATE DATABASE comptawest OWNER comptawest_user ENCODING 'UTF8';
ALTER DATABASE comptawest SET timezone TO 'Africa/Abidjan';
\q
```

Activer les sauvegardes WAL (point-in-time recovery) si vous gérez vous-même
le serveur PostgreSQL — sinon préférez un PG managé (Render, Supabase,
Neon, RDS).

---

## 3. Code & variables d'environnement

```bash
sudo mkdir -p /opt/apex && sudo chown -R $USER:$USER /opt/apex
cd /opt/apex
git clone https://github.com/OuattaraTech/ComptaWest.git .

cd backend
cp .env.example .env
nano .env   # ← remplir les variables ci-dessous
npm ci --production
```

### Variables `.env` obligatoires

| Variable             | Exemple / Note |
|----------------------|----------------|
| `NODE_ENV`           | `production` |
| `PORT`               | `5000` |
| `DB_HOST`            | `localhost` ou hôte managed |
| `DB_PORT`            | `5432` |
| `DB_NAME`            | `comptawest` |
| `DB_USER`            | `comptawest_user` |
| `DB_PASSWORD`        | (le secret défini plus haut) |
| `DB_POOL_MAX`        | `20` (par worker pm2) |
| `JWT_SECRET`         | 64 octets random : `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN`     | `7d` |
| `FRONTEND_URL`       | `https://app.votredomaine.ci` (CORS strict) |

### Variables optionnelles

| Variable             | Effet si absente |
|----------------------|------------------|
| `RESEND_API_KEY`     | Emails désactivés (les invitations affichent le lien sans envoi) |
| `EMAIL_FROM`         | Défaut `onboarding@resend.dev` |
| `SENTRY_DSN`         | Sentry désactivé (capture d'erreurs locale uniquement) |
| `BACKUP_DIR`         | `/var/backups/apex` |
| `BACKUP_RETENTION`   | `30` jours |
| `S3_BUCKET`          | Upload des backups désactivé |

⚠ Ne jamais commiter `.env` ni y placer une clé en clair lisible dans
`.env.example` — utiliser un secret manager (sops, doppler, AWS Secrets
Manager) en production sérieuse.

---

## 4. Migrations SQL

```bash
cd /opt/apex/backend
ls config/migrations | sort   # vérif ordre
for f in config/migrations/*.sql; do
  echo "→ $f"
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$f"
done
```

Vérifications post-migration :

```bash
psql -d comptawest -tA -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
# → doit retourner ~60 tables
```

---

## 5. Build frontend & service de fichiers statiques

```bash
cd /opt/apex/frontend
npm ci
echo "VITE_API_URL=https://api.votredomaine.ci/api" > .env.production
npm run build
sudo cp -r dist/* /var/www/apex/
```

nginx servira `/var/www/apex/` pour l'application SPA.

---

## 6. Démarrage backend en cluster (pm2)

```bash
cd /opt/apex/backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd   # exécuter la commande affichée
```

Le fichier `ecosystem.config.js` est configuré en `cluster` mode :
pm2 lancera autant de workers que de CPU disponibles. Pour ajuster :

```bash
pm2 scale apex-api 4   # forcer 4 workers
```

---

## 7. Reverse proxy nginx + HTTPS

`/etc/nginx/sites-available/apex` :

```nginx
# Frontend SPA
server {
  listen 80;
  server_name app.votredomaine.ci;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl http2;
  server_name app.votredomaine.ci;

  ssl_certificate     /etc/letsencrypt/live/app.votredomaine.ci/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.votredomaine.ci/privkey.pem;

  # HSTS : forcer HTTPS sur le navigateur pour 1 an (à activer une fois
  # le certificat stable, sinon impossible de revenir en arrière)
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  root /var/www/apex;
  index index.html;

  # SPA : toute route inconnue retombe sur index.html
  location / { try_files $uri $uri/ /index.html; }

  # Assets longue durée
  location ~* \.(js|css|png|svg|woff2?)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}

# API
server {
  listen 80;
  server_name api.votredomaine.ci;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl http2;
  server_name api.votredomaine.ci;

  ssl_certificate     /etc/letsencrypt/live/api.votredomaine.ci/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.votredomaine.ci/privkey.pem;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  client_max_body_size 15M;   # uploads OCR / PJ

  location / {
    proxy_pass         http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }
}
```

Activation et certificats :

```bash
sudo ln -s /etc/nginx/sites-available/apex /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.votredomaine.ci -d api.votredomaine.ci \
  --redirect --hsts --staple-ocsp
```

Le `certbot renew` est installé comme timer systemd par le paquet.

---

## 8. Backups quotidiens

```bash
chmod +x /opt/apex/backend/scripts/backup.sh
sudo crontab -e
# Ajouter :
0 3 * * * /opt/apex/backend/scripts/backup.sh >> /var/log/apex-backup.log 2>&1
```

Restauration : `./scripts/restore.sh --latest` (ou un chemin précis), avec
`--dry-run` pour valider l'intégrité avant écriture. Test mensuel
**obligatoire** sur un clone : un backup non restauré n'existe pas.

---

## 9. Monitoring et observabilité

| Sonde                              | Cible | Fréquence |
|------------------------------------|-------|-----------|
| `GET /health`                      | LB / UptimeRobot | 1 min |
| `GET /health/deep`                 | Dashboard ops    | 5 min |
| Sentry (`SENTRY_DSN` défini)       | Capture 5xx + uncaughtException | en continu |
| `pm2 monit` / `pm2 logs apex-api`  | Debug local      | à la demande |
| Logs nginx `/var/log/nginx/*.log`  | Audit accès      | à la demande |

`/health/deep` retourne 503 si la BDD est inaccessible — branchable
directement à un load balancer pour rotation automatique.

---

## 10. Checklist Go-Live

- [ ] DNS pointe vers le VPS (A/AAAA pour `app` et `api`)
- [ ] Certificats TLS émis et HSTS actif (testé avec `curl -I`)
- [ ] `JWT_SECRET` régénéré, longueur ≥ 64 caractères
- [ ] `FRONTEND_URL` exact (CORS strict) et `NODE_ENV=production`
- [ ] Toutes les migrations appliquées (`migrations/036_*` au minimum)
- [ ] Compte super-admin créé (`scripts/promote-superadmin.js`)
- [ ] Cron backup posé + 1er backup vérifié (gzip OK, taille > 0)
- [ ] Test restauration `--dry-run` validé
- [ ] Sentry connecté (créer un test : `Sentry.captureException(new Error('boot-test'))`)
- [ ] `/health/deep` vert depuis l'extérieur
- [ ] Tests E2E exécutés contre l'environnement de pré-prod
- [ ] Rate limiters non bypassés (`NODE_ENV` ≠ `test` en prod)
- [ ] `RESEND_API_KEY` validée par envoi réel d'invitation
- [ ] Domaine d'envoi email vérifié dans Resend (sinon livraison limitée)

---

## 11. Déploiements futurs (zero-downtime)

```bash
cd /opt/apex
git pull
cd backend && npm ci --production
# Migrations éventuelles
for f in config/migrations/<nouveaux>*.sql; do psql -f "$f"; done
pm2 reload apex-api    # rolling restart, pas de coupure

cd ../frontend && npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/apex/
```

Une bascule front pendant un reload backend reste OK : le SPA cache
ses appels API et retry en cas de 502 transitoire (≤ 1 s).

---

## 12. Spécificités PaaS (Render / Fly.io / Railway)

- **PostgreSQL managé** : remplacer `DB_HOST/PORT/USER/PASSWORD` par la
  chaîne fournie. Les backups managés remplacent `scripts/backup.sh`.
- **Build command** : `npm ci --production`
- **Start command** : `node src/index.js` (pas pm2 — la plateforme gère
  déjà le supervisor et le scaling horizontal).
- **Health check** : pointer la plateforme sur `/health/deep` (HTTP 503
  déclenche la rotation automatique de l'instance).
- **HSTS / TLS** : géré nativement par la plateforme.
- **Variables d'environnement** : passées via dashboard, pas de `.env`
  versionné.
- **Logs** : la plateforme intercepte stdout/stderr → Sentry reste
  recommandé pour la capture structurée.
- **Frontend** : déployer en site statique (Netlify, Vercel, Cloudflare
  Pages) plutôt que sur le même container.

---

## 13. Incident response

| Symptôme | Réflexe |
|----------|---------|
| `/health/deep` répond 503 db=ERROR | `pg_isready -h $DB_HOST` ; vérifier crédits / disque |
| Pic 5xx soudain | `pm2 logs apex-api --lines 200` ; tableau Sentry ; rollback `git checkout <tag> && pm2 reload` |
| Bilan client déséquilibré | UI `/dsf` → onglet *Diagnostic* (LOT 1 livré) |
| Quota dépassé en boucle | Vérifier `abonnements.palier` + `compteurs_quota` ; relever le palier ou attendre rollover |
| Worker pm2 mort en boucle | Logs `pm2 logs apex-api --err` ; souvent variable env manquante |

Une procédure plus détaillée (runbook) doit accompagner le numéro
d'astreinte une fois le SaaS officiellement ouvert au public.
