# ComptaWest 🌍₣ — v2.1
> Logiciel de comptabilité full-stack pour PME d'Afrique de l'Ouest  
> Stack : **React 18 + Vite** · **Node.js / Express** · **PostgreSQL**  
> Normes **SYSCOHADA** · Devise **FCFA** · Multi-entreprise · Multi-utilisateur

---

## 📋 Table des matières

1. [Présentation](#1-présentation)
2. [Fonctionnalités](#2-fonctionnalités)
3. [Architecture](#3-architecture)
4. [Prérequis](#4-prérequis)
5. [Installation locale](#5-installation-locale)
6. [Variables d'environnement](#6-variables-denvironnement)
7. [Base de données](#7-base-de-données)
8. [Lancer le projet](#8-lancer-le-projet)
9. [Compte de démonstration](#9-compte-de-démonstration)
10. [Routes API](#10-routes-api)
11. [Rôles et permissions](#11-rôles-et-permissions)
12. [Déploiement en production](#12-déploiement-en-production)
13. [Configuration HTTPS / Nginx](#13-configuration-https--nginx)
14. [Sécurité](#14-sécurité)
15. [Sauvegardes](#15-sauvegardes)
16. [Dépannage](#16-dépannage)
17. [Corrections v2.1](#17-corrections-v21)

---

## 1. Présentation

ComptaWest est une application web de gestion comptable pour les PME d'Afrique de l'Ouest et la diaspora. Elle respecte les normes **SYSCOHADA** et gère les obligations fiscales locales (DGI, CNSS, TVA 18 %).

**Fonctions principales :**
- Gérer plusieurs entreprises depuis un seul compte
- Émettre des factures, devis et avoirs avec export PDF
- Suivre les dépenses par catégories SYSCOHADA (codes 60-67)
- Déclarer et suivre les taxes : TVA, IS, BIC, CNSS, CMU, IRVM, Patente
- Calculer automatiquement la TVA nette à verser à la DGI
- Inviter des collaborateurs avec rôles distincts
- Visualiser les KPIs sur des graphiques interactifs

---

## 2. Fonctionnalités

### 🏢 Multi-entreprise
- Un utilisateur peut créer et gérer **plusieurs entreprises**
- Switcher d'entreprise dans la sidebar sans se déconnecter
- Rôles par entreprise : `proprietaire | admin | comptable | user | lecture`
- Invitation de collaborateurs par email
- 10 catégories SYSCOHADA créées automatiquement à la création

### 📊 Tableau de bord
- KPIs : CA, Dépenses, Taxes dues, Bénéfice net, Clients actifs
- Graphique d'évolution mensuelle (recettes / dépenses / bénéfice)
- Répartition des charges par catégorie (camembert)
- Top 5 clients par CA · Alertes factures en retard et taxes dues

### 🧾 Factures
- Types : Facture, Devis, Avoir, Proforma
- Numérotation automatique (F-2026-001, D-2026-001…)
- Calcul automatique TVA, remises par ligne
- Suivi des paiements partiels · Export PDF professionnel
- Statuts : Brouillon → Envoyée → Payée / Retard / Annulée

### 👥 Clients
- Fiche complète : NINEA, RCCM, coordonnées
- Code client auto (CLI-001, CLI-002…)
- Historique des factures + CA total par client

### 💸 Dépenses
- Saisie HT + TVA → calcul TTC automatique
- 10 catégories SYSCOHADA prédéfinies (codes 60-67)
- Catégories personnalisées · Modes de paiement multiples

### 🧮 Taxes & Impôts

| Taxe | Taux | Organisme |
|------|------|-----------|
| TVA | 18 % | DGI |
| IS | 25 % | DGI |
| BIC | 20 % | DGI |
| CNSS (patronale) | 14 % | CNSS |
| CMU | 3,5 % | CNSS |
| IRVM | 15 % | DGI |
| Patente | 0,5 % | DGI |

- Calculateur TVA automatique : collectée − déductible = nette à verser
- Alertes échéances 30 jours à l'avance · Marquage automatique « en retard »

### 📈 Rapports
- Bilan annuel complet (recettes, dépenses, taxes, résultat net)
- Compte de résultat mensuel · Synthèse fiscale · Export PDF factures

---

## 3. Architecture

```
comptawest/
├── README.md
├── backend/                          # API Node.js / Express
│   ├── .env.example                  # Modèle config (jamais commiter .env !)
│   ├── .gitignore
│   ├── package.json
│   ├── config/
│   │   ├── database.js               # Pool PostgreSQL
│   │   └── schema_v2.sql             # Schéma BDD + données démo
│   └── src/
│       ├── index.js                  # Point d'entrée Express
│       ├── routes/index.js           # Toutes les routes /api
│       ├── middleware/
│       │   ├── auth.js               # Vérification JWT
│       │   ├── entreprise.js         # Contrôle accès + rôles
│       │   └── validate.js           # Validation express-validator
│       ├── utils/
│       │   └── helpers.js            # Fonctions partagées (catégories SYSCOHADA)
│       └── controllers/
│           ├── authController.js
│           ├── entreprisesController.js
│           ├── clientsController.js
│           ├── facturesController.js
│           ├── depensesController.js
│           ├── taxesController.js
│           ├── dashboardController.js
│           └── rapportsController.js
│
└── frontend/                         # Application React (Vite)
    ├── index.html
    ├── package.json
    ├── vite.config.js                # Proxy /api → backend
    └── src/
        ├── main.jsx
        ├── App.jsx                   # Routes + guards auth
        ├── hooks/
        │   ├── useAuth.jsx           # Contexte authentification
        │   └── useEntreprise.jsx     # Contexte multi-entreprise
        ├── utils/
        │   ├── api.jsx               # Client Axios + intercepteurs
        │   ├── helpers.jsx           # Formatage FCFA, dates, badges
        │   └── theme.js             # Palette couleurs partagée
        ├── components/Layout/
        │   ├── Layout.jsx
        │   └── Sidebar.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── ClientsPage.jsx
            ├── FacturesPage.jsx
            ├── DepensesPage.jsx
            ├── TaxesPage.jsx
            ├── RapportsPage.jsx
            └── ParametresPage.jsx
```

---

## 4. Prérequis

| Outil | Version minimale | Vérification |
|-------|-----------------|--------------|
| Node.js | 18.x LTS | `node --version` |
| npm | 9.x | `npm --version` |
| PostgreSQL | 14.x | `psql --version` |
| Python | 3.8+ | `python3 --version` |
| ReportLab | 3.6+ | `python3 -c "import reportlab"` |

### Ubuntu / Debian

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Python + ReportLab
sudo apt-get install -y python3 python3-pip
pip3 install reportlab --break-system-packages
```

### macOS

```bash
brew install node postgresql@16 python3
brew services start postgresql@16
pip3 install reportlab
```

### Windows

1. [Node.js LTS](https://nodejs.org)
2. [PostgreSQL](https://www.postgresql.org/download/windows/)
3. [Python 3](https://www.python.org/downloads/)
4. Dans un terminal : `pip install reportlab`

---

## 5. Installation locale

### Étape 1 — Extraire le projet

```bash
unzip comptawest.zip
cd comptawest
```

### Étape 2 — Dépendances backend

```bash
cd backend
npm install
```

### Étape 3 — Dépendances frontend

```bash
cd ../frontend
npm install
```

### Étape 4 — ReportLab (génération PDF)

```bash
pip3 install reportlab
# Sur Linux récent :
pip3 install reportlab --break-system-packages
```

---

## 6. Variables d'environnement

### Créer le fichier `.env` dans `backend/`

```bash
cd backend
cp .env.example .env
nano .env   # ou code .env
```

### Contenu du `.env`

```env
# ── Serveur ─────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── PostgreSQL ───────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_NAME=comptawest
DB_USER=postgres
DB_PASSWORD=VotreMotDePassePostgres

# ── JWT ──────────────────────────────────────────
# Générer : node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=votre_cle_secrete_64_caracteres_minimum
JWT_EXPIRES_IN=7d

# ── CORS ─────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
```

### ⚠️ Règle absolue

**Ne jamais commiter le fichier `.env`** — il contient vos secrets.  
Le `.gitignore` le protège déjà. Vérifiez avant tout `git add` :

```bash
git status  # .env ne doit PAS apparaître
```

### Générer un JWT_SECRET sécurisé

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 7. Base de données

### Créer la base

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE comptawest;
CREATE USER comptawest_user WITH ENCRYPTED PASSWORD 'MotDePasseFort!';
GRANT ALL PRIVILEGES ON DATABASE comptawest TO comptawest_user;
\q
```

Mettre à jour `.env` avec ces identifiants.

### Initialiser le schéma + données de démo

```bash
cd backend
psql -U postgres -d comptawest -f config/schema_v2.sql
```

**Ce que le schéma crée :**
- 10 tables : `utilisateurs`, `entreprises`, `membres_entreprise`, `clients`, `factures`, `lignes_facture`, `depenses`, `categories_depenses`, `declarations_taxes`, `paiements`
- Tous les index de performance
- Utilisateur démo : `demo@comptawest.ci` / `demo123`
- 2 entreprises démo avec clients, factures, dépenses et taxes d'exemple

### Vérifier l'installation

```bash
psql -U postgres -d comptawest -c "\dt"
# Doit lister les 10 tables
```

---

## 8. Lancer le projet

**Terminal 1 — Backend :**
```bash
cd backend
npm run dev
# → 🚀 ComptaWest API v2.1 → http://localhost:5000
# → ✅ PostgreSQL connecté
```

**Terminal 2 — Frontend :**
```bash
cd frontend
npm run dev
# → Local: http://localhost:5173
```

Ouvrir **http://localhost:5173** dans le navigateur.

### Vérifier l'API

```bash
curl http://localhost:5000/health
# {"status":"OK","app":"ComptaWest API v2","version":"2.1.0"}
```

---

## 9. Compte de démonstration

| Champ | Valeur |
|-------|--------|
| Email | `demo@comptawest.ci` |
| Mot de passe | `demo123` |
| Entreprise 1 | Ouattara & Associés |
| Entreprise 2 | dev225 Technologies |
| Données | Clients, factures, dépenses et taxes préconfigurés |

> **Note :** Le mot de passe `demo123` ne respecte pas la règle des 8 caractères imposée à l'inscription. Ce compte démo existe uniquement via le schéma SQL. Pour un compte réel, utilisez l'inscription avec un mot de passe ≥ 8 caractères.

---

## 10. Routes API

Toutes les routes commencent par `/api`.

Les routes protégées nécessitent :
- `Authorization: Bearer <token_jwt>`
- `X-Entreprise-Id: <uuid_entreprise>`

### Authentification
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/register` | Non | Créer un compte (+ entreprise auto) |
| POST | `/api/auth/login` | Non | Se connecter |
| GET | `/api/auth/me` | Oui | Profil utilisateur |

> ⚠️ Les routes `/auth/register` et `/auth/login` sont limitées à **10 tentatives / 15 min** par IP.

### Entreprises
| Méthode | Route | Rôle requis | Description |
|---------|-------|-------------|-------------|
| GET | `/api/entreprises` | Connecté | Mes entreprises |
| POST | `/api/entreprises` | Connecté | Créer une entreprise |
| PUT | `/api/entreprises/:id` | Proprio/Admin | Modifier |
| GET | `/api/entreprises/:id/membres` | Tous | Liste membres |
| POST | `/api/entreprises/:id/membres` | Admin+ | Inviter |
| PUT | `/api/entreprises/:id/membres/:userId/role` | Admin+ | Changer rôle |
| DELETE | `/api/entreprises/:id/membres/:userId` | Admin+ | Retirer |

### Dashboard
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/dashboard/stats?annee=2026` | KPIs et statistiques |
| GET | `/api/dashboard/transactions-recentes` | Dernières transactions |

### Clients
| Méthode | Route | Rôle requis | Description |
|---------|-------|-------------|-------------|
| GET | `/api/clients` | Tous | Liste (search, pagination) |
| GET | `/api/clients/:id` | Tous | Détail + factures |
| POST | `/api/clients` | Comptable+ | Créer |
| PUT | `/api/clients/:id` | Comptable+ | Modifier |
| DELETE | `/api/clients/:id` | Admin+ | Archiver |

### Factures
| Méthode | Route | Rôle requis | Description |
|---------|-------|-------------|-------------|
| GET | `/api/factures` | Tous | Liste (filtres, pagination) |
| GET | `/api/factures/:id` | Tous | Détail + lignes + paiements |
| POST | `/api/factures` | Comptable+ | Créer avec lignes |
| PUT | `/api/factures/:id/statut` | Comptable+ | Changer statut |
| POST | `/api/factures/:id/paiement` | Comptable+ | Enregistrer paiement |
| DELETE | `/api/factures/:id` | Admin+ | Supprimer (brouillon only) |

### Dépenses
| Méthode | Route | Rôle requis | Description |
|---------|-------|-------------|-------------|
| GET | `/api/depenses` | Tous | Liste (filtres) |
| GET | `/api/depenses/stats?annee=2026` | Tous | Stats mensuelles/catégories |
| GET | `/api/depenses/categories` | Tous | Catégories SYSCOHADA |
| POST | `/api/depenses/categories` | Comptable+ | Créer catégorie |
| POST | `/api/depenses` | Comptable+ | Créer dépense |
| PUT | `/api/depenses/:id` | Comptable+ | Modifier |
| DELETE | `/api/depenses/:id` | Admin+ | Supprimer |

### Taxes
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/taxes` | Liste des déclarations |
| GET | `/api/taxes/tableau-de-bord?annee=2026` | Synthèse fiscale |
| GET | `/api/taxes/calculer-tva?periode_debut=...&periode_fin=...` | Calcul TVA auto |
| POST | `/api/taxes` | Créer déclaration |
| POST | `/api/taxes/:id/paiement` | Enregistrer paiement |

### Rapports
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/rapports/bilan?annee=2026` | Bilan annuel complet |
| GET | `/api/rapports/facture/:id/pdf` | Télécharger facture PDF |

---

## 11. Rôles et permissions

| Rôle | Consultation | Création/Modif | Suppression | Gestion membres |
|------|:---:|:---:|:---:|:---:|
| `proprietaire` | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ (sauf proprio) |
| `comptable` | ✅ | ✅ | ❌ | ❌ |
| `user` | ✅ | ✅ (limité) | ❌ | ❌ |
| `lecture` | ✅ | ❌ | ❌ | ❌ |

---

## 12. Déploiement en production

### Option A — VPS Ubuntu (recommandé)

**Prérequis :** Contabo, OVH, DigitalOcean, Hetzner — 4–10 €/mois

#### A1. Préparer le serveur

```bash
ssh root@VOTRE_IP_VPS

apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx ufw python3 python3-pip unzip

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PostgreSQL
apt install -y postgresql postgresql-contrib

# ReportLab
pip3 install reportlab --break-system-packages

# PM2
npm install -g pm2
```

#### A2. PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE comptawest;
CREATE USER comptawest_user WITH ENCRYPTED PASSWORD 'MotDePasseTresfort2024!';
GRANT ALL PRIVILEGES ON DATABASE comptawest TO comptawest_user;
\q
```

#### A3. Déployer le projet

```bash
# Depuis votre machine locale
scp comptawest.zip root@VOTRE_IP:/var/www/

# Sur le serveur
cd /var/www
unzip comptawest.zip
cd comptawest
```

#### A4. Configurer le backend

```bash
cd /var/www/comptawest/backend
npm install --production

# Créer le .env de production
nano .env
```

```env
PORT=5000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=comptawest
DB_USER=comptawest_user
DB_PASSWORD=MotDePasseTresfort2024!
JWT_SECRET=GENEREZ_UNE_CLE_64_CHARS_ICI
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://votre-domaine.com
```

```bash
# Initialiser la BDD
psql -U comptawest_user -d comptawest -f config/schema_v2.sql
```

#### A5. Lancer avec PM2

```bash
cd /var/www/comptawest/backend
pm2 start src/index.js --name "comptawest-api"
pm2 save
pm2 startup
# Exécuter la commande affichée
```

#### A6. Builder le frontend

```bash
cd /var/www/comptawest/frontend
npm install

# Créer la config de production
echo "VITE_API_URL=https://votre-domaine.com/api" > .env.production

npm run build
# Fichiers générés dans frontend/dist/
```

---

### Option B — Railway (déploiement rapide)

**Coût :** Gratuit jusqu'à 500h/mois, puis ~5 $/mois

#### B1. Pousser sur GitHub

```bash
cd comptawest
git init
echo ".env" >> .gitignore
echo "node_modules/" >> .gitignore
git add .
git commit -m "ComptaWest v2.1 initial"
git remote add origin https://github.com/votre-user/comptawest.git
git push -u origin main
```

#### B2. Backend sur Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Sélectionner votre dépôt → **Root Directory : `backend`**
3. Railway détecte Node.js automatiquement

#### B3. PostgreSQL sur Railway

1. **New Service → Database → PostgreSQL**
2. Copier les variables de connexion

#### B4. Variables d'environnement Railway

Dans **Settings → Variables** du service backend :

```
PORT=5000
NODE_ENV=production
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
JWT_SECRET=votre_cle_64_chars
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://votre-frontend.vercel.app
```

#### B5. Frontend sur Vercel

```bash
cd frontend
npm install -g vercel
echo "VITE_API_URL=https://votre-backend.up.railway.app/api" > .env.production
npm run build
vercel --prod
```

---

### Option C — Render.com (gratuit avec limitations)

**Coût :** Gratuit (mise en veille après 15 min), puis ~7 $/mois

#### C1. Backend sur Render

1. [render.com](https://render.com) → **New → Web Service**
2. Connecter GitHub → Root Directory : `backend`
3. Build Command : `npm install` · Start Command : `node src/index.js`
4. Ajouter les variables d'environnement

#### C2. Base de données Render

1. **New → PostgreSQL** → noter l'**Internal Database URL**
2. Initialiser : `psql "INTERNAL_DATABASE_URL" -f backend/config/schema_v2.sql`

#### C3. Frontend sur Netlify

```bash
cd frontend
npm install -g netlify-cli
echo "VITE_API_URL=https://votre-backend.onrender.com/api" > .env.production
npm run build
netlify deploy --prod --dir=dist
```

---

## 13. Configuration HTTPS / Nginx

### Fichier Nginx

```bash
nano /etc/nginx/sites-available/comptawest
```

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    # Frontend React (fichiers statiques)
    location / {
        root /var/www/comptawest/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API Backend (reverse proxy)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        client_max_body_size 10M;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000/health;
        proxy_set_header Host $host;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/comptawest /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### SSL avec Let's Encrypt

```bash
certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
# Choisir option 2 (redirect HTTP → HTTPS)
certbot renew --dry-run  # Tester le renouvellement auto
```

### Pare-feu

```bash
ufw allow ssh
ufw allow 'Nginx Full'
ufw deny 5000        # Bloquer l'accès direct au port Node.js
ufw enable
```

---

## 14. Sécurité

### Ce qui est implémenté dans le code

| Mesure | Détail |
|--------|--------|
| **Helmet.js** | En-têtes HTTP de sécurité (CSP, HSTS, X-Frame…) |
| **Rate limiting global** | 300 req / 15 min par IP |
| **Rate limiting auth** | 10 tentatives / 15 min sur `/auth/login` et `/auth/register` (échecs uniquement) |
| **CORS strict** | Seul le domaine frontend autorisé |
| **JWT** | Tokens signés, expiration configurable |
| **Bcrypt** | Mots de passe hashés avec 12 rounds |
| **Validation des inputs** | `express-validator` sur toutes les routes d'écriture |
| **Isolation multi-tenant** | `entreprise_id` vérifié en DB à chaque requête |
| **UUID validation** | Le middleware entreprise vérifie le format UUID |
| **SQL paramétré** | Toutes les requêtes utilisent `$1, $2…` (zéro injection SQL) |
| **Mot de passe min 8 chars** | Côté backend ET frontend |
| **deleteFacture sécurisé** | Renvoie 404 si la facture n'existe pas ou n'est pas en brouillon |
| **addPaiement sécurisé** | Vérifie que le montant ne dépasse pas le TTC, refuse sur facture annulée |
| **execFileSync sécurisé** | Arguments en tableau (jamais interpolés dans un shell) |

### Checklist avant mise en production

```bash
# 1. Générer un JWT_SECRET fort
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 2. Mot de passe PostgreSQL fort
openssl rand -base64 24

# 3. Vérifier que .env n'est PAS dans git
git ls-files backend/.env  # Doit retourner vide

# 4. NODE_ENV=production
# (désactive les messages d'erreur détaillés dans les réponses API)

# 5. Port 5000 fermé publiquement
ufw deny 5000
```

---

## 15. Sauvegardes

### Script automatique

```bash
nano /usr/local/bin/backup-comptawest.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/comptawest"
mkdir -p $BACKUP_DIR

pg_dump -U comptawest_user comptawest | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Garder seulement les 30 dernières sauvegardes
ls -t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +31 | xargs -r rm

echo "✅ Sauvegarde : backup_$DATE.sql.gz"
```

```bash
chmod +x /usr/local/bin/backup-comptawest.sh

# Automatiser : tous les jours à 2h du matin
crontab -e
# Ajouter :
0 2 * * * /usr/local/bin/backup-comptawest.sh >> /var/log/backup-comptawest.log 2>&1
```

### Restaurer une sauvegarde

```bash
gunzip -c /var/backups/comptawest/backup_20260101_020000.sql.gz \
  | psql -U comptawest_user -d comptawest
```

### Mettre à jour l'application

```bash
cd /var/www/comptawest

# 1. Sauvegarder d'abord
/usr/local/bin/backup-comptawest.sh

# 2. Déployer le nouveau code
unzip -o comptawest_new.zip

# 3. Backend
cd backend && npm install --production
pm2 restart comptawest-api

# 4. Frontend
cd ../frontend && npm install && npm run build

# 5. Recharger Nginx
systemctl reload nginx
```

---

## 16. Dépannage

### « Cannot connect to database »

```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
psql -U comptawest_user -d comptawest -c "SELECT 1;"
cat backend/.env | grep DB_
```

### « Token expiré ou invalide »

```bash
# Vérifier que JWT_SECRET est défini
cat backend/.env | grep JWT_SECRET

# Générer une nouvelle clé
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Mettre à jour .env puis redémarrer
pm2 restart comptawest-api
```

### « Erreur génération PDF »

```bash
python3 --version
python3 -c "import reportlab; print('ReportLab OK:', reportlab.Version)"
pip3 install reportlab --break-system-packages
```

### Frontend ne se connecte pas à l'API

```bash
# Développement : vérifier le proxy vite.config.js
# Production : vérifier Nginx
nginx -t
curl http://localhost:5000/health

# Vérifier les logs PM2
pm2 logs comptawest-api --lines 50
```

### Port 5000 déjà utilisé

```bash
lsof -i :5000
kill -9 PID
# Ou changer PORT dans .env et relancer
```

### Réinitialiser la base de données (⚠️ supprime tout)

```bash
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS comptawest;
CREATE DATABASE comptawest;
GRANT ALL PRIVILEGES ON DATABASE comptawest TO comptawest_user;
EOF

psql -U comptawest_user -d comptawest -f backend/config/schema_v2.sql
pm2 restart comptawest-api
```

---

## 17. Corrections v2.1

Cette version corrige tous les problèmes identifiés lors de l'audit de sécurité :

| # | Problème | Correction |
|---|----------|-----------|
| 1 | `.env` avec vrais secrets partagé | `.env` supprimé du projet, uniquement `.env.example` |
| 2 | Rate limiting absent sur `/auth/login` | Rate limiter dédié : 10 tentatives/15min, échecs seulement |
| 3 | Année 2024 codée en dur | `useState(String(new Date().getFullYear()))` + liste dynamique |
| 4 | `deleteFacture` retournait toujours `success: true` | Vérifie `result.rowCount`, renvoie 404 si 0 ligne |
| 5 | Race condition numérotation factures | `SELECT FOR UPDATE` sur le compteur |
| 6 | Aucune validation des inputs backend | `express-validator` sur toutes les routes d'écriture |
| 7 | Catégories SYSCOHADA créées en double | Helper `creerCategoriesDefaut()` partagé |
| 8 | `execSync` avec interpolation shell (risque injection) | Remplacé par `execFileSync('python3', [args...])` |
| 9 | `process.exit(-1)` sur erreur DB temporaire | Log uniquement, le pool gère la reconnexion |
| 10 | Mot de passe min 6 chars (trop faible) | Minimum 8 chars côté backend ET frontend |
| 11 | `addPaiement` sans vérification du montant | Vérifie montant > 0, refuse si > TTC, refuse si annulée |
| 12 | Catch silencieux dans le frontend | Toasts d'erreur sur toutes les pages |
| 13 | Palette couleurs dupliquée dans chaque page | Fichier `src/utils/theme.js` centralisé |
| 14 | Fichiers temporaires PDF non nettoyés en cas d'erreur | Bloc `finally` garantit le nettoyage |
| 15 | Bcrypt 10 rounds (minimum recommandé) | Passé à 12 rounds |

---

## 📊 Résumé des ports et URLs

| Service | Développement | Production |
|---------|--------------|------------|
| Frontend React | http://localhost:5173 | https://votre-domaine.com |
| Backend API | http://localhost:5000 | https://votre-domaine.com/api |
| PostgreSQL | localhost:5432 | localhost:5432 (interne) |
| Health check | http://localhost:5000/health | https://votre-domaine.com/health |

---

*Développé par **dev225** 🇨🇮 — Abidjan, Côte d'Ivoire*  
*ComptaWest v2.1 · SYSCOHADA · FCFA*
