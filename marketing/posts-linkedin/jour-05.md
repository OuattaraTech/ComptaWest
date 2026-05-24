# Jour 05 — Comptabilité SYSCOHADA automatique

**Visuel** : `09-comptabilite.png`
**Hashtags** : #SYSCOHADA #Comptabilite #OHADA #GrandLivre #PME_CI

---

Une vérité comptable que peu de gérants connaissent :

Si tu tiens encore ta comptabilité dans Excel, **tu n'es pas en règle avec l'OHADA**.

L'article 17 du SYSCOHADA est explicite : les écritures comptables doivent être **intangibles** (impossibles à modifier après validation), **horodatées**, et **traçables**.

Excel ne fait aucune de ces 3 choses. C'est pour ça que ton expert-comptable insiste pour passer à un vrai outil — il sait qu'en cas de contrôle DGI, ton fichier Excel est juridiquement non opposable.

Le marché propose plusieurs solutions sérieuses pour la compta SYSCOHADA en CI. Notre approche avec ApeX :

→ **Plan comptable SYSCOHADA révisé** pré-installé (804 comptes)
→ **Écritures automatiques** au fil de l'eau dès que tu utilises l'app :
   • Facture émise → Débit 411 / Crédit 70x + 4431 TVA collectée
   • Paiement reçu → Débit 521 / Crédit 411
   • Dépense → Débit 60x + 4452 TVA déductible / Crédit 521
→ **Trigger PostgreSQL** qui garantit l'équilibre (débit = crédit) avant chaque COMMIT — impossible de valider une écriture déséquilibrée
→ **Intangibilité OHADA art. 17** : les écritures validées sont en lecture seule, modification = avoir SYSCOHADA-conforme
→ **Grand Livre, Balance, Bilan** sortables à toute heure

Ton expert-comptable garde son rôle complet :
- Accès direct au compte ApeX (rôle « comptable » dédié)
- Validation des écritures complexes (provisions, étalements, charges constatées d'avance)
- Optimisation fiscale et bouclage annuel

Inclus dans le palier Starter à 15 000 FCFA/mois.

apex.ci · démo gratuite

#SYSCOHADA #Comptabilite #OHADA #GrandLivre #PME_CI
