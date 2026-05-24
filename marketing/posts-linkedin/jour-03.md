# Jour 03 — Mobile Money intégré

**Visuel** : `08-mobile-money.png`
**Hashtags** : #Wave #OrangeMoney #MTNMoMo #MobileMoney #PME_CI

---

Hier, j'ai parlé avec un patron de PME. Il m'a dit :

« Mon client m'a payé par Wave lundi. Je l'ai su jeudi. Et j'ai mis 4 jours à passer l'écriture comptable. »

C'est trop. En 2026.

Les Mobile Money représentent **62 % des paiements B2B en Côte d'Ivoire**. Pourtant la majorité des logiciels de compta vendus ici n'ont **AUCUNE** intégration native avec Wave, Orange Money ou MTN MoMo.

Tu fais quoi alors ? Tu vas sur l'app Wave Business → tu vois le paiement → tu retournes sur ton logiciel → tu saisis manuellement → tu pries pour ne pas avoir fait de typo.

Dans ApeX, c'est différent.

→ Tu configures **une seule fois** ta clé API Wave (ou Orange, ou MTN). 5 min.
→ Tu indiques le compte de trésorerie de destination (ex : 521300 Banque Wave).
→ Voilà.

Ce qui se passe ensuite, automatiquement :

✅ Client paye via Wave → tu reçois la notification
✅ ApeX rapproche la facture (matching par référence)
✅ La facture passe « payée » sans intervention
✅ L'écriture comptable est passée : Débit 521 / Crédit 411
✅ Le Grand Livre est à jour en temps réel

Du paiement à l'écriture : **10 secondes**.

Wave + Orange Money + MTN MoMo intégrés. Wizard de configuration en 5 étapes avec encodeur Base64 intégré pour les clés Orange & MTN (parce que la doc DGI est compliquée — on l'a simplifiée).

apex.ci · démo gratuite

#Wave #OrangeMoney #MTNMoMo #MobileMoney #PME_CI
