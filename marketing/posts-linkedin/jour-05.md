# Jour 05 — Comptabilité SYSCOHADA automatique

**Visuel** : `09-comptabilite.png`
**Hashtags** : #SYSCOHADA #Comptabilite #OHADA #GrandLivre #PME_CI

---

Je vais te dire une chose désagréable.

Si tu tiens encore ta comptabilité dans Excel, **tu n'es pas en règle avec l'OHADA**.

L'article 17 du SYSCOHADA est explicite : les écritures comptables doivent être **intangibles** (impossibles à modifier après validation), **horodatées**, et **traçables**.

Excel ne fait aucune de ces 3 choses.
Tompro le fait mais coûte 600 000 FCFA + maintenance.
Sage le fait mais c'est de la dynamite à configurer.

ApeX le fait. Et c'est inclus dans le palier Starter à 15 000 FCFA/mois.

Ce qui se passe quand tu utilises ApeX :

→ Tu émets une facture → ApeX passe **automatiquement** : Débit 411 Clients / Crédit 70x Ventes + 4431 TVA collectée
→ Ton client paye → Débit 521 Banque / Crédit 411 Clients
→ Tu enregistres une dépense → Débit 60x Charges + 4452 TVA déductible / Crédit 521 Banque

Tu ne touches **JAMAIS** à une écriture. Elle est passée correctement, équilibrée (trigger BDD qui vérifie débit = crédit), horodatée, et stockée pour toujours.

Le Grand Livre se met à jour en temps réel.
La balance des comptes est sortable à toute heure.
Le bilan annuel est généré en 1 clic au 31/12.

Plan comptable SYSCOHADA révisé pré-installé (804 comptes).
Conformité OHADA art. 17 garantie par trigger PostgreSQL.

apex.ci · démo gratuite

#SYSCOHADA #Comptabilite #OHADA #GrandLivre #PME_CI
