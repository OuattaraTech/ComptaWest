# Marketing ApeX

Dossier des assets marketing. Ce README documente surtout le **système de
newsletter** (gabarits email + envoi via Resend). Les autres fichiers
(annonces, posts, plan média, vidéo Remotion) sont des contenus ponctuels.

## 📧 Newsletter — gabarits d'email

Trois gabarits HTML prêts à coller dans **Resend → Broadcasts** (mode HTML).
Tous partagent le même en-tête sombre (logo blanc ApeX), le filet émeraude
et le pied de page avec lien de désinscription.

| Fichier | Quand l'utiliser |
|---|---|
| `newsletter-template.html` | Newsletter **générique** : conseils de gestion + nouveautés. Base polyvalente. |
| `newsletter-template-echeances.html` | Rappel **mensuel des échéances** fiscales DGI/CNPS (tableau de dates). Idéal le 1er du mois. |
| `newsletter-template-fonctionnalite.html` | **Annonce d'une nouvelle fonctionnalité** (grande image produit + bénéfices). |

Pour prévisualiser : ouvre le fichier `.html` dans un navigateur.

### Réglages Resend (à chaque Broadcast)
- **From** : `ApeX <newsletter@useapex.ci>` (domaine vérifié)
- **Reply-To** : `support@useapex.ci` (boîte réellement relevée)
- Coller le gabarit en **mode HTML** (`</>`), remplacer les zones `<!-- ✏️ ... -->`
- **Toujours faire « Send test »** avant l'envoi réel (rendu mobile + logo)
- Ne **jamais retirer** `{{{RESEND_UNSUBSCRIBE_URL}}}` (désinscription obligatoire)

### Règles à respecter
- **1 envoi/mois maximum** (promesse faite à l'inscription) — sinon la réputation chute.
- Les **images** doivent être en **URL absolue** sur `useapex.ci` (pas de pièce jointe,
  pas de chemin relatif). Déposer dans `frontend/public/…`, redéployer le front.
- Échéances fiscales : **vérifier les dates** sur le calendrier officiel DGI avant envoi.

## ⚙️ Comment fonctionne l'envoi (côté technique)

- Les inscrits du footer du site sont stockés dans la table `newsletter_abonnes`
  (source de vérité) **et** synchronisés automatiquement dans une **Audience Resend**.
- Variables backend nécessaires (`/opt/apex/backend/.env`) :
  - `RESEND_AUDIENCE_API_KEY` — clé Resend **Full access** (gestion des contacts)
  - `RESEND_AUDIENCE_ID` — ID de l'audience (Resend → Audience → bouton `</>`)
- Backfill des inscrits antérieurs (one-shot) :
  `node scripts/sync-newsletter-resend.js` (dans `backend/`)
- L'**envoi** se fait depuis Resend → **Broadcasts** (désinscription + stats gérées par Resend).

## Autres assets du dossier
- `email_annonce_useapex_ci.md` — email d'annonce de lancement
- `posts.md`, `posts-linkedin/` — publications réseaux sociaux
- `plan-media.md`, `script-vo.md` — plan média & script vidéo
- `remotion-apex/` — projet vidéo Remotion
- `INSTALLATION.md` — installation des outils marketing
