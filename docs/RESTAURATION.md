# Restauration ApeX — runbook opérationnel

> Procédure à suivre en cas de perte ou de corruption de données en
> production. À garder accessible (imprimé ou bookmarké) — quand l'incident
> arrive, la première heure compte.

---

## 1. Diagnostic préalable (5 min)

Avant de toucher à la base, déterminer le **niveau de gravité** :

| Symptôme | Niveau | Action |
|---|---|---|
| Tout fonctionne mais quelques données fausses | 🟢 LÉGER | Pas de restauration — corriger par UPDATE ciblé après diagnostic |
| Une table entière vidée par erreur (DELETE accidentel) | 🟡 MODÉRÉ | Restauration partielle en cherry-picking |
| Plusieurs tables corrompues ou base inutilisable | 🟠 GRAVE | Restauration intégrale du dernier backup propre |
| Base inaccessible / disque mort | 🔴 CRITIQUE | Restauration intégrale sur un nouveau VPS |

---

## 2. Identifier le bon backup à restaurer

Sur le VPS :

```bash
# Liste les backups locaux par date décroissante
ls -lh /var/backups/apex/ | sort -k 9 -r | head -10
```

Sur Cloudflare R2 (si VPS HS) :

```bash
source /etc/default/apex-backup
aws s3 ls s3://apex-backups-prod/ --profile r2 --endpoint-url "$R2_ENDPOINT"
```

⚠️ Choisir un backup **antérieur** à l'incident. Mieux vaut perdre 24 h
de données que restaurer un backup déjà corrompu.

Vérifier l'intégrité avant de toucher à la base de prod :

```bash
gunzip -t /var/backups/apex/apex_2026-05-30_0300.sql.gz
# Aucune sortie = OK ; sinon le fichier est corrompu
```

---

## 3. Restauration sur le VPS existant

### 3.1 Stopper l'application (sinon écritures parasites)

```bash
pm2 stop apex-api
```

### 3.2 Sauvegarder l'état actuel (au cas où)

```bash
cd /opt/apex/backend
BACKUP_DIR=/var/backups/apex ./scripts/backup-db.sh
# Nommer ce backup "avant-restauration" pour s'y retrouver :
mv /var/backups/apex/apex_$(date +%Y-%m-%d)_*.sql.gz \
   /var/backups/apex/avant-restauration_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 3.3 Restauration intégrale

```bash
cd /opt/apex/backend
./scripts/restore.sh /var/backups/apex/apex_2026-05-30_0300.sql.gz --dry-run
```

`--dry-run` n'écrit RIEN — il valide juste l'intégrité du fichier. Si OK :

```bash
./scripts/restore.sh /var/backups/apex/apex_2026-05-30_0300.sql.gz
```

### 3.4 Vérifier la base restaurée

```bash
source <(grep '^DB_PASSWORD=' /opt/apex/backend/.env)
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U apex -d apex -tAc \
  "SELECT COUNT(*) AS nb_tables FROM information_schema.tables WHERE table_schema='public';"
# Attendu : ≥ 40

PGPASSWORD="$DB_PASSWORD" psql -h localhost -U apex -d apex -c \
  "SELECT COUNT(*) AS users, (SELECT COUNT(*) FROM entreprises) AS entreprises FROM utilisateurs;"
```

### 3.5 Relancer l'application

```bash
pm2 start apex-api
pm2 logs apex-api --lines 30 --nostream
```

### 3.6 Smoke test depuis l'extérieur

```bash
# Sur ton poste local
~/Téléchargements/ComptaWest-master/scripts/smoke-prod.sh
```

---

## 4. Restauration sur un nouveau VPS (VPS d'origine HS)

### 4.1 Reconstruire l'environnement de base

```bash
# 1. Provisionner un nouveau VPS Debian 13
# 2. Lancer bootstrap-vps.sh (idempotent)
sudo bash scripts/bootstrap-vps.sh

# 3. Cloner le code, créer .env, npm ci, etc. — voir docs/DEPLOIEMENT.md §3-§6
```

### 4.2 Récupérer le backup depuis R2

```bash
mkdir -p /var/backups/apex
sudo chown apex:apex /var/backups/apex

# Configurer ~/.aws/credentials avec les clés R2 (voir docs/DEPLOIEMENT.md)
source /etc/default/apex-backup

aws s3 sync s3://apex-backups-prod/ /var/backups/apex/ \
  --profile r2 --endpoint-url "$R2_ENDPOINT"
```

### 4.3 Restaurer

```bash
cd /opt/apex/backend
./scripts/restore.sh /var/backups/apex/apex_2026-05-30_0300.sql.gz
```

### 4.4 Redémarrer pm2 et Caddy

```bash
pm2 start ecosystem.config.js --env production
pm2 save

sudo cp /opt/apex/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 4.5 Pointer Cloudflare vers la nouvelle IP

Dashboard Cloudflare → DNS → modifier les 6 enregistrements `A`
(useapex.ci, app, api, demo, cabinet, docs) vers la nouvelle IP du VPS.
Propagation : 1-5 min avec proxy Cloudflare ON.

---

## 5. Restauration partielle (cherry-pick d'une table)

Quand une seule table a été corrompue/vidée et que tu veux récupérer
juste celle-là **sans écraser** les écritures faites depuis le backup.

### 5.1 Restaurer dans une base de test

```bash
sudo -u postgres createdb apex_restore_temp
gunzip -c /var/backups/apex/apex_2026-05-30_0300.sql.gz \
  | psql -h localhost -U postgres -d apex_restore_temp
```

### 5.2 Copier la table cible vers la prod

```bash
# Exemple : restaurer la table `factures`
sudo -u postgres pg_dump -t factures apex_restore_temp \
  | psql -h localhost -U apex -d apex
```

⚠️ Cette opération **écrase** les rows ayant le même ID (UPSERT comportement
selon le schéma). Si tu veux fusionner sans écraser : passer par un
schéma temporaire et un `INSERT ... ON CONFLICT DO NOTHING` ciblé.

### 5.3 Nettoyer

```bash
sudo -u postgres dropdb apex_restore_temp
```

---

## 6. Tests réguliers

Le cron mensuel `verify-backup.sh` lance déjà cette vérification :
- 1er du mois à 4h, restaure le dernier backup dans une base de test
- Vérifie nombre de tables, intégrité gzip, présence des tables-clés
- Détruit la base de test
- Loggue dans `/var/log/apex-backup-verify.log`

**Vérification manuelle recommandée chaque trimestre** : exécuter
intégralement la procédure §3 ou §4 sur un VPS de staging pour valider
que les humains et les processus marchent — pas que les scripts.

---

## 7. Après chaque restauration

- [ ] Annoncer aux utilisateurs la fenêtre de données perdues
- [ ] Logger l'incident dans le journal interne (date, cause, backup utilisé, durée d'indisponibilité)
- [ ] Si la cause est connue, corriger le bug racine avant de reprendre
- [ ] Vérifier que le cron backup tourne toujours (`tail /var/log/apex-backup.log`)
- [ ] Tester un envoi d'email transactionnel (Resend toujours connecté ?)
- [ ] Confirmer que Sentry capture (déclencher une erreur de test)
