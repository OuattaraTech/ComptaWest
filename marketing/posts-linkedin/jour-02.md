# Jour 02 — Facture FNE certifiée DGI

**Visuel** : `04-facture-pdf.png`
**Hashtags** : #FNE #DGI #FactureElectronique #CotedIvoire #PME_CI

---

80 000 FCFA d'amende.

C'est ce qu'un patron de PME m'a raconté la semaine dernière. Il avait émis une facture papier à un client, comme il fait depuis 15 ans. Le contrôleur fiscal est passé. Verdict : pas de numéro FNE → amende.

Depuis l'ordonnance n° 2023-719, **chaque facture émise par une entreprise ivoirienne doit être certifiée FNE par la DGI**. Pas demain. Maintenant.

Le souci ? Câbler son ERP à l'API DGI, c'est :
- Lire 26 pages de documentation technique
- Demander une clé API au service support FNE
- Coder l'intégration JSON / OAuth
- Tester en sandbox http://54.247.95.108
- Envoyer ses spécimens pour validation
- Attendre l'URL de production par mail

Ou bien, tu utilises ApeX.

Dans ApeX :
1. Tu cliques « Émettre la facture »
2. ApeX appelle l'API DGI
3. Le sticker FNE apparaît en haut à droite du PDF avec QR scannable
4. La facture est enregistrée chez la DGI sous un numéro fiscal unique

Total : 1 clic. 600 ms de latence. Zéro amende.

J'ai ajouté un bandeau de suivi du solde de stickers DGI pour anticiper les recharges (la DGI bloque les certifications après 48h de solde épuisé — détail que personne ne lit dans la doc).

Démo gratuite : **apex.ci**

#FNE #DGI #FactureElectronique #CotedIvoire #PME_CI
