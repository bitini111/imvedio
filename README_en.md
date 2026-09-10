# 🌍 Halo · AI Studio

An AI-powered creative app with four modes: Text-to-Image, Image-to-Image, Text-to-Video, and Image-to-Video. Powered by Agnes AI with a built-in offline fallback engine. Zero dependencies, works directly in the browser.

<p align="center">
  <img src="https://raw.githubusercontent.com/bitini111/imvedio/main/homepage.png" alt="Halo AI Studio screenshot" width="800">
</p>

### Features

- **Four Creation Modes**: Text→Img / Img→Img (1 reference) / Text→Video / Img→Video (up to 5 references)
- **Rich Parameters**: Resolution (1K/2K/3K/4K), Aspect Ratio (1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / Custom), Style (Realistic / Anime / Cinematic / Illustration / 3D), Duration (5/10/custom sec), Camera (Still / Push In / Pull Back / Orbit / Follow)
- **AI Prompt Optimization**: One-click refine your prompts with the built-in text model
- **Local Demo Engine**: Offline mode using Canvas + MediaRecorder; switch to real AI seamlessly
- **Multi-Language**: 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Português
- **Multi-Image / Multi-Segment**: Generate up to 4 images at once; videos auto-split into segments
- **History**: IndexedDB persistence, filter by type, regenerate or delete
- **Quota System**: Configurable daily limit with over-limit blocking
- **Robust UX**: Empty prompt guard, missing image guard, duplicate generation prevention, error panel with retry
- **Responsive**: Works on desktop and mobile

### Agnes AI Integration

| Use Case | Model | Endpoint |
|---|---|---|
| Text / Prompt Optimization | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| Text-to-Image / Image-to-Image | `agnes-image-2.5-flash` | `POST /v1/images/generations` |
| Text-to-Video / Image-to-Video | `agnes-video-2.5-flash` or `agnes-video-v2.0` | `POST /v1/videos` |

### Quick Start

```bash
git clone https://github.com/bitini111/imvedio.git
cd imvedio
node server.js
# Open http://localhost:8653
```

Or double-click `index.html` to open directly (may hit CORS without the server).

### Tech Stack

- Vanilla HTML / CSS / JavaScript — zero dependencies, no build step
- Video encoding via native `MediaRecorder` + `captureStream`
- History via IndexedDB, quota via localStorage
- Node.js server provides static file serving + Agnes API reverse proxy
