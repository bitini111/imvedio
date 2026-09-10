# 🇩🇪 Halo · KI-Studio

KI-gestützte Kreativ-App mit vier Modi: Text→Bild, Bild→Bild, Text→Video, Bild→Video. Offline-Demorahmen integriert. Keine Abhängigkeiten, funktioniert direkt im Browser.

<p align="center">
  <img src="https://raw.githubusercontent.com/bitini111/imvedio/main/homepage.png" alt="Halo KI-Studio Screenshot" width="800">
</p>

### Funktionen

- **Vier Krei-Modi**: Text→Img / Img→Img (1 Referenz) / Text→Video / Img→Video (bis 5 Referenzen)
- **Reiche Parameter**: Auflösung (1K/2K/3K/4K), Seitenverhältnis (1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / Benutzerdefiniert), Stil (Realistisch / Anime / Kino / Illustration / 3D), Dauer (5/10/benutzerdefiniert Sek), Kamera (Statisch / Hereinzoomen / Herauszoomen / Orbit / Folgen)
- **KI-Prompt-Optimierung**: Verbessere deine Prompts mit einem Klick dank des integrierten Textmodells
- **Lokaler Demomodus**: Offline-Modus mit Canvas + MediaRecorder; nahtloser Wechsel zu Agnes AI
- **MehrSprachig**: 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Português
- **Multi-Bild / Multi-Segment**: Generiere bis zu 4 Bilder auf einmal; Videos werden automatisch in Segmente geteilt
- **Verlauf**: IndexedDB-Persistenz, Typ-Filter, neu generieren oder löschen
- **Kontingent-System**: Konfigurierbares tägliches Limit mit Blockierung bei Überschreitung
- **Robuste UX**: Schutz vor leerem Prompt, Schutz vor fehlendem Bild, Verhinderung von Duplikat-Generierung, Fehler-Panel mit Wiederholungs-Button
- **Responsiv**: Kompatibel mit Desktop und Mobilgerät

### Agnes AI Integration

| Verwendung | Modell | Endpoint |
|---|---|---|
| Text / Prompt-Optimierung | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| Text→Bild / Bild→Bild | `agnes-image-2.5-flash` | `POST /v1/images/generations` |
| Text→Video / Bild→Video | `agnes-video-2.5-flash` oder `agnes-video-v2.0` | `POST /v1/videos` |

### Schneller Start

```bash
git clone https://github.com/bitini111/imvedio.git
cd imvedio
node server.js
# Öffne http://localhost:8653
```

Oder doppelklicke auf `index.html` zum direkten Öffnen (CORS-Beschränkungen ohne Server möglich).

### Technik-Stack

- Reines HTML / CSS / JavaScript — keine Abhängigkeiten, kein Build
- Video-Codierung mit nativem `MediaRecorder` + `captureStream`
- Verlauf mit IndexedDB, Kontingent mit localStorage
- Node.js-Server bietet statische Dateien + Agnes AI Reverse-Proxy
