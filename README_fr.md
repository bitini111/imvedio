# 🇫🇷 Halo · AI Atelier

Application créative propulsée par Agnes AI avec quatre modes : Texte→Image, Image→Image, Texte→Vidéo, Image→Vidéo. Moteur de démonstration hors-ligne intégré. Zéro dépendance, fonctionne directement dans le navigateur.

<p align="center">
  <img src="https://raw.githubusercontent.com/bitini111/imvedio/main/homepage.png" alt="Halo AI Studio capture d'écran" width="800">
</p>

### Fonctionnalités

- **Quatre modes de création** : Texte→Img / Img→Img (1 référence) / Texte→Vidéo / Img→Vidéo (jusqu'à 5 références)
- **Paramètres riches** : Résolution (1K/2K/3K/4K), Ratio (1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / Personnalisé), Style (Réaliste / Anime / Cinématique / Illustration / 3D), Durée (5/10/personnalisé sec), Caméra (Fixe / Zoom avant / Zoom arrière / Orbite / Suivi)
- **Optimisation de prompts par IA** : Améliorez vos prompts en un clic avec le modèle texte intégré
- **Moteur de démonstration local** : Mode hors-ligne avec Canvas + MediaRecorder ; passage seamless à Agnes AI
- **Multi-langue** : 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Português
- **Multi-image / Multi-segment** : Génère jusqu'à 4 images à la fois ; vidéos divisées automatiquement en segments
- **Historique** : Persistance IndexedDB, filtre par type, régénérer ou supprimer
- **Système de quota** : Limite quotidienne configurable avec blocage à dépassement
- **UX robuste** : Protection contre prompt vide, protection contre image manquante, prévention de génération en double, panneau d'erreur avec réessay
- **Responsive** : Compatible bureau et mobile

### Intégration Agnes AI

| Usage | Modèle | Endpoint |
|---|---|---|
| Texte / Optimisation de prompts | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| Texte→Image / Image→Image | `agnes-image-2.5-flash` | `POST /v1/images/generations` |
| Texte→Vidéo / Image→Vidéo | `agnes-video-2.5-flash` ou `agnes-video-v2.0` | `POST /v1/videos` |

### Démarrage Rapide

```bash
git clone https://github.com/bitini111/imvedio.git
cd imvedio
node server.js
# Ouvrez http://localhost:8653
```

Ou double-cliquez sur `index.html` pour ouvrir directement (limites CORS possibles sans serveur).

### Stack Technique

- HTML / CSS / JavaScript vanilla — zéro dépendance, pas de build
- Encodage vidéo avec `MediaRecorder` + `captureStream` natif
- Historique avec IndexedDB, quota avec localStorage
- Serveur Node.js fournissant fichiers statiques + proxy inverse Agnes AI
