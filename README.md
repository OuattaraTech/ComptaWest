# ApeX 🌍₣ — v2.6
> Logiciel de gestion pour PME d'Afrique de l'Ouest (ex-ComptaWest, renommé ApeX en mai 2026)
> Stack : **React 18 + Vite** · **Node.js / Express** · **PostgreSQL 14+**
> Normes **SYSCOHADA** · Devise **FCFA** · **FNE certifié DGI Côte d'Ivoire** · Multi-entreprise · Multi-utilisateur

---

## 📋 Table des matières

1. [Présentation](#1-présentation)
2. [Fonctionnalités](#2-fonctionnalités)
3. [Architecture](#3-architecture)
4. [Prérequis](#4-prérequis)
5. [Installation locale](#5-installation-locale)
6. [Variables d'environnement](#6-variables-denvironnement)
7. [Base de données](#7-base-de-données)
8. [Migrations BDD (système de versions)](#8-migrations-bdd-système-de-versions)
9. [Lancer le projet](#9-lancer-le-projet)
10. [Compte de démonstration](#10-compte-de-démonstration)
11. [Routes API](#11-routes-api)
12. [Rôles et permissions](#12-rôles-et-permissions)
13. [🚀 Déploiement en production — guide pas-à-pas](#13--déploiement-en-production--guide-pas-à-pas)
14. [Mise à jour d'une instance existante](#14-mise-à-jour-dune-instance-existante)
15. [Configuration HTTPS / Nginx](#15-configuration-https--nginx)
16. [Sécurité](#16-sécurité)
17. [Sauvegardes](#17-sauvegardes)
18. [Dépannage](#18-dépannage)
19. [Historique des versions](#19-historique-des-versions)

---

## 1. Présentation

ApeX est une application web de gestion comptable pour les PME d'Afrique de l'Ouest et la diaspora. Elle respecte les normes **SYSCOHADA** et gère les obligations fiscales locales (DGI, CNSS, TVA 18 %).

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

### Initialisation en deux temps

L'installation se fait en **deux étapes obligatoires** dans cet ordre :

```bash
cd backend

# 1) Schéma de base (10 tables socle + données de démo)
psql -U postgres -d comptawest -f config/schema_v2.sql

# 2) Migrations numérotées (modules livrés depuis le schéma initial :
#    comptabilité, trésorerie, paie, immobilisations, FNE, abonnements…)
for f in config/migrations/*.sql; do
  echo "Applying $f"
  psql -U comptawest_user -d comptawest -f "$f"
done
```

> ⚠ Sauter l'étape 2 fait tourner ApeX en mode dégradé (les modules
> Comptabilité, FNE, Paie, Abonnements seront indisponibles ou
> partiellement fonctionnels). Voir [section 8](#8-migrations-bdd-système-de-versions)
> pour le détail de chaque migration.

**Ce que le schéma de base crée :**
- 10 tables socle : `utilisateurs`, `entreprises`, `membres_entreprise`, `clients`, `factures`, `lignes_facture`, `depenses`, `categories_depenses`, `declarations_taxes`, `paiements`
- Tous les index de performance
- Utilisateur démo : `demo@comptawest.ci` / `demo123`
- 2 entreprises démo avec clients, factures, dépenses et taxes d'exemple

### Vérifier l'installation

```bash
psql -U comptawest_user -d comptawest -c "\dt" | wc -l
# Doit afficher ≥ 50 (10 socle + tables des 27 migrations)

psql -U comptawest_user -d comptawest -c "\d entreprises" | grep -c "fne_\|idu\|banque\|rib"
# Doit afficher ≥ 8 (colonnes FNE + IDU + coordonnées bancaires)
```

---

## 8. Migrations BDD (système de versions)

Le dossier `backend/config/migrations/` contient **27 fichiers SQL numérotés** qui ont enrichi le schéma initial au fil des modules livrés. Ils s'appliquent dans l'ordre, idempotents (utilisent `IF NOT EXISTS`), et sont sûrs à rejouer.

| #   | Module                              | Quoi                                                                   |
|-----|-------------------------------------|------------------------------------------------------------------------|
| 001 | Audit log                           | Table `audit_log` + trigger journalisation                             |
| 002 | Comptabilité                        | `journaux`, `ecritures`, `lignes_ecriture`, plan comptable SYSCOHADA   |
| 003 | Facture origine                     | `facture_origine_id` pour les avoirs                                   |
| 004 | Trésorerie                          | `comptes_tresorerie`, mouvements, rapprochement                        |
| 005 | Paie                                | `employes`, `bulletins`, `rubriques_paie`, moteur CNPS/ITS             |
| 006 | Immobilisations                     | `immobilisations`, amortissements, dotations                           |
| 007 | Produits & stocks                   | `produits`, `mouvements_stock`, alertes seuil                          |
| 008 | Fournisseurs                        | `fournisseurs`, factures fournisseurs                                  |
| 009 | Découvert trésorerie                | Suivi des découverts autorisés                                         |
| 010 | Invitations                         | `invitations` avec lien unique                                         |
| 011 | Devis                               | Type `devis` + `proforma` sur factures                                 |
| 012 | Rôle RH                             | Rôle `rh` séparé de `comptable`                                        |
| 013 | Révocation sessions                 | `sessions_revoked` pour le logout server-side                          |
| 014 | Langue utilisateur                  | `utilisateurs.langue` (i18n)                                           |
| 015 | Rôles étendus                       | 10 rôles métier (proprietaire, admin, comptable, rh, commercial…)      |
| 016 | Paiements externes                  | `integrations_paiement`, `sessions_paiement` (Mobile Money)            |
| 017 | FNE DGI                             | `factures_certifications_fne`, NCC, fne_mode, fne_api_key              |
| 018 | Écritures origine unique            | Contrainte unicité pour éviter doublons compta                         |
| 019 | Trigger équilibre écritures         | Contrôle débit = crédit avant COMMIT                                   |
| 020 | FNE queue + ping                    | `pending_sync_fne`, cache statut DGI                                   |
| 022 | Abonnements                         | Table `abonnements`, 4 paliers Découverte/Starter/Pro/Cabinet          |
| 023 | Permissions override                | Personnalisation des permissions par membre (JSONB)                    |
| 024 | Paie CI (correctif fiscal)          | Rubriques HS exonérées ITS, IND_LOGEMENT cotisable CNPS                |
| 025 | Entreprise IDU + banque             | `entreprises.idu`, `banque`, `rib`, `swift` (mentions DGI obligatoires) |
| 026 | FNE solde stickers                  | Cache `fne_balance_sticker` pour bandeau dashboard                     |
| 027 | Factures exemption FNE              | `factures.fne_exempt_motif` (loyer nu, billet avion, secteur exonéré)  |

> Note : il n'y a pas de migration 021 — c'est volontaire (un numéro
> a été retiré pendant le développement, pas un oubli).

### Application en lot

```bash
# Sur une base vierge — applique TOUTES les migrations
for f in backend/config/migrations/*.sql; do psql -U comptawest_user -d comptawest -f "$f"; done

# Sur une base à jour — applique uniquement à partir d'une migration donnée
for f in backend/config/migrations/02[4-7]_*.sql; do psql -U comptawest_user -d comptawest -f "$f"; done
```

### Résilience du code aux migrations manquantes

Le backend utilise systématiquement des `try { } catch (err) { if (err.code === '42703') ... }` (colonne inexistante) sur les colonnes ajoutées par migrations récentes. Si une migration n'est pas appliquée :
- Les nouvelles fonctionnalités sont **silencieusement désactivées**
- L'app **continue de tourner** sur les fonctionnalités historiques
- Aucune erreur 500 brutale, juste des champs absents dans l'UI

C'est ce qui permet un **déploiement en deux temps** : pousser le code d'abord, appliquer les migrations ensuite, sans downtime utilisateur.

---

## 9. Lancer le projet

**Terminal 1 — Backend :**
```bash
cd backend
npm run dev
# → 🚀 ApeX API → http://localhost:5000
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
# {"status":"OK","app":"ApeX API","version":"2.1.0"}
```

---

## 10. Compte de démonstration

| Champ | Valeur |
|-------|--------|
| Email | `demo@comptawest.ci` |
| Mot de passe | `demo123` |
| Entreprise 1 | Ouattara & Associés |
| Entreprise 2 | dev225 Technologies |
| Données | Clients, factures, dépenses et taxes préconfigurés |

> **Note :** Le mot de passe `demo123` ne respecte pas la règle des 8 caractères imposée à l'inscription. Ce compte démo existe uniquement via le schéma SQL. Pour un compte réel, utilisez l'inscription avec un mot de passe ≥ 8 caractères.

---

## 11. Routes API

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

## 12. Rôles et permissions

| Rôle | Consultation | Création/Modif | Suppression | Gestion membres |
|------|:---:|:---:|:---:|:---:|
| `proprietaire` | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ (sauf proprio) |
| `comptable` | ✅ | ✅ | ❌ | ❌ |
| `user` | ✅ | ✅ (limité) | ❌ | ❌ |
| `lecture` | ✅ | ❌ | ❌ | ❌ |

---

## 13. 🚀 Déploiement en production — guide pas-à-pas

> Ce guide couvre un **déploiement complet en ~45 minutes** sur un VPS Ubuntu 22.04+ (4 Go RAM, 2 vCPU). Options Railway/Render/Vercel à la fin pour les déploiements rapides.

### 🎯 Vue d'ensemble — les 12 étapes

1. [Provisionner le VPS](#étape-1--provisionner-le-vps)
2. [Installer les dépendances système](#étape-2--installer-les-dépendances-système)
3. [Créer la base PostgreSQL](#étape-3--créer-la-base-postgresql)
4. [Récupérer le code source](#étape-4--récupérer-le-code-source)
5. [Configurer le `.env` backend](#étape-5--configurer-le-env-backend)
6. [Initialiser le schéma + appliquer les 27 migrations](#étape-6--initialiser-le-schéma--appliquer-les-27-migrations)
7. [Lancer le backend avec PM2](#étape-7--lancer-le-backend-avec-pm2)
8. [Builder le frontend](#étape-8--builder-le-frontend)
9. [Configurer Nginx + reverse proxy](#étape-9--configurer-nginx--reverse-proxy)
10. [Activer HTTPS avec Certbot (Let's Encrypt)](#étape-10--activer-https-avec-certbot)
11. [Activer le firewall UFW](#étape-11--activer-le-firewall-ufw)
12. [Vérifications post-déploiement](#étape-12--vérifications-post-déploiement)

---

### Étape 1 — Provisionner le VPS

**Hébergeurs recommandés** (4–10 €/mois pour cette taille) :
| Hébergeur | Plan | Datacenter le + proche CI |
|---|---|---|
| Contabo | Cloud VPS S | Allemagne (~120 ms d'Abidjan) |
| OVH | VPS Comfort | France (~140 ms) |
| Hetzner | CX22 | Allemagne (~120 ms) |
| DigitalOcean | Basic Droplet | London / Frankfurt |

**Spécifications minimales** :
- Ubuntu 22.04 LTS ou 24.04 LTS
- 4 Go RAM, 2 vCPU, 40 Go SSD
- IPv4 publique
- Un nom de domaine pointé vers cette IP (ex : `apex.ci`, `app.apex.ci`)

```bash
# Se connecter en SSH
ssh root@VOTRE_IP_VPS
```

### Étape 2 — Installer les dépendances système

```bash
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx ufw unzip

# Node.js 20 LTS (cible support ApeX)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version   # → v20.x.x

# PostgreSQL 14+
apt install -y postgresql postgresql-contrib
systemctl enable postgresql

# PM2 (gestionnaire de processus Node.js)
npm install -g pm2

# Créer un user non-root pour l'app (sécurité)
adduser apex
usermod -aG sudo apex
```

### Étape 3 — Créer la base PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE comptawest;
CREATE USER comptawest_user WITH ENCRYPTED PASSWORD 'GENEREZ_UN_MOT_DE_PASSE_FORT_32_CHARS_MIN';
GRANT ALL PRIVILEGES ON DATABASE comptawest TO comptawest_user;
-- PostgreSQL 15+ : grant aussi sur le schéma public
\c comptawest
GRANT ALL ON SCHEMA public TO comptawest_user;
\q
```

> 💡 Génère un mot de passe fort avec `openssl rand -base64 32` (à exécuter en local).

### Étape 4 — Récupérer le code source

**Option A — Git (recommandé)** :
```bash
cd /var/www
git clone https://github.com/<TON_USER>/ComptaWest.git apex
cd apex
git checkout master   # ou la branche de release
```

**Option B — Upload zip** :
```bash
# Depuis ta machine locale
scp comptawest.zip root@VOTRE_IP:/var/www/
# Sur le serveur
cd /var/www && unzip comptawest.zip && mv ComptaWest-master apex && cd apex
```

### Étape 5 — Configurer le `.env` backend

```bash
cd /var/www/apex/backend
npm install --production
cp .env.example .env
nano .env
```

**Contenu minimal du `.env` de production** :
```env
# Serveur
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://apex.ci

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=comptawest
DB_USER=comptawest_user
DB_PASSWORD=GENEREZ_UN_MOT_DE_PASSE_FORT_32_CHARS_MIN
DB_SSL=false                              # mettre true si DB managée

# Authentification (clé JWT 64+ chars — openssl rand -hex 32)
JWT_SECRET=GENEREZ_UNE_CLE_64_HEX_ICI
JWT_EXPIRES_IN=7d

# === OPTIONNEL — modules avancés ===========================================

# FNE — URL de production transmise par la DGI par mail après validation
# des spécimens (voir wizard FNE dans Paramètres → Fiscal). Laisser vide
# tant que tu n'as pas reçu l'URL, le mode 'prod' refusera de bloquer.
FNE_PROD_URL=

# OCR Mistral (lecture automatique des reçus fournisseurs)
MISTRAL_API_KEY=

# Webhooks Mobile Money — secrets HMAC pour vérifier les notifications
# (chaque entreprise configure SA propre clé via Paramètres → Intégrations,
# ces variables sont des fallbacks si l'entreprise n'en a pas)
WAVE_WEBHOOK_SECRET_FALLBACK=
ORANGE_NOTIF_TOKEN_FALLBACK=
MTN_SUBSCRIPTION_KEY_FALLBACK=
```

> ⚠ **Critique** : `JWT_SECRET` doit faire ≥ 32 caractères. Génération :
> `openssl rand -hex 32`. Ne JAMAIS commiter le `.env`.

### Étape 6 — Initialiser le schéma + appliquer les 27 migrations

```bash
cd /var/www/apex/backend

# 1) Schéma de base
psql -U comptawest_user -d comptawest -f config/schema_v2.sql

# 2) Toutes les migrations dans l'ordre (idempotent, sûr à rejouer)
for f in config/migrations/*.sql; do
  echo ">>> Applying $f"
  psql -U comptawest_user -d comptawest -f "$f"
done

# 3) Vérification — doit afficher ≥ 50 tables
psql -U comptawest_user -d comptawest -c "\dt" | wc -l
```

### Étape 7 — Lancer le backend avec PM2

```bash
cd /var/www/apex/backend

# Démarrer en mode production
pm2 start src/index.js --name "apex-api" --env production

# Persister la config + démarrage automatique au reboot
pm2 save
pm2 startup
# → copier-coller la commande affichée

# Vérification
pm2 logs apex-api --lines 30
# → doit afficher « 🚀 ApeX API → http://localhost:5000 »
# → doit afficher « ✅ PostgreSQL connecté »
```

### Étape 8 — Builder le frontend

```bash
cd /var/www/apex/frontend
npm install

# Pointer le build sur l'URL HTTPS finale
echo "VITE_API_URL=https://apex.ci/api" > .env.production

npm run build
# → fichiers statiques générés dans frontend/dist/

# Vérification
ls -la dist/index.html dist/assets/
```

### Étape 9 — Configurer Nginx + reverse proxy

```bash
nano /etc/nginx/sites-available/apex
```

```nginx
server {
    listen 80;
    server_name apex.ci www.apex.ci;

    # Frontend statique (build Vite)
    root /var/www/apex/frontend/dist;
    index index.html;

    # SPA — toutes les routes inconnues retournent index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;       # Upload de reçus OCR jusqu'à 20 Mo
    }

    # Webhooks Mobile Money (Wave/Orange/MTN)
    location /webhooks/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/apex /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t                # vérifier la syntaxe
systemctl reload nginx
```

### Étape 10 — Activer HTTPS avec Certbot

```bash
certbot --nginx -d apex.ci -d www.apex.ci
# Suivre les prompts (email + accepter ToS + redirect 80→443)

# Vérifier le renouvellement automatique
certbot renew --dry-run
```

### Étape 11 — Activer le firewall UFW

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'    # ports 80 + 443
ufw enable
ufw status
```

### Étape 12 — Vérifications post-déploiement

```bash
# 1. Health check backend
curl https://apex.ci/health
# → { "status": "ok", "database": "connected" }

# 2. Frontend accessible
curl -I https://apex.ci
# → HTTP/2 200

# 3. Login démo via API
curl -X POST https://apex.ci/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@comptawest.ci","password":"demo123"}'
# → { "success": true, "data": { "token": "..." } }

# 4. Vérifier les logs backend
pm2 logs apex-api --lines 50

# 5. Vérifier les colonnes des migrations récentes
psql -U comptawest_user -d comptawest -c "\d entreprises" | grep "idu\|fne_balance"
# → doit afficher idu, fne_balance_sticker, etc.
```

**✅ Si les 5 vérifications passent, l'app est en ligne.**

> Pense à **changer immédiatement le mot de passe du compte démo** ou à le désactiver via SQL :
> `UPDATE utilisateurs SET actif = false WHERE email = 'demo@comptawest.ci';`

---

### Options alternatives (déploiement rapide)

#### Option Railway (Backend + DB managée, ~5 $/mois)
1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. **Root Directory** : `backend`, Railway détecte Node.js
3. Ajouter un **Service PostgreSQL**
4. Variables : recopier le `.env` de l'étape 5 en utilisant les `${{Postgres.PG*}}`
5. Après le 1er déploiement, ouvrir un shell Railway et **appliquer les 27 migrations** :
   ```bash
   for f in config/migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
   ```

#### Option Vercel (Frontend statique, gratuit)
```bash
cd frontend
npm install -g vercel
echo "VITE_API_URL=https://apex-api.up.railway.app/api" > .env.production
vercel --prod
```

#### Option Render.com (tout-en-un, gratuit avec mise en veille)
- Web Service Node.js sur `backend/`, build `npm install`, start `node src/index.js`
- PostgreSQL gratuit (1 Go) — `psql DATABASE_URL -f config/schema_v2.sql` + boucle migrations
- Frontend statique : Render Static Site sur `frontend/`, build `npm run build`, publish `dist`

---

## 14. Mise à jour d'une instance existante

Quand tu déploies une nouvelle version d'ApeX sur un serveur déjà en prod, suis ces **6 étapes dans cet ordre** pour zéro downtime :

```bash
# 1. SSH sur le serveur de prod
ssh apex@VOTRE_IP

# 2. Sauvegarde BDD avant toute chose
cd /var/www/apex
mkdir -p backups
pg_dump -U comptawest_user comptawest | gzip > backups/comptawest_$(date +%Y%m%d_%H%M%S).sql.gz

# 3. Récupérer le nouveau code
git fetch origin
git status                  # vérifier qu'il n'y a pas de modif locale
git pull origin master

# 4. Mettre à jour les dépendances backend + frontend
cd backend && npm install --production && cd ..
cd frontend && npm install && cd ..

# 5. Appliquer les nouvelles migrations (idempotent, ne rejoue pas les anciennes)
cd backend
for f in config/migrations/*.sql; do
  psql -U comptawest_user -d comptawest -f "$f" 2>&1 | grep -v "already exists\|^NOTICE" || true
done
cd ..

# 6. Rebuild frontend + redémarrer backend
cd frontend && npm run build && cd ..
pm2 restart apex-api
pm2 logs apex-api --lines 30   # vérifier que l'API redémarre proprement
```

> 💡 **Les migrations sont idempotentes** grâce aux `IF NOT EXISTS` et `ON CONFLICT DO NOTHING`. Tu peux les rejouer en boucle sans risque — seules celles non encore appliquées s'exécutent vraiment.

### Rollback en cas de problème

```bash
# 1. Restaurer le code à la version précédente
cd /var/www/apex
git log --oneline -10              # repérer le commit cible
git reset --hard <SHA_PRECEDENT>

# 2. Rebuild + restart
cd frontend && npm run build && cd ..
pm2 restart apex-api

# 3. Si une migration a cassé la BDD, restaurer le dump
gunzip < backups/comptawest_YYYYMMDD_HHMMSS.sql.gz | psql -U comptawest_user -d comptawest
```

> ⚠ Les migrations ApeX **n'ont pas de mécanisme `down`** (pas de rollback SQL automatique). Le seul moyen de revenir en arrière sur le schéma = restaurer un dump. D'où l'importance de l'étape 2 « sauvegarde BDD avant toute chose ».

---

## 15. Configuration HTTPS / Nginx

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

## 16. Sécurité

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

## 17. Sauvegardes

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
pm2 restart apex-api

# 4. Frontend
cd ../frontend && npm install && npm run build

# 5. Recharger Nginx
systemctl reload nginx
```

---

## 18. Dépannage

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
pm2 restart apex-api
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
pm2 logs apex-api --lines 50
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
pm2 restart apex-api
```

---

## 19. Historique des versions

### v2.6 — Mai 2026 — Conformité FNE complète + UX déploiement
- **FNE DGI Côte d'Ivoire** : intégration API complète (sandbox + prod), wizard
  guidé 6 étapes avec coordonnées officielles (téléphone CTF, emails support/infos,
  portails prod/test), bandeau de solde stickers dynamique, alerte secteur exonéré,
  mention timbre quittance sur PDF, exemption FNE par facture (9 motifs FAQ DGI)
- **PDF facture** : sticker FNE QR scannable, alerte NCC client manquant pour B2B,
  bloc paiement Mobile Money intégré (QR + virement bancaire), mentions DGI
  complètes (NCC, IDU, RCCM, régime, centre fiscal)
- **Paie CI** : recalibrage des barèmes après audit expert-comptable
  (CNPS 6,6 %, ITS 0 % jusqu'à 130 000 FCFA, abattement 20 %, AT 4 %, CMU patronale)
  + correction HS exonérées d'ITS + plafond Prime Transport 30 000 FCFA
- **Mobile Money** : guides pas-à-pas par opérateur (Wave / Orange Money / MTN MoMo)
  avec encodeur Base64 intégré pour Orange et MTN
- **Landing** : nouveau hero (« La gestion de votre PME mérite mieux qu'un tableur »)
  + bullets refondus avec mots-clés Mobile Money + Subtitle SEO
- **Favicon** : pictogramme A-montagne officiel en SVG vectoriel + 7 tailles PNG/ICO
- **README** : guide de déploiement pas-à-pas en 12 étapes + procédure de mise à jour

### v2.5 — Mai 2026 — Internationalisation FR/EN + abonnements
- Internationalisation complète FR=EN (≈ 2280 clés en parité stricte)
- Modèle d'abonnement 4 paliers (Découverte / Starter / Pro / Cabinet) + page /tarifs
- Refonte UX onboarding versionné + raccourcis dashboard + landing conversion
- Imports en masse Excel (plan comptable, clients, fournisseurs, écritures)
- Permissions custom par membre (matrice JSONB override)

### v2.4 — Avril 2026 — Refonte des rôles + Mobile Money
- 10 rôles métier (proprietaire, admin, comptable, rh, commercial, magasinier, etc.)
- Intégrations Wave / Orange Money / MTN MoMo avec webhooks signés
- OCR Mistral pour lecture automatique des reçus fournisseurs

### v2.3 — Mars 2026 — Modules trésorerie & immobilisations
- Comptes de trésorerie, rapprochement, suivi des découverts
- Immobilisations + amortissements linéaires/dégressifs
- Devis + proforma + conversion en facture

### v2.2 — Février 2026 — Comptabilité SYSCOHADA + paie
- Plan comptable SYSCOHADA + journaux + écritures + grand livre
- Moteur de paie CNPS/ITS (rubriques configurables, bulletins PDF)

### v2.1 — Janvier 2026 — Sécurité & robustesse
| # | Problème | Correction |
|---|----------|-----------|
| 1 | `.env` avec vrais secrets partagé | `.env` supprimé, uniquement `.env.example` |
| 2 | Rate limiting absent sur `/auth/login` | Rate limiter : 10 tentatives / 15 min |
| 3 | Année codée en dur | `useState(String(new Date().getFullYear()))` |
| 4 | `deleteFacture` toujours `success: true` | Vérifie `result.rowCount`, 404 si 0 |
| 5 | Race condition numérotation factures | `SELECT FOR UPDATE` sur le compteur |
| 6 | Validation inputs backend absente | `express-validator` partout |
| 7 | Catégories SYSCOHADA en double | Helper `creerCategoriesDefaut()` |
| 8 | `execSync` interpolation shell | `execFileSync('python3', [...])` |
| 9 | `process.exit(-1)` sur erreur DB | Log only, pool gère la reconnexion |
| 10 | Mot de passe min 6 chars | Minimum 8 chars front + back |
| 11 | `addPaiement` sans vérification | Refuse montant ≤ 0, > TTC, ou annulée |
| 12 | Catch silencieux frontend | Toasts d'erreur partout |
| 13 | Palette couleurs dupliquée | `src/utils/theme.js` centralisé |
| 14 | Fichiers tmp PDF non nettoyés | Bloc `finally` garantit le nettoyage |
| 15 | Bcrypt 10 rounds | Passé à 12 rounds |

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
*ApeX · SYSCOHADA · FCFA*
