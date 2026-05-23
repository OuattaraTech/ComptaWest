# 📸 Liste des captures requises

Place tes captures dans **ce dossier `public/`** avec EXACTEMENT ces noms de fichier. Le code Remotion les référence directement.

## ⚙️ Réglages de capture

- **Outil recommandé** : Firefox/Chrome → DevTools → Toggle device toolbar → réglage manuel **1920×1080** (desktop) ou **1080×1920** (mobile pour les screens responsive)
- **Format** : PNG (qualité max, supporte la transparence si besoin)
- **Mode** : **DARK** (le design ApeX est sombre, c'est plus joli en vidéo)
- **Compte** : connecte-toi sur ton **compte démo** pour avoir les données pré-remplies
- **Zoom navigateur** : 100 % (ne pas zoomer)

## 📋 Liste des 10 captures

| Fichier | Page à capturer | Conseils |
|---|---|---|
| `01-dashboard.png` | `/dashboard` | Vue d'ensemble avec KPIs (CA, dépenses, taxes), graphique mensuel, top clients |
| `02-factures-liste.png` | `/factures` | Liste avec au moins 4 factures (1 payée, 1 envoyée, 1 retard, 1 brouillon) |
| `03-facture-modale.png` | Modale `/factures` → « Nouvelle facture » | Formulaire rempli avec client + 1-2 lignes |
| `04-facture-pdf.png` | PDF facture certifiée FNE | Ouvre le PDF d'une facture validée et capture la 1ère page avec sticker FNE visible |
| `05-paie-liste.png` | `/paie` (RH page) | Liste de 3 bulletins avec montants |
| `06-paie-bulletin.png` | Modale bulletin EMP-001 | Bulletin ouvert avec ITS brut / réduction famille / ITS net |
| `07-tresorerie.png` | `/tresorerie` | Comptes Banque Atlantique + Wave + Caisse avec soldes |
| `08-mobile-money.png` | `/parametres` → onglet Intégrations | Bloc Wave / Orange Money / MTN MoMo avec statuts |
| `09-comptabilite.png` | `/comptabilite` → Grand Livre | Liste des écritures auto-générées (411 Clients, 521 Banque, 706 Ventes) |
| `10-fne-wizard.png` | `/parametres` → onglet Fiscal | Wizard FNE avec ses 6 étapes + bandeau solde stickers |

## ✅ Vérification avant rendu vidéo

```bash
cd marketing/remotion-apex/public
ls -1 *.png
# Tu dois voir les 10 fichiers
```

Une fois les captures dans `public/`, lance :
```bash
cd marketing/remotion-apex
npm start
# → http://localhost:3000 → tu vois les captures animées avec motion design
```
