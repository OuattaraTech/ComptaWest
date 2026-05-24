# Jour 25 — Démo isolée et sécurisée

**Visuel** : bandeau « Compte démo isolé · expire dans 23 h 59 »
**Hashtags** : #RGPD #Securite #PME_CI #Demo

---

Quand tu testes un logiciel SaaS B2B en Côte d'Ivoire, voilà ce qui se passe souvent :

→ Tu cliques « Tester en démo »
→ Tu arrives sur un compte démo PARTAGÉ avec tous les autres testeurs
→ Tu vois leurs factures, leurs clients, leurs NCC réels (parce que les gens saisissent leurs vraies données)
→ Tu peux modifier leurs factures, supprimer leurs clients
→ **Risque RGPD majeur. Risque concurrentiel. Risque de fuite.**

C'est ce qu'on avait au début sur ApeX. C'était inacceptable. On a tout changé.

**Comment ça marche maintenant** :

→ Tu cliques « Tester gratuitement » sur apex.ci
→ ApeX te crée **ton propre compte démo isolé** en 2 secondes
   - Email auto-généré : `demo-7acdd55f@apex.local`
   - Mot de passe : tu n'en as pas besoin (JWT direct)
   - Ton propre tenant en base de données
   - Tes propres clients, factures, employés démo pré-remplis
→ Tu testes pendant 24 heures
→ À expiration, **TOUTES tes données sont supprimées automatiquement** par notre cron
→ Un bandeau te prévient en haut de l'écran avec le countdown

**Personne ne voit ce que tu fais. Toi, tu ne vois personne.**

Si tu veux conserver ton travail, tu cliques « Créer un compte permanent » → ApeX migre tes données vers un vrai compte payant.

C'est la **norme** des SaaS sérieux (Notion, Linear, Vercel). C'est la norme attendue d'une PME ivoirienne sérieuse.

apex.ci · démo gratuite, 30 sec

#RGPD #Securite #PME_CI #Demo #SaaS
