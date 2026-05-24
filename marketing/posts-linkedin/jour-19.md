# Jour 19 — Avoirs / notes de crédit SYSCOHADA-conformes

**Visuel** : facture d'avoir avec référence facture origine
**Hashtags** : #Avoir #SYSCOHADA #OHADA #PME_CI #Comptabilite

---

Une cliente vient te voir. Furieuse.

« Vous m'avez facturé 1 593 000 FCFA en mars. J'ai trouvé une erreur. Je veux 200 000 FCFA en moins. Vous me refaites la facture ? »

Mauvaise idée.

**Modifier une facture déjà émise = violation de l'article 17 du SYSCOHADA** (intangibilité des écritures). Tu ne peux PAS effacer le passé en comptabilité.

La bonne réponse : **émettre une facture d'avoir**.

Une facture d'avoir (= note de crédit) :
→ Référence la facture d'origine (champ obligatoire SYSCOHADA)
→ Reprend les lignes à rembourser
→ Génère l'écriture inverse : Débit 70x Ventes / Crédit 411 Clients
→ Reste dans ton bilan comme trace d'une rectification légale

Dans ApeX :
✅ Bouton « Avoir » sur chaque facture
✅ Lien automatique avec la facture d'origine (numéro affiché en rouge sur le PDF)
✅ Choix : avoir intégral OU avoir partiel (liste des lignes, tu coches ce que tu rembourses)
✅ Préfixe **AV-** au lieu de F- pour identifier immédiatement
✅ Conditions paiement adaptées (« Remboursement par virement », « Crédit sur prochaine facture », etc.)
✅ Numérotation continue annuelle (AV-2026-001, AV-2026-002…)
✅ **Validation FNE** spécifique : appel à l'endpoint `/external/invoices/{id}/refund` de la DGI

Ta compta reste irréprochable. Ton client est satisfait. Tu es en règle.

apex.ci · démo gratuite

#Avoir #SYSCOHADA #OHADA #PME_CI #Comptabilite
