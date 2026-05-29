# Déploiement ApeX — `useapex.ci`

Fichiers prêts à coller sur le VPS de production.

## Pile cible

| Composant | Choix | Coût indicatif |
|---|---|---|
| Domaine | `useapex.ci` (registrar ivoirien ARTCI) | ~9 000 FCFA/an |
| DNS + CDN + WAF | Cloudflare Free (proxy ON) | 0 € |
| VPS app | OVH VLE-2 (2 vCPU / 4 Go / 80 Go NVMe) | ~9 €/mois |
| PostgreSQL | OVH Public Cloud DB Essential 2 vCPU/4 Go | ~25 €/mois |
| Backups | Bucket S3 Scaleway (50 Go chiffré) | ~1 €/mois |
| Mail transactionnel | Resend (3 000 mails/mois gratuits) | 0 € |
| Reverse proxy + TLS | Caddy + Let's Encrypt | 0 € |
| Monitoring | Sentry (déjà branché) + UptimeRobot | 0 € |

## Étapes d'installation (résumé)

```bash
# 1. Sur le VPS Ubuntu 24.04 fraîchement provisionné
apt update && apt upgrade -y
apt install -y caddy nodejs npm postgresql-client git

# 2. Installer pm2 globalement
npm install -g pm2

# 3. Cloner et builder
git clone https://github.com/OuattaraTech/ComptaWest.git /opt/apex
cd /opt/apex/backend && npm ci --omit=dev
cd /opt/apex/frontend && npm ci && npm run build

# 4. Préparer les répertoires servis par Caddy
mkdir -p /var/www/apex-front /var/www/apex-landing /var/www/apex-docs
cp -r /opt/apex/frontend/dist/* /var/www/apex-front/

# 5. Configurer l'environnement
cp /opt/apex/backend/.env.example /opt/apex/backend/.env
# … éditer .env avec les vraies valeurs prod (DB, JWT, Resend, etc.)
# Remplacer notamment les FRONTEND_URL/PUBLIC_URL/BACKEND_BASE_URL
# par les versions https://*.useapex.ci

# 6. Migrations BD
cd /opt/apex/backend && npm run migrate

# 7. Lancer le backend en cluster
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# 8. Installer le Caddyfile
cp /opt/apex/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy

# 9. Vérifier
curl -I https://useapex.ci
curl -I https://app.useapex.ci
curl https://api.useapex.ci/api/health
```

## DNS Cloudflare à créer

| Type | Nom | Valeur | Proxy |
|---|---|---|---|
| A | `useapex.ci` | `<IP_VPS>` | ON |
| CNAME | `www` | `useapex.ci` | ON |
| A | `app` | `<IP_VPS>` | ON |
| A | `api` | `<IP_VPS>` | ON |
| A | `demo` | `<IP_VPS>` | ON |
| A | `cabinet` | `<IP_VPS>` | ON |
| A | `docs` | `<IP_VPS>` | ON |
| CNAME | `status` | `stats.uptimerobot.com` | OFF |

Mode TLS Cloudflare : **Full (strict)**.

## Email — DNS à ajouter (Resend)

Dans Cloudflare DNS, ajouter les enregistrements TXT/CNAME fournis par
Resend après "Add Domain → useapex.ci" :

- `_resend.useapex.ci`  TXT  …
- `resend._domainkey.useapex.ci`  CNAME  …
- `send.useapex.ci`  CNAME  feedback-smtp.eu-west-1.amazonses.com
- SPF/DMARC : Resend les indique dans l'onglet "DNS records".

## Backups

Le script `backend/scripts/backup-db.sh` est déjà prêt. Cron suggéré :

```cron
# /etc/cron.d/apex-backup
0 3 * * * apex /opt/apex/backend/scripts/backup-db.sh >> /var/log/apex-backup.log 2>&1
```

Ajouter une synchro vers le bucket S3 Scaleway (off-site) :

```cron
30 3 * * * apex aws --endpoint-url=https://s3.fr-par.scw.cloud s3 sync /opt/apex/backups/ s3://apex-backups/ --sse AES256
```
