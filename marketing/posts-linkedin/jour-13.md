# Jour 13 — 10 rôles métier + permissions custom

**Visuel** : page Membres avec liste de rôles
**Hashtags** : #Equipe #SecuriteData #PME_CI #Management

---

Tu confies l'accès à ton logiciel de compta à ta secrétaire ?
Et elle peut **modifier les factures déjà payées** ?
Et **voir les salaires de tous les employés** ?
Et **supprimer le compte d'un client** ?

Si oui, tu as un problème majeur de gouvernance.

La plupart des outils de compta vendus en CI ont 2 rôles : « admin » et « lecture seule ». C'est insuffisant pour une vraie PME.

ApeX a **10 rôles métier** distincts, alignés sur l'organisation réelle d'une PME ivoirienne :

1. **Propriétaire** : tout accès, le seul à pouvoir supprimer l'entreprise
2. **Admin** : tout accès sauf suppression entreprise
3. **Comptable** : compta + fiscal + reporting, pas RH ni Mobile Money
4. **RH** : paie + employés + bulletins, pas comptabilité financière
5. **Commercial** : factures + clients + devis, lecture compta
6. **Magasinier** : stocks + produits + mouvements, pas finance
7. **Trésorier** : trésorerie + paiements + rapprochements
8. **Auditeur** : lecture seule sur tout
9. **Assistant** : saisie limitée (clients, devis, dépenses simples)
10. **Lecture** : visualisation des rapports uniquement

Et si ces 10 rôles ne suffisent pas ? **Permissions personnalisables par membre**. Tu cliques sur ta secrétaire et tu lui DÉCOCHES « supprimer un client » ou « éditer un bulletin validé ». Override granulaire (matrice 50+ permissions JSONB).

C'est la même UX que Google Workspace ou Notion. Mais pour la gestion d'entreprise.

apex.ci · démo gratuite

#Equipe #SecuriteData #PME_CI #Management #Gouvernance
