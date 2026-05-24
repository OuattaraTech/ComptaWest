# Jour 15 — Exemption FNE par facture (loyer, billet d'avion, etc.)

**Visuel** : facture marquée « DISPENSÉE FNE » avec encart orange
**Hashtags** : #FNE #SCI #ImmobilierCI #PME_CI #Fiscalite

---

Tu loues un local à des entreprises ? Tu vends des billets d'avion ? Tu es pharmacien, banquier, assureur ?

**Tu n'es PAS soumis à l'obligation FNE.**

L'article 145 du Livre des Procédures Fiscales liste 8 catégories d'opérations dispensées :
- Loyers d'immeubles nus (SCI)
- Billets d'avion (agences de voyage)
- Pharmacies
- Banques et assurances
- Compagnies aériennes
- Services publics (eau, électricité, télécom)
- Concessionnaires pétroliers sous contrat
- La Poste

Le problème : la plupart des logiciels facturation ne savent pas gérer ça. Soit ils certifient TOUT (et tu paies inutilement le sticker DGI à 20 FCFA × 1000 factures = 20 000 FCFA/mois pour rien), soit ils ne certifient RIEN (et tu prends une amende sur les opérations qui auraient dû être certifiées).

Dans ApeX :

→ Sur chaque facture, **case à cocher** : « Cette facture est dispensée de FNE »
→ Si oui, **select de motif** parmi les 9 cas FAQ DGI
→ Le PDF affiche un encart orange « DISPENSÉE FNE — Motif : loyer immeuble nu » à la place du sticker vert
→ Mention « Art. 145 LPF · FAQ DGI » imprimée
→ **Aucun appel API DGI**, aucun sticker consommé
→ Le contrôleur fiscal comprend immédiatement pourquoi la facture n'a pas de QR

Tu factures comme tu veux. ApeX s'adapte à ton activité.

apex.ci · démo gratuite

#FNE #SCI #ImmobilierCI #PME_CI #Fiscalite
