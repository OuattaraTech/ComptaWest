# Restauration ApeX — guide opérationnel pas à pas

> **Pour qui ?** Toute personne devant restaurer ApeX après un incident,
> même sans culture technique. Chaque commande est expliquée : ce qu'elle
> fait, ce que tu dois voir si ça marche, et quoi faire si ça plante.
>
> **Quand ?** Quand des données ont disparu, ont été modifiées par erreur,
> ou quand l'application est inutilisable.
>
> **Combien de temps ça prend ?** De 5 minutes (incident léger) à 1 heure
> (reconstruction complète sur un nouveau serveur).
>
> **Imprime cette page** ou garde-la accessible hors-ligne — quand
> l'incident arrive, le serveur est peut-être inaccessible.

---

## Table des matières

1. [Concepts à connaître](#1-concepts-à-connaître)
2. [Évaluer la gravité de l'incident](#2-évaluer-la-gravité-de-lincident)
3. [Trouver le bon backup](#3-trouver-le-bon-backup)
4. [Scénario A — Restauration complète sur le serveur actuel](#4-scénario-a--restauration-complète-sur-le-serveur-actuel)
5. [Scénario B — Restauration sur un nouveau serveur](#5-scénario-b--restauration-sur-un-nouveau-serveur)
6. [Scénario C — Récupérer une seule table](#6-scénario-c--récupérer-une-seule-table)
7. [Test mensuel automatique](#7-test-mensuel-automatique)
8. [Après chaque restauration](#8-après-chaque-restauration)
9. [Glossaire des termes techniques](#9-glossaire-des-termes-techniques)

---

## 1. Concepts à connaître

### Qu'est-ce qu'un backup ?

Un **backup** (ou « sauvegarde ») est une **photo complète de toutes les
données d'ApeX à un instant T**. Cette photo est rangée dans un fichier
compressé.

Concrètement, chaque nuit à 3h, le système copie toute la base de données
(comptes utilisateurs, entreprises, factures, écritures, paies, etc.)
dans un fichier qui ressemble à :

```
apex_2026-05-30_0300.sql.gz
       │         │     │
       │         │     └─ format : .sql.gz (texte SQL compressé en gzip)
       │         └─────── heure de la sauvegarde : 03h00
       └───────────────── date de la sauvegarde : 30 mai 2026
```

Restaurer signifie : **prendre cette photo et la remettre dans la base
de données**, en écrasant ce qui s'y trouve actuellement.

### Où sont rangés les backups ?

| Emplacement | Combien de backups | Utilité |
|---|---|---|
| **Sur le serveur**, dans `/var/backups/apex/` | 30 jours (les plus récents) | Restauration rapide en cas d'incident applicatif |
| **Dans le cloud Cloudflare R2**, bucket `apex-backups-prod` | 30 jours synchronisés | Filet de sécurité si le serveur est totalement perdu |

### Qu'est-ce qu'on peut perdre lors d'une restauration ?

Quand tu restaures un backup, tu **reviens dans le temps** au moment où
ce backup a été créé. **Toutes les données saisies depuis sont perdues**.

Exemple : si tu restaures le backup de cette nuit 3h00, et qu'on est
14h00, **tu perds 11 heures de saisies utilisateurs**. C'est inévitable.
C'est pour ça qu'on prend toujours le backup **le plus récent qui soit
encore propre** (avant l'incident).

---

## 2. Évaluer la gravité de l'incident

Avant de toucher à quoi que ce soit, **prends 5 minutes pour identifier
ce qui s'est passé**. Une mauvaise décision ici peut empirer la situation.

### Arbre de décision

```
┌─────────────────────────────────────────────────────────┐
│  Quel est le symptôme ?                                  │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼──────────────────┬─────────────────┐
        ▼                 ▼                  ▼                 ▼
  Quelques chiffres   Une ou deux       Plusieurs tables   Le site est
  faux dans l'UI      tables vidées    cassées / écritu-   complètement
                      (DELETE accident) res incohérentes   inaccessible
        │                 │                  │                 │
        ▼                 ▼                  ▼                 ▼
   🟢 LÉGER          🟡 MODÉRÉ          🟠 GRAVE          🔴 CRITIQUE
        │                 │                  │                 │
        ▼                 ▼                  ▼                 ▼
   Pas de            Restauration       Restauration       Restauration
   restauration.     PARTIELLE          INTÉGRALE          INTÉGRALE +
   Corriger par      (juste la table    sur le serveur     reconstruction
   UPDATE ciblé      perdue) →          actuel →           du serveur →
   après diagnostic. Scénario C         Scénario A         Scénario B
```

### Quand NE PAS restaurer

- ❌ Le problème est dans le **code** (bug applicatif). Restaurer ne le
  corrigera pas, et tu perdras des données pour rien.
- ❌ Le problème est dans la **configuration** (mauvaise variable .env,
  Caddy mal configuré). Un redémarrage de pm2 suffit souvent.
- ❌ Tu n'es **pas sûr** de ce qui s'est passé. Investigue d'abord en
  consultant les logs : `pm2 logs apex-api --lines 100`.

### Quand restaurer

- ✅ Des données ont été **réellement supprimées** ou **corrompues**
  dans la base de données.
- ✅ Tu as vérifié que le **backup que tu vas utiliser est antérieur**
  à l'incident (pas déjà corrompu).

---

## 3. Trouver le bon backup

Avant de restaurer, identifie quel fichier de sauvegarde utiliser.

### Étape 3.1 — Te connecter au serveur

Sur ton ordinateur, ouvre un terminal et tape :

```bash
ssh apex@178.105.242.7
```

**Ce que ça fait :** ouvre une session distante sur le serveur ApeX.

**Si ça plante** avec `Permission denied` : ta clé SSH n'est pas
reconnue. Soit tu n'es pas sur le bon ordinateur, soit tu dois utiliser
le mot de passe (`-o PreferredAuthentications=password`). Si le serveur
ne répond pas du tout (`Connection timed out`), passe au [Scénario B](#5-scénario-b--restauration-sur-un-nouveau-serveur).

### Étape 3.2 — Lister les backups locaux disponibles

Une fois connecté sur le serveur :

```bash
ls -lh /var/backups/apex/ | sort -k 9 -r | head -10
```

**Ce que ça fait :** affiche les 10 backups les plus récents, du plus
récent au plus ancien.

**Ce que tu dois voir :** une liste comme ceci :

```
-rw-r--r-- 1 apex apex 245K May 30 03:00 apex_2026-05-30_0300.sql.gz
-rw-r--r-- 1 apex apex 244K May 29 03:00 apex_2026-05-29_0300.sql.gz
-rw-r--r-- 1 apex apex 243K May 28 03:00 apex_2026-05-28_0300.sql.gz
...
```

La colonne du milieu (`245K`) est la taille du fichier — elle doit
augmenter doucement chaque jour (la base grossit).

⚠️ **Signaux d'alerte :**
- Si une taille est **soudainement très petite** (< 10 Ko) ou **0** :
  ce backup est probablement corrompu, **ne pas l'utiliser**.
- Si la liste est **vide** ou si seuls les backups < 1 mois sont là
  alors que tu cherches plus ancien : passe à l'étape 3.3 (R2).

### Étape 3.3 — Lister les backups dans le cloud Cloudflare R2

Si tu ne trouves pas ce qu'il te faut en local (ou si le serveur est
HS), récupère depuis le cloud :

```bash
source /etc/default/apex-backup
aws s3 ls s3://apex-backups-prod/ --profile r2 --endpoint-url "$R2_ENDPOINT"
```

**Ce que ça fait :** demande à Cloudflare R2 la liste des fichiers
synchronisés depuis le serveur.

**Ce que tu dois voir :** une liste similaire à ci-dessus avec dates
et tailles.

**Si ça plante** avec un message AWS : les credentials R2 ne sont
peut-être pas configurés sur ce serveur. Vérifie `cat ~/.aws/credentials`
existe et contient ta clé R2.

### Étape 3.4 — Choisir le bon backup

Choisis :
- Un backup **antérieur** au moment où l'incident est survenu (sinon
  il contient déjà les dégâts).
- Avec une **taille raisonnable** (similaire aux autres dans la liste).
- **Le plus récent possible** qui respecte les 2 critères ci-dessus —
  moins tu remontes, moins tu perds de saisies.

Exemple : « L'incident s'est produit aujourd'hui à 11h00. Le backup
du 30 mai à 3h00 est donc bon, car antérieur de 8 heures à l'incident. »

### Étape 3.5 — Vérifier l'intégrité du fichier choisi

Avant de l'utiliser, on vérifie qu'il n'est pas corrompu :

```bash
gunzip -t /var/backups/apex/apex_2026-05-30_0300.sql.gz
```

**Ce que ça fait :** teste si le fichier compressé est valide,
**sans rien restaurer**.

**Ce que tu dois voir :** **rien**. Aucune sortie = succès.

**Si tu vois un message d'erreur** (ex. `unexpected end of file`) :
le fichier est cassé. **Ne l'utilise pas**. Reviens à l'étape 3.4 avec
un backup plus ancien.

### Étape 3.6 — Si le backup est dans R2, le télécharger d'abord

```bash
source /etc/default/apex-backup
aws s3 cp s3://apex-backups-prod/apex_2026-05-30_0300.sql.gz \
  /var/backups/apex/ --profile r2 --endpoint-url "$R2_ENDPOINT"
```

**Ce que ça fait :** copie le fichier depuis le cloud vers le serveur,
dans le même dossier que les backups locaux.

---

## 4. Scénario A — Restauration complète sur le serveur actuel

**À utiliser quand :** plusieurs tables sont cassées, mais le serveur
lui-même fonctionne (tu peux te connecter en SSH et la base répond).

**Durée estimée :** 15 à 30 minutes.

### Étape 4.1 — Arrêter l'application

```bash
pm2 stop apex-api
```

**Pourquoi ?** Si l'application continue de tourner pendant la
restauration, elle pourrait écrire dans la base et créer des incohérences.
On la met en pause pendant l'opération.

**Ce que tu dois voir :** une ligne disant `[PM2] Applying action stopProcessId on app [apex-api]` puis le tableau pm2 avec `status: stopped`.

**Effet utilisateur :** pendant cette pause, les utilisateurs verront
un message d'erreur 502 ou « site indisponible ». Préviens-les **avant**
si possible (cf. checklist §8).

### Étape 4.2 — Sauvegarder l'état actuel (filet de sécurité)

Avant d'écraser la base, on prend une dernière photo de l'état actuel —
au cas où on changerait d'avis ou qu'on aurait besoin de comparer.

```bash
cd /opt/apex/backend
BACKUP_DIR=/var/backups/apex ./scripts/backup-db.sh
```

**Ce que ça fait :** lance manuellement le script de sauvegarde et
crée un nouveau `.sql.gz` daté de maintenant.

**Ce que tu dois voir :** des lignes du type :
```
🔄 Sauvegarde apex en cours…
✅ Sauvegarde réussie : /var/backups/apex/apex_2026-05-30_1430.sql.gz (412K)
```

Renomme ce backup pour ne pas le confondre avec les sauvegardes
automatiques :

```bash
mv /var/backups/apex/apex_$(date +%Y-%m-%d)_$(date +%H%M)*.sql.gz \
   /var/backups/apex/AVANT-RESTAURATION_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Étape 4.3 — Lancer la restauration en mode test (sans rien écraser)

D'abord, simule la restauration pour vérifier que tout va bien :

```bash
cd /opt/apex/backend
./scripts/restore.sh /var/backups/apex/apex_2026-05-30_0300.sql.gz --dry-run
```

**Ce que ça fait :** le flag `--dry-run` (essai à blanc) vérifie
l'intégrité du fichier et simule la restauration, **sans toucher à la
base de prod**. C'est le test final avant le vrai run.

**Ce que tu dois voir :** un message confirmant que le backup est
valide, sans aucune erreur SQL.

**Si tu vois des erreurs** : ce backup est cassé ou incompatible avec
le schéma actuel. Reviens à l'étape 3.4 avec un autre backup.

### Étape 4.4 — Restauration réelle

⚠️ **ATTENTION** : à partir d'ici, la base de prod va être écrasée.

```bash
./scripts/restore.sh /var/backups/apex/apex_2026-05-30_0300.sql.gz
```

**Ce que ça fait :**
1. Vide la base actuelle (drop des tables)
2. Recrée le schéma à partir du backup
3. Réinjecte toutes les données du backup

**Ce que tu dois voir :** une cascade de `CREATE TABLE`, `COPY`, etc.,
sans erreur. Dure 30 secondes à quelques minutes selon la taille.

**Si une erreur survient** : le backup est probablement incompatible
avec la version actuelle du schéma (le code a évolué depuis). Restaure
le backup de l'étape 4.2 (l'état d'avant la restauration) et contacte
le développeur.

### Étape 4.5 — Vérifier la base restaurée

```bash
source <(grep '^DB_PASSWORD=' /opt/apex/backend/.env)
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U apex -d apex -c "SELECT (SELECT COUNT(*) FROM utilisateurs) AS users, (SELECT COUNT(*) FROM entreprises) AS entreprises, (SELECT COUNT(*) FROM factures) AS factures;"
```

**Ce que ça fait :** compte les utilisateurs, entreprises et factures
dans la base restaurée.

**Ce que tu dois voir :** des nombres cohérents avec ce que tu sais
de ton activité (ex. 12 utilisateurs, 5 entreprises, 230 factures).
S'ils sont à zéro partout : la restauration n'a pas réinjecté les
données, recommence avec un autre backup.

### Étape 4.6 — Relancer l'application

```bash
pm2 start apex-api
pm2 status
```

**Ce que tu dois voir :** le tableau pm2 avec `apex-api` en `online`,
2 instances (cluster), pas de redémarrage en boucle.

### Étape 4.7 — Vérifier que l'application répond

```bash
curl -s http://127.0.0.1:5000/health/deep
```

**Ce que ça fait :** demande à l'application un rapport de santé
complet incluant la base de données.

**Ce que tu dois voir :** du JSON avec `"db":"OK"` et `"status":"OK"`.

### Étape 4.8 — Test final depuis ton ordinateur

Quitte le serveur (`exit`) et depuis ton poste local :

```bash
~/Téléchargements/ComptaWest-master/scripts/smoke-prod.sh
```

**Ce que ça fait :** lance une batterie de tests end-to-end depuis
l'extérieur (DNS, certificats TLS, accès SPA, accès API).

**Ce que tu dois voir :** un panneau vert « Smoke test OK ».

### Étape 4.9 — Tester dans le navigateur

Va sur https://app.useapex.ci et :
- Connecte-toi avec ton compte super-admin
- Vérifie que tes entreprises sont là
- Ouvre une facture, vérifie qu'elle s'affiche
- Vérifie que la console `/admin` affiche les bons KPIs

**Si tout est OK** : la restauration est réussie. Passe à la
[checklist §8](#8-après-chaque-restauration) pour finaliser.

---

## 5. Scénario B — Restauration sur un nouveau serveur

**À utiliser quand :** le VPS d'origine est totalement perdu
(disque mort, datacenter détruit, compte supprimé, etc.) ou injoignable
en SSH depuis plus de 30 minutes sans cause connue.

**Durée estimée :** 45 à 90 minutes.

### Étape 5.1 — Provisionner un nouveau VPS

1. Connecte-toi à Hetzner Cloud (ou autre fournisseur compatible Debian 13)
2. Crée un nouveau VPS avec **Debian 13** (Trixie), 2 vCPU minimum, 4 Go RAM
3. Note l'IP publique du nouveau serveur (ex. `91.99.123.45`)
4. Ajoute ta clé SSH publique au compte au moment de la création
5. Connecte-toi : `ssh root@<nouvelle_IP>`

### Étape 5.2 — Créer l'utilisateur `apex`

```bash
adduser apex
usermod -aG sudo apex
mkdir -p /home/apex/.ssh
cp ~/.ssh/authorized_keys /home/apex/.ssh/authorized_keys
chown -R apex:apex /home/apex/.ssh
chmod 700 /home/apex/.ssh && chmod 600 /home/apex/.ssh/authorized_keys
```

**Ce que ça fait :** crée le compte `apex` (notre utilisateur principal)
avec accès sudo et SSH.

### Étape 5.3 — Lancer le script d'installation initiale

Toujours en root sur le nouveau serveur, télécharge le script
d'installation et lance-le :

```bash
curl -fsSL https://raw.githubusercontent.com/OuattaraTech/ComptaWest/master/scripts/bootstrap-vps.sh \
  -o /tmp/bootstrap-vps.sh
bash /tmp/bootstrap-vps.sh
```

**Ce que ça fait :** installe Node.js, PostgreSQL, Caddy, pm2, fail2ban,
UFW, configure le swap et les dossiers nécessaires. Voir le détail dans
[`docs/DEPLOIEMENT.md`](DEPLOIEMENT.md).

**Durée :** 5-10 minutes.

**Ce que tu dois voir :** une suite de `[ok] ...` verts, puis un
récapitulatif à la fin.

### Étape 5.4 — Cloner le code source

```bash
su - apex
cd /opt/apex
git clone --branch master --single-branch \
  https://github.com/OuattaraTech/ComptaWest.git .
```

**Ce que ça fait :** récupère la dernière version du code sur ce
nouveau serveur.

### Étape 5.5 — Recréer le fichier `.env`

```bash
cd /opt/apex/backend
cp .env.example .env
nano .env
```

**Que mettre dedans ?** Voir [`docs/DEPLOIEMENT.md`](DEPLOIEMENT.md)
section 3. Les valeurs critiques à retrouver depuis ton gestionnaire
de mots de passe :
- `DB_PASSWORD` : à régénérer (cf. ALTER USER ci-dessous)
- `JWT_SECRET` : à régénérer (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `RESEND_API_KEY`, `SENTRY_DSN`, `MISTRAL_API_KEY` : si tu les as,
  recopie-les ; sinon laisse vides pour l'instant

Génère un nouveau mot de passe PG et applique-le :

```bash
NEW_PG_PWD=$(openssl rand -base64 32 | tr -d '/+=')
echo "▶ Note ce mot de passe : $NEW_PG_PWD"
sudo -u postgres psql -c "ALTER USER apex WITH PASSWORD '$NEW_PG_PWD';"
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$NEW_PG_PWD|" /opt/apex/backend/.env
```

### Étape 5.6 — Installer les dépendances

```bash
cd /opt/apex/backend
npm ci --omit=dev
```

**Durée :** 1-2 minutes selon le débit du serveur.

### Étape 5.7 — Configurer l'accès à Cloudflare R2

```bash
mkdir -p ~/.aws && chmod 700 ~/.aws
nano ~/.aws/credentials
```

Dans nano, colle :
```
[r2]
aws_access_key_id = <ton_access_key_R2>
aws_secret_access_key = <ton_secret_key_R2>
```

Sauve (`Ctrl+O` puis `Enter`, `Ctrl+X` pour quitter).

```bash
chmod 600 ~/.aws/credentials
nano ~/.aws/config
```

Dans nano, colle :
```
[profile r2]
region = auto
output = json
```

Et sauve.

```bash
chmod 600 ~/.aws/config

sudo bash -c 'echo "R2_ENDPOINT=https://<ton-account-id>.r2.cloudflarestorage.com" > /etc/default/apex-backup'
```

### Étape 5.8 — Télécharger le dernier backup depuis R2

```bash
mkdir -p /var/backups/apex
source /etc/default/apex-backup
aws s3 sync s3://apex-backups-prod/ /var/backups/apex/ \
  --profile r2 --endpoint-url "$R2_ENDPOINT"

ls -lh /var/backups/apex/
```

**Ce que tu dois voir :** les 30 backups les plus récents copiés
localement.

### Étape 5.9 — Restaurer le backup choisi

```bash
cd /opt/apex/backend
./scripts/restore.sh /var/backups/apex/apex_2026-05-30_0300.sql.gz --dry-run
./scripts/restore.sh /var/backups/apex/apex_2026-05-30_0300.sql.gz
```

(Étapes identiques à 4.3 et 4.4 du Scénario A.)

### Étape 5.10 — Démarrer pm2 et Caddy

```bash
cd /opt/apex/backend
pm2 start ecosystem.config.js --env production
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u apex --hp /home/apex
# Exécute la commande sudo affichée par pm2

sudo cp /opt/apex/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Étape 5.11 — Repointer le DNS sur la nouvelle IP

Va sur Cloudflare → DNS → modifie les 7 enregistrements `A` qui pointaient
vers l'ancienne IP du VPS pour qu'ils pointent vers la nouvelle :

| Enregistrement | Ancienne valeur | Nouvelle valeur |
|---|---|---|
| `useapex.ci` (@) | 178.105.242.7 | <nouvelle_IP> |
| `app` | 178.105.242.7 | <nouvelle_IP> |
| `api` | 178.105.242.7 | <nouvelle_IP> |
| `demo` | 178.105.242.7 | <nouvelle_IP> |
| `cabinet` | 178.105.242.7 | <nouvelle_IP> |
| `docs` | 178.105.242.7 | <nouvelle_IP> |

Propagation : 1 à 5 minutes avec le proxy Cloudflare en ON.

### Étape 5.12 — Test final

Depuis ton poste local :

```bash
~/Téléchargements/ComptaWest-master/scripts/smoke-prod.sh
```

Si tout est vert, tu es de retour en ligne. Le serveur ancien (si encore
en vie) peut être détruit pour ne pas continuer à recevoir du trafic
ou créer de confusion.

---

## 6. Scénario C — Récupérer une seule table

**À utiliser quand :** une seule table a été vidée ou corrompue par
erreur, et tu veux **récupérer juste celle-là** sans perdre les saisies
faites sur les autres tables depuis le backup.

**Exemple concret :** un comptable a supprimé par erreur toutes les
factures d'un client, mais tu ne veux pas perdre les écritures
comptables saisies ailleurs depuis cette nuit.

**Durée estimée :** 20 à 40 minutes.

### Étape 6.1 — Créer une base de données temporaire

```bash
sudo -u postgres createdb apex_restore_temp
```

**Ce que ça fait :** crée une base vide nommée `apex_restore_temp`
sur le même serveur PostgreSQL, à côté de la base de prod.

### Étape 6.2 — Restaurer le backup dans cette base temporaire

```bash
gunzip -c /var/backups/apex/apex_2026-05-30_0300.sql.gz \
  | sudo -u postgres psql -d apex_restore_temp
```

**Ce que ça fait :** décompresse le backup et l'injecte dans la base
temporaire. La base de prod reste **intacte**.

**Durée :** 30 secondes à quelques minutes.

### Étape 6.3 — Extraire la table cible

Exemple pour récupérer la table `factures` :

```bash
sudo -u postgres pg_dump -t factures -t lignes_facture apex_restore_temp \
  > /tmp/factures-restore.sql
```

**Ce que ça fait :** extrait uniquement les tables `factures` et
`lignes_facture` de la base temporaire, dans un petit fichier SQL.

**Adapte les noms** selon ce que tu veux récupérer. Pense aux tables
liées : restaurer `factures` sans `lignes_facture` donnerait des
factures vides.

### Étape 6.4 — Décider de la stratégie d'injection

**Stratégie 1 — Écrasement total des tables cibles**

Risque : tu perds les lignes ajoutées dans ces tables depuis le backup.

```bash
# Sauvegarder l'état actuel des tables cibles
sudo -u postgres pg_dump -t factures -t lignes_facture apex \
  > /tmp/factures-avant-restauration.sql

# Écraser
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U apex -d apex -c "TRUNCATE factures, lignes_facture CASCADE;"
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U apex -d apex -f /tmp/factures-restore.sql
```

**Stratégie 2 — Fusion sans écrasement (INSERT IF NOT EXISTS)**

Plus délicate. À réserver aux développeurs. En général : éditer le
fichier `/tmp/factures-restore.sql` pour transformer les `INSERT INTO`
en `INSERT INTO ... ON CONFLICT (id) DO NOTHING;`.

### Étape 6.5 — Nettoyer la base temporaire

```bash
sudo -u postgres dropdb apex_restore_temp
rm /tmp/factures-restore.sql
```

**Ce que ça fait :** supprime la base temporaire pour libérer l'espace
disque et éviter toute confusion future.

### Étape 6.6 — Vérifier dans l'application

Ouvre https://app.useapex.ci et confirme que les factures sont bien
revenues.

---

## 7. Test mensuel automatique

Un script lance automatiquement, le 1er de chaque mois à 4h00, une
**simulation de restauration** sur une base temporaire pour vérifier
que les backups sont récupérables sans incident.

### Comment ça marche

```
Tous les 1er du mois à 4h00
   │
   ▼
verify-backup.sh
   │
   ├─→ Cherche le backup le plus récent dans /var/backups/apex/
   ├─→ Crée une base de test temporaire
   ├─→ Restaure le backup dedans
   ├─→ Vérifie qu'il y a ≥ 40 tables et que les tables-clés répondent
   ├─→ Détruit la base de test
   └─→ Écrit le résultat dans /var/log/apex-backup-verify.log
```

### Comment vérifier que ça marche

Une fois par mois, ouvre une session SSH sur le serveur et tape :

```bash
tail -30 /var/log/apex-backup-verify.log
```

**Ce que tu dois voir** à la fin du fichier :

```
✓ Tables : 48
✓ Utilisateurs : 12 — Entreprises : 5
✓ Migrations dans schema_migrations : 36

╔══════════════════════════════════════════════╗
║  Backup OK — restaurable et cohérent.        ║
║  Fichier : apex_2026-06-01_0300.sql.gz       ║
║  Date    : 2026-06-01 04:00:42 GMT           ║
╚══════════════════════════════════════════════╝
```

**Si tu vois `✗` ou un encadré rouge** : il y a un problème dans les
backups. Vérifie immédiatement en lançant le test manuel :

```bash
/opt/apex/backend/scripts/verify-backup.sh
```

Et corrige avant le prochain incident réel.

### Lancer le test à la main quand tu veux

À tout moment, tu peux relancer le test manuellement :

```bash
/opt/apex/backend/scripts/verify-backup.sh
```

Pratique après avoir poussé une nouvelle migration ou changé la
configuration des backups.

---

## 8. Après chaque restauration

Une checklist à dérouler systématiquement après toute restauration,
pour s'assurer qu'on n'a rien oublié.

### Communication

- [ ] **Annoncer aux utilisateurs** la fenêtre de données perdues
  (par email, Slack, ou bandeau dans l'app). Sois transparent : « Toutes
  les saisies entre 03h00 et 11h00 du 30 mai sont perdues, merci de
  les ressaisir. »
- [ ] **Logger l'incident** dans un journal interne (date, cause
  présumée, backup utilisé, durée d'indisponibilité, données perdues
  estimées). Garder cet historique aide à comprendre les patterns.

### Investigation racine

- [ ] **Identifier la cause** de l'incident (bug, erreur humaine,
  attaque, panne matérielle). Si la cause reste, l'incident se
  reproduira.
- [ ] **Corriger le bug** ou retirer les permissions de l'utilisateur
  qui a fait l'erreur, **avant** de remettre l'app en production.

### Vérifications post-restauration

- [ ] **Tester un envoi d'email transactionnel** : inviter quelqu'un
  depuis `/admin` → vérifier la réception. Si HS, recharger la clé
  Resend.
- [ ] **Vérifier Sentry** : déclencher une erreur de test, confirmer
  qu'elle apparaît dans le dashboard.
- [ ] **Tester un paiement Mobile Money** (en mode sandbox si possible)
  ou au minimum vérifier que les webhooks Wave/Orange/MTN sont toujours
  accessibles.
- [ ] **Vérifier le cron backup** : `tail /var/log/apex-backup.log` —
  le cron a-t-il tourné ce matin ?
- [ ] **Vérifier la synchro R2** : `aws s3 ls s3://apex-backups-prod/
  --profile r2 --endpoint-url "$R2_ENDPOINT"` — y a-t-il bien un fichier
  daté d'aujourd'hui ou hier ?

### Post-mortem

Dans la semaine qui suit, écris un court rapport interne (1 page)
avec :
- Chronologie de l'incident
- Cause racine identifiée
- Impact (utilisateurs, données, durée)
- Actions correctives mises en place
- Améliorations à apporter pour éviter la récurrence

---

## 9. Glossaire des termes techniques

| Terme | Définition simple |
|---|---|
| **Backup** | Photo complète des données à un instant T, rangée dans un fichier compressé. |
| **Bucket** | Conteneur dans le cloud (R2) où sont stockés les fichiers. Équivalent d'un dossier. |
| **Caddy** | Logiciel qui reçoit les requêtes HTTPS et les redirige vers ApeX. Sert aussi la landing et le SPA. |
| **CASCADE** | Règle SQL qui dit : « si je supprime cette ligne, supprime aussi automatiquement tout ce qui pointe vers elle ». |
| **Cloudflare R2** | Service de stockage cloud de Cloudflare, équivalent d'AWS S3 mais sans frais de sortie. |
| **Cron** | Planificateur de tâches du système Linux. Permet de lancer un script tous les jours à 3h00, par exemple. |
| **Curl** | Petit programme en ligne de commande pour faire des requêtes HTTP. Pratique pour tester. |
| **dry-run** | « Essai à blanc » — exécute le code mais n'écrit rien. Permet de vérifier qu'une commande fonctionne avant de la lancer pour de vrai. |
| **FK / foreign key** | Lien entre deux tables. Ex. la table `factures` a une FK vers `entreprises`, ce qui signifie qu'une facture appartient toujours à une entreprise. |
| **gzip / .gz** | Format de compression. Réduit la taille d'un fichier d'un facteur 5 à 10. |
| **JWT** | Jeton chiffré qui prouve l'identité d'un utilisateur connecté. |
| **pg_dump** | Commande PostgreSQL qui crée un backup (un dump) de la base. |
| **pm2** | Logiciel qui maintient le backend ApeX en vie et le redémarre automatiquement s'il plante. |
| **PostgreSQL / PG** | La base de données utilisée par ApeX. |
| **psql** | Le client en ligne de commande pour interroger PostgreSQL. |
| **rsync** | Outil pour copier des fichiers d'une machine à une autre en ne transférant que les différences. |
| **schema_migrations** | Table technique qui garde la trace des migrations SQL déjà appliquées. |
| **SPA** | Single Page Application — l'application React buildée qu'on sert sur `app.useapex.ci`. |
| **SSH** | Protocole pour se connecter à distance à un serveur. |
| **TLS / HTTPS** | Chiffrement de la connexion entre le navigateur et le serveur. Le petit cadenas vert. |
| **VPS** | Virtual Private Server — un serveur loué chez Hetzner / OVH / etc. |
