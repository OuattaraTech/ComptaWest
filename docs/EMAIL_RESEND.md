# Configuration de l'envoi d'emails (Resend)

ApeX envoie des emails transactionnels via [Resend](https://resend.com) —
service moderne dédié aux emails applicatifs (≠ Mailchimp/Brevo qui sont
des outils marketing). Tant que les variables d'environnement ne sont
pas configurées, **les emails sont loggés en console** au lieu d'être
envoyés (le reste de l'app continue de fonctionner normalement).

## Emails concernés

| Email | Déclencheur | Fichier template |
|---|---|---|
| Invitation cabinet directe | `/admin` → bouton « Inviter un cabinet » | `invitationDirecteCabinet` |
| Activation cabinet | Validation d'une candidature spontanée dans `/admin` | `activationCabinet` |
| Invitation PME | Portail cabinet → « Inviter une PME » | `invitationPme` |
| Relance PME | Cron J+2 sur invitations PME pending | `relanceInvitationPme` |

Tous les templates sont dans `backend/src/utils/emailTemplates.js`
(design émeraude/gradient cohérent avec la marque, compatible Gmail/Outlook).

---

## Procédure d'inscription Resend (gratuit)

**Quota gratuit :** 100 emails/jour, 3 000 emails/mois, 1 domaine vérifié.
Suffisant pour démarrer le programme partenariat. Au-delà : 20 $/mois pour
50 000 emails.

### 1. Créer le compte (2 min)

1. Aller sur [resend.com/signup](https://resend.com/signup)
2. S'inscrire avec Google, GitHub ou email (pas de carte bancaire demandée)
3. Vérifier l'email reçu

### 2. Récupérer une clé API immédiatement (mode dev)

1. Dashboard → **API Keys** → **Create API Key**
2. Nom : `apex-dev` (par exemple)
3. Permission : **Sending access** (suffit ; pas besoin de full access)
4. Cliquer **Create** → **copier la clé** (commence par `re_`)
5. La clé n'apparaîtra plus une fois la modale fermée

> ⚠️ **En mode dev sans domaine vérifié**, Resend n'autorise l'envoi
> qu'à **ton propre email d'inscription**. Pour envoyer à des cabinets
> tiers, il faut vérifier un domaine (étape 3).

### 3. Vérifier ton domaine (5-30 min)

Indispensable pour envoyer à n'importe quelle adresse.

1. Dashboard → **Domains** → **Add Domain**
2. Saisir le domaine d'envoi (ex: `apex.ci` ou un sous-domaine
   `mail.apex.ci` pour ne pas polluer le principal)
3. Resend affiche 3 enregistrements DNS à ajouter chez ton registrar :
   - **TXT** (SPF) pour autoriser Resend à envoyer pour ton domaine
   - **TXT** (DKIM) pour signer cryptographiquement chaque email
   - **MX** (retour bounces) pour gérer les rejets
4. Aller chez ton registrar (OVH, Gandi, Cloudflare, Namecheap, etc.)
   → zone DNS de `apex.ci` → ajouter les 3 enregistrements **tels quels**
5. Revenir dans Resend → **Verify Records** (propagation 5 min à 1 h)
6. Quand les 3 lignes passent au vert → tu peux envoyer depuis n'importe
   quelle adresse `@apex.ci`

### 4. Configurer ApeX

Éditer `backend/.env` :

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=ApeX <contact@apex.ci>
FRONTEND_URL=https://apex.ci
```

Redémarrer le backend :

```bash
cd backend
npm run dev  # ou pm2 restart apex-backend en prod
```

### 5. Tester

Aller dans `/admin` → **Inviter un cabinet** → te mettre comme destinataire :

```
Nom du responsable : Test Cabinet
Email : ton-email-perso@gmail.com
```

Clic « Envoyer l'invitation ».

- **Si tout est bien configuré** : la modale succès affiche un bandeau
  vert « Email d'invitation parti avec succès » → tu reçois l'email
  dans la minute.
- **Si la clé est incorrecte ou le domaine non vérifié** : bandeau orange
  → tu peux quand même copier le lien ou utiliser WhatsApp.

Logs backend pour debug :

```bash
# Si Resend renvoie une erreur, elle est loggée :
tail -f backend/logs/app.log  # ou la console nodemon
```

---

## Dépannage

### « Domain not verified » dans les logs

→ Étape 3 pas terminée ou DNS pas encore propagés.
Tester avec `dig TXT apex.ci` ou via [dnschecker.org](https://dnschecker.org).

### « You can only send testing emails to your own email address »

→ Tu utilises la clé API sans avoir vérifié un domaine. Soit :
- Vérifier un domaine (étape 3), soit
- Utiliser temporairement `EMAIL_FROM=ApeX <onboarding@resend.dev>` et
  envoyer uniquement à l'email du compte Resend pour tester.

### Quota dépassé (100/jour)

→ Passer au plan payant ($20/mois pour 50 000 emails) ou attendre 24 h.
Pour la production avec un volume d'invitations cabinets élevé, prévoir
le plan **Pro** dès le démarrage.

### L'email part mais arrive en spam

→ Vérifier que les 3 DNS Resend sont OK ET ajouter en plus un
enregistrement **DMARC** sur ton domaine :

```
_dmarc.apex.ci  TXT  "v=DMARC1; p=none; rua=mailto:postmaster@apex.ci"
```

Au bout de 2-4 semaines, passer la policy à `p=quarantine` puis `p=reject`.

---

## Production

En production, **séparer les environnements** :

- 1 clé API `apex-staging` (testée sur un domaine de pré-prod)
- 1 clé API `apex-prod` (clé séparée, jamais réutilisée)

Stocker la clé prod dans le **gestionnaire de secrets** de l'hébergeur
(Render env vars, Railway secrets, AWS Secrets Manager…), pas dans le
dépôt git.

Pour suivre le taux d'ouverture / bounces, activer les **webhooks Resend**
qui peuvent appeler `POST /api/webhooks/resend` (à implémenter quand le
besoin se précisera — pas nécessaire pour démarrer).

---

## Alternative : SMTP générique

Si Resend ne convient pas (politique interne, préférence pour OVH/AWS SES),
le helper `backend/src/utils/email.js` peut être adapté pour utiliser
[Nodemailer](https://nodemailer.com) avec un SMTP classique. La signature
de `envoyerEmail({to, subject, html, text, tags})` reste identique —
seule l'implémentation change.

---

**Voir aussi** :
- `backend/src/utils/email.js` — wrapper qui appelle l'API Resend
- `backend/src/utils/emailTemplates.js` — les 4 templates HTML
- `docs/SUPER_ADMIN.md` — accès à la console admin qui déclenche les emails
