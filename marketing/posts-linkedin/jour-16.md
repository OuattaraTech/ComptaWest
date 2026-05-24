# Jour 16 — Solde stickers FNE avec alertes

**Visuel** : bandeau « Solde stickers DGI : 178 » sur Paramètres → Fiscal
**Hashtags** : #FNE #DGI #PME_CI #AntiBlocage

---

Un détail que personne ne te dira chez la DGI :

**Si tes stickers FNE sont épuisés, tu as 48 heures pour recharger. Passé ce délai, la certification de tes factures est BLOQUÉE.**

Imagine un vendredi soir, après les heures DGI.
Tu veux émettre une grosse facture à un client important. Refus : « solde sticker insuffisant ».
Tu peux pas recharger avant lundi matin.
Tu perds le deal.

Cette situation arrive **régulièrement** aux entreprises qui utilisent l'API FNE sans monitoring de solde.

ApeX surveille pour toi.

→ À chaque certification de facture, ApeX capte le `balance_sticker` que la DGI retourne dans la réponse JSON
→ Stockage en base, mis à jour en temps réel
→ Dans Paramètres → Fiscal, un **bandeau dynamique** affiche ton solde :
   ✅ **Vert** : solde > 200 ("Solde suffisant")
   ⚠ **Orange** : solde < 200 ("À surveiller")
   🚨 **Rouge** : solde < 50 OU drapeau warning DGI ("Critique — rechargez sur fne.dgi.gouv.ci")

Tu rechargesAvant la fin de tes stickers. Tu ne perds plus de deals à cause d'un blocage technique.

Bonus : le bandeau rappelle les tarifs (FNE = 20 FCFA, RNE = 15 FCFA) et le lien direct vers la page d'achat sur le portail FNE.

apex.ci · démo gratuite

#FNE #DGI #PME_CI #AntiBlocage #Stickers
