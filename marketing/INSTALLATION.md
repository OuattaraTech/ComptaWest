# 🚀 Installer et lancer Remotion ApeX (pas-à-pas)

## Prérequis vérifiés

✅ Node.js 18.19.1 (Remotion exige Node 16+)
✅ npm 9.2.0

## Installation

### Étape 1 — Dépendances Chromium (Ubuntu)

Remotion télécharge son propre Chromium headless, qui a besoin de quelques bibliothèques système :

```bash
sudo apt update
sudo apt install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2t64 libxss1 libgconf-2-4 fonts-liberation
```

*Si certaines lignes échouent (paquet inexistant), continue — Remotion est tolérant.*

### Étape 2 — Installation Remotion (depuis le dossier marketing)

```bash
cd /home/ouattara/Téléchargements/ComptaWest-master/marketing/remotion-apex
npm install
```

Durée : **3-6 minutes** la 1ère fois (télécharge ~350 Mo dont Chromium).

Tu verras :
- Plein de lignes `added X packages`
- Une fois : `Downloading Chromium 119.0.6045...` (c'est normal)
- À la fin : `added 450 packages in 4m`

### Étape 3 — Lancer Remotion Studio (preview live)

```bash
npm start
```

Ouvre automatiquement `http://localhost:3000` dans ton navigateur.

Tu verras 3 compositions dans la sidebar gauche :
- **Video90s** (90 secondes — landing)
- **Video30s** (30 secondes — ads)
- **Video15s** (15 secondes — TikTok hook)

Clique sur l'une, **scrubber la timeline** en bas (curseur), et regarde le rendu en temps réel.

## ⚠ Pour l'instant, les vidéos utilisent des PLACEHOLDERS

Toutes les captures dans `marketing/remotion-apex/public/` sont des PNG génériques affichant « PLACEHOLDER · 01 DASHBOARD », etc.

**Pour avoir le vrai rendu**, tu dois les remplacer par les vraies captures (voir liste détaillée dans `marketing/remotion-apex/public/CAPTURES_REQUISES.md`).

### Comment prendre les bonnes captures

1. Lance ApeX en local (`npm run dev` dans frontend/ et backend/)
2. Ouvre Firefox / Chrome → bouton « Tester en mode démo »
3. Maximise la fenêtre (F11 plein écran ou agrandi)
4. Pour chacune des 10 pages listées dans `CAPTURES_REQUISES.md` :
   - Va sur la page
   - Capture d'écran (Ctrl+Shift+S sur Firefox, ou outil capture système)
   - Sauve dans `marketing/remotion-apex/public/` avec le **nom exact** indiqué

**Astuce** : si tu veux des captures encore plus pro, utilise l'outil de capture **plein écran de l'élément** dans DevTools (F12 → ... → Capture screenshot of node).

### Après avoir mis les vraies captures

Plus besoin de redémarrer Remotion Studio — les images sont rechargées en hot reload. Rafraîchis la preview.

## 🎬 Générer les MP4 finaux

```bash
# La principale (90s) — ~5-7 min de rendu
npm run build:90s
# → out/apex-90s.mp4

# Pour Facebook/Instagram Ads (30s) — ~2-3 min
npm run build:30s
# → out/apex-30s.mp4

# Hook TikTok (15s) — ~1-2 min
npm run build:15s
# → out/apex-15s.mp4

# Les 3 d'un coup
npm run build:all
```

Les MP4 sortent en **1080×1920 / 30fps / H.264 / yuv420p**, prêts à uploader sur :
- TikTok / Reels / Shorts (vertical natif)
- WhatsApp Status (vertical natif)
- Facebook / Instagram Ads (Meta accepte le vertical)
- LinkedIn (carré ou vertical, vertical OK)

## 🛠 Dépannage

### « Chromium failed to launch »
```bash
# Forcer le re-téléchargement de Chromium
npx remotion lambda compositions
# Si ça persiste : installer chrome système comme fallback
sudo apt install -y chromium-browser
```

### Rendu très lent (> 10 min pour 90s)
Augmente la concurrence selon ton CPU (vérifie avec `nproc`) :
```bash
npx remotion render Video90s out/apex-90s.mp4 --concurrency 6
```

### « Cannot find module 'remotion' »
Tu n'es pas dans le bon dossier. `cd marketing/remotion-apex` AVANT toute commande npm.

### Aperçu pixelisé dans le navigateur
Zoom 100 % dans le navigateur (Ctrl+0). Les MP4 sont en 1080×1920 réel, l'aperçu Studio est juste downscalé.

## ✅ Checklist avant publication

- [ ] 10 captures réelles dans `public/` (pas les placeholders)
- [ ] Voix off enregistrée dans `public/voixoff-90s.mp3` (optionnel mais recommandé)
- [ ] `npm run build:all` exécuté avec succès
- [ ] Les 3 MP4 testés dans VLC ou QuickTime (son + image OK)
- [ ] Test sur ton téléphone (visuel mobile = test de vérité)
