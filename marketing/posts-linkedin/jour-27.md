# Jour 27 — Coordonnées bancaires + bloc paiement intégré

**Visuel** : pied de facture avec QR paiement Mobile Money + RIB virement
**Hashtags** : #Paiement #PME_CI #Pro #Recouvrement

---

Tu envoies une facture à ton client. Il la reçoit. Et… il attend.

Pourquoi ?

Parce que sur ta facture, tu n'as **PAS** indiqué :
- Comment te payer
- Sur quel compte verser
- Quelles options de paiement il a

Résultat : il pose la facture sur le coin du bureau. Il l'oublie. 30 jours plus tard, tu relances. 45 jours plus tard, tu relances encore. 60 jours plus tard, tu commences à imaginer le pire.

ApeX règle ça avec un **bloc paiement intégré** en pied de chaque PDF facture :

🔳 **QR « Scanner pour payer »** (à gauche)
   Le client scanne avec son téléphone → atterrit sur apex.ci/p/F-2026-042 → choisit son mode (Wave / Orange / MTN / virement)

📱 **Bloc Mobile Money** (au centre)
   « Wave · Orange Money · MTN MoMo » avec lien direct cliquable

🏦 **Bloc Virement bancaire** (à droite)
   - Banque Atlantique CI (ou la tienne)
   - RIB : CI008 01001 00000 0123456
   - SWIFT/BIC : BANKCIAB
   Toutes les coordonnées dont le client a besoin, lisibles, en gros caractères

**Tu paramètres ça une seule fois** dans Paramètres → Entreprise → Coordonnées bancaires. Toutes tes factures futures l'affichent automatiquement.

Si tu ne renseignes pas, ApeX affiche un placeholder discret « Coordonnées non renseignées — Paramètres → Entreprise » pour t'inciter à le faire.

Délai moyen d'encaissement chez nos clients passés de 45 jours à 18 jours. C'est mesuré.

apex.ci · démo gratuite

#Paiement #PME_CI #Pro #Recouvrement #DSO
