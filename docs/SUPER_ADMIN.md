# Accès Super-Admin ApeX

Procédure pour donner / révoquer l'accès à la **Console Admin** (`/admin`)
qui permet de :

- Voir les KPIs plateforme (MRR, cabinets partenaires, PME actives, taux de conversion)
- Valider ou refuser les **candidatures de cabinets** (programme partenariat ONECCA)
- Consulter le **leaderboard cabinets** (top 100 par PME parrainées)
- Suivre les **relances automatiques** d'invitations PME (cron J+2)

> ⚠️ Le statut super-admin est **manuel par décision sécurité** : il n'existe
> aucune interface self-service. Promotion et rétrogradation passent
> exclusivement par SQL direct sur la base.

---

## 1. Prérequis

L'utilisateur doit avoir **un compte ApeX existant** créé via `/login`
(onglet Inscription). Le statut super-admin se cumule par-dessus son compte
normal — il garde son accès à son entreprise habituelle et obtient en plus
le bandeau « Console Admin » dans la sidebar.

Vérifier que la **migration 029** est appliquée (sinon la colonne
`is_super_admin` n'existe pas) :

```bash
PGPASSWORD="<MOT_DE_PASSE_BDD>" psql -U comptawest_user -d comptawest -h localhost \
  -c "SELECT column_name FROM information_schema.columns
      WHERE table_name='utilisateurs' AND column_name='is_super_admin';"
```

Si la requête ne renvoie aucune ligne, appliquer d'abord la migration :

```bash
PGPASSWORD="<MOT_DE_PASSE_BDD>" psql -U comptawest_user -d comptawest -h localhost \
  -f backend/config/migrations/029_cabinets_partenaires.sql
```

---

## 2. Procédure LOCAL (développement)

### Promouvoir

```bash
PGPASSWORD="LMFtEaQJFNSdEhheNVZnUrt" psql \
  -U comptawest_user -d comptawest -h localhost \
  -c "UPDATE utilisateurs SET is_super_admin=TRUE WHERE email='<EMAIL>';"
```

Résultat attendu : `UPDATE 1`.

### Activer l'accès

1. Se déconnecter et se reconnecter (sinon le JWT ne sera pas rafraîchi)
2. La sidebar affiche un **bandeau violet « CONSOLE ADMIN »** sous le bandeau cabinet, au-dessus du switcher d'entreprise
3. Cliquer → atterrissage sur `/admin`

> Le frontend interroge `/auth/me` qui retourne `is_super_admin: true` après
> l'UPDATE. Si le bandeau n'apparaît pas, faire un hard reload (Ctrl+Shift+R).

---

## 3. Procédure PRODUCTION

### Se connecter au serveur

Selon ton hébergeur (VPS, Render, Railway, Supabase, etc.). Exemples :

**VPS classique (Ubuntu)** :
```bash
ssh deploy@apex.ci
sudo -u postgres psql comptawest
```

**Render / Railway** : utiliser le shell PostgreSQL fourni par l'interface
ou se connecter via `DATABASE_URL` :
```bash
psql "$DATABASE_URL"
```

**Supabase** : SQL Editor dans le dashboard web → coller la requête.

### Promouvoir (PROD)

```sql
UPDATE utilisateurs SET is_super_admin=TRUE WHERE email='<EMAIL>';
```

⚠️ **Toujours préciser le filtre `WHERE email=...`**. Un `UPDATE` sans
WHERE promouvrait TOUS les utilisateurs.

### Vérification immédiate

```sql
SELECT email, nom, is_super_admin, created_at
FROM utilisateurs
WHERE is_super_admin=TRUE;
```

L'utilisateur doit apparaître dans la liste.

---

## 4. Révoquer un super-admin

À faire sans délai en cas de départ d'un collaborateur ou de soupçon de
compromission :

```sql
UPDATE utilisateurs SET is_super_admin=FALSE WHERE email='<EMAIL>';
```

Optionnellement, désactiver complètement le compte :

```sql
UPDATE utilisateurs SET actif=FALSE WHERE email='<EMAIL>';
```

---

## 5. Audit (qui est super-admin ?)

À exécuter régulièrement (mensuel a minima) :

```sql
SELECT email, nom, is_super_admin, actif, created_at
FROM utilisateurs
WHERE is_super_admin=TRUE
ORDER BY created_at;
```

Toute ligne non reconnue = compromission ou erreur opérationnelle →
révoquer immédiatement.

---

## 6. Bonnes pratiques sécurité

1. **Minimum strict** : 1 à 3 super-admins maximum (toi + back-up de
   confiance). Plus = surface d'attaque.
2. **Email pro dédié** : ne jamais utiliser un email perso ou un email
   partagé avec une équipe. Privilégier `admin@apex.ci` ou similaire.
3. **Mot de passe fort** : minimum 16 caractères, gestionnaire de mots
   de passe (1Password, Bitwarden), JAMAIS réutilisé.
4. **Pas d'accès permanent** : si tu dois faire de l'admin ponctuel,
   promouvoir, faire l'action, puis révoquer.
5. **Audit log** : toutes les actions admin (validation/refus de
   candidature, création de cabinet) sont tracées dans `audit_log` avec
   `user_id` et `created_at`.
6. **Backup BDD avant promotion massive** : si tu promeus plusieurs
   personnes, fais un `pg_dump` juste avant — un faux UPDATE peut être
   coûteux.

---

## 7. Référence rapide

| Action | Commande SQL |
|---|---|
| Promouvoir | `UPDATE utilisateurs SET is_super_admin=TRUE WHERE email='X';` |
| Révoquer | `UPDATE utilisateurs SET is_super_admin=FALSE WHERE email='X';` |
| Lister | `SELECT email FROM utilisateurs WHERE is_super_admin=TRUE;` |
| Désactiver compte | `UPDATE utilisateurs SET actif=FALSE WHERE email='X';` |

---

## 8. Vue d'ensemble du flow

```
[1] Compte créé via /login (inscription normale)
        ↓
[2] UPDATE SQL is_super_admin=TRUE
        ↓
[3] Déconnexion / reconnexion
        ↓
[4] /auth/me retourne is_super_admin: true
        ↓
[5] Sidebar affiche bandeau « CONSOLE ADMIN »
        ↓
[6] Clic → /admin
        ↓
[7] requireSuperAdmin (backend) vérifie le flag
        ↓
[8] Accès complet aux 6 endpoints /api/admin/*
```

---

**Voir aussi** :
- Migration `backend/config/migrations/029_cabinets_partenaires.sql`
- Middleware `backend/src/middleware/superAdmin.js`
- Contrôleur `backend/src/controllers/adminController.js`
- Page `frontend/src/pages/AdminPage.jsx`
- Sidebar `frontend/src/components/Layout/Sidebar.jsx` (bandeau)
