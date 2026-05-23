# 🎬 Remotion ApeX — vidéos de présentation

Vidéos de marketing pour ApeX, codées en **React + Remotion**, rendues en MP4 vertical 1080×1920 (TikTok / Reels / WhatsApp Status / Shorts).

3 versions générées depuis le même code :

| Composition | Durée | Usage |
|---|---|---|
| `Video90s` | 90 s | Page de destination, landing, présentation longue |
| `Video30s` | 30 s | Facebook / Instagram Ads (campagnes payantes) |
| `Video15s` | 15 s | Hook TikTok / Reels / Shorts (scroll-stopper) |

---

## 🚀 Démarrage rapide

```bash
cd marketing/remotion-apex

# 1. Installer les dépendances (~3-5 min, première fois)
npm install

# 2. Lancer Remotion Studio (preview live dans le navigateur)
npm start
# → http://localhost:3000
# → Tu peux scrubber la timeline, prévisualiser chaque scène,
#   ajuster en temps réel
```

## 🎞 Générer les MP4

```bash
# Vidéo principale 90 s (~2-3 min de rendu)
npm run build:90s
# → out/apex-90s.mp4

# Version 30 s (ads payantes)
npm run build:30s
# → out/apex-30s.mp4

# Version 15 s (hook TikTok)
npm run build:15s
# → out/apex-15s.mp4

# Les 3 d'un coup
npm run build:all
```

Le fichier de sortie est en **1080×1920 / 30fps / H.264 / yuv420p**, prêt à uploader directement sur TikTok, Instagram, WhatsApp Status, YouTube Shorts, LinkedIn, Facebook Ads, etc.

---

## 🧩 Structure du code

```
src/
├── index.ts          Entry point (registerRoot)
├── Root.tsx          Liste des Compositions
├── theme.ts          Palette couleurs ApeX (émeraude, vert clair, noir…)
├── Video90s.tsx      Vidéo principale (séquences 6 scènes)
├── Video30s.tsx      Version ads
├── Video15s.tsx      Version hook
└── components/
    ├── LogoApex.tsx       Pictogramme officiel + texte
    ├── ExcelChaos.tsx     Scène d'ouverture (chaos Excel avec #REF!)
    ├── PainStack.tsx      Empilement des 3 douleurs (amende FNE, paie, Wave)
    ├── Stop.tsx           Bascule narrative (« Stop. ApeX. »)
    ├── DemoFlow.tsx       4 démos : facture FNE, paiement, paie, bilan
    ├── Pricing.tsx        Prix barré + « DÉMO GRATUITE »
    └── Outro.tsx          CTA apex.ci + provocation finale
```

---

## ✏️ Personnaliser

**Changer un texte** : ouvre le composant concerné dans `components/`, modifie la chaîne. La preview Remotion Studio se rafraîchit en temps réel.

**Changer une couleur** : tout est centralisé dans `theme.ts` (COLORS). Modifie une valeur, toute la vidéo s'adapte.

**Ajouter une scène** : crée un nouveau composant dans `components/`, importe-le dans `Video90s.tsx`, ajoute un `<Sequence from={...} durationInFrames={...}>`.

**Changer le format** (horizontal 16:9 pour YouTube) : dans `Root.tsx`, passe `width={1920} height={1080}`. Tous les composants en `AbsoluteFill` s'adaptent automatiquement.

---

## 🎙 Voix off

Le code génère la vidéo **sans voix off** (texte seul à l'écran). Pour ajouter la voix off du script (voir `marketing/script-vo.md`) :

1. Enregistre la voix au téléphone (Voice Memo, AAC, mono, 44 kHz)
2. Mets le fichier dans `public/voixoff-90s.mp3`
3. Dans `Video90s.tsx`, ajoute en haut :
   ```tsx
   import { Audio, staticFile } from 'remotion';
   ```
4. Dans le `return`, ajoute `<Audio src={staticFile('voixoff-90s.mp3')} />`
5. Re-build : `npm run build:90s`

---

## 🆘 Dépannage

**Erreur Chromium au premier `npm install`** : Remotion télécharge un Chromium headless (~150 Mo). Si le réseau coupe :
```bash
npx remotion lambda compositions   # force le re-téléchargement
```

**Rendu trop lent** : augmente la concurrence
```bash
npx remotion render Video90s out/apex-90s.mp4 --concurrency 4
```

**Aperçu déformé** : assure-toi que ton zoom navigateur est à 100 % en ouvrant Remotion Studio.

---

## 📦 Build production-ready

Pour générer en haute qualité (ralentit le rendu mais qualité maximale) :
```bash
npx remotion render Video90s out/apex-90s-hq.mp4 --crf 18 --pixel-format yuv420p
```
- `--crf 18` : qualité visuelle quasi-perfect (par défaut Remotion = 22)
- Compatible Instagram, TikTok, YouTube sans re-compression visible.
