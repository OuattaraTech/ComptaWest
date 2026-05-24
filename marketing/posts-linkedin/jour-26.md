# Jour 26 — Sticker FNE QR scannable sur PDF

**Visuel** : `04-facture-pdf.png` zoom sur le sticker QR
**Hashtags** : #FNE #QRCode #FactureNumerique #PME_CI

---

Le sticker FNE en haut à droite de chaque facture ApeX certifiée DGI, c'est plus qu'un visuel.

C'est un **QR code scannable** qui pointe vers la page officielle de vérification de la DGI.

Concrètement :

1. Tu émets une facture à un client
2. ApeX la certifie via l'API FNE
3. La DGI retourne un `token` : une URL unique de vérification
4. ApeX génère un QR code à partir de cette URL et l'imprime sur le PDF
5. Le PDF est envoyé à ton client

Ce que ton client peut faire ensuite :

→ Il **scanne le QR code** avec son téléphone (n'importe quel scanner QR)
→ Il atterrit sur le **portail officiel DGI** (fne.dgi.gouv.ci ou 54.247.95.108 selon prod/test)
→ Il voit la facture confirmée par la DGI : numéro fiscal, date, montant TTC, vendeur identifié
→ Il a la **preuve absolue** que ta facture est valide et que tu as bien déclaré le revenu

Pour ton client professionnel :
✅ Preuve qu'il peut déduire la TVA (4-5 % d'économie sur ses achats)
✅ Confiance instantanée dans tes opérations
✅ Pas besoin de te demander une copie supplémentaire

Pour toi :
✅ **Tu te démarques** des PME qui font encore des factures papier non-FNE
✅ **Tu rassures** les grosses entreprises et institutions qui vérifient systématiquement
✅ **Tu factures** plus vite à des banques, assurances, organismes publics

apex.ci · démo gratuite

#FNE #QRCode #FactureNumerique #PME_CI #Conformite
