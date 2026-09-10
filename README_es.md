# 🇪🇸 Halo · AI Estudio

App creativo impulsado por Agnes AI con cuatro modos: Texto→Imagen, Imagen→Imagen, Texto→Video, Imagen→Video. Motor de demostración offline integrado. Cero dependencias, funciona directamente en el navegador.

<p align="center">
  <img src="https://raw.githubusercontent.com/bitini111/imvedio/main/homepage.png" alt="Halo AI Studio captura de pantalla" width="800">
</p>

### Características

- **Cuatro modos de creación**: Texto→Img / Img→Img (1 referencia) / Texto→Video / Img→Video (hasta 5 referencias)
- **Parámetros ricos**: Resolución (1K/2K/3K/4K), Relación de aspecto (1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / Personalizado), Estilo (Realista / Anime / Cinemático / Ilustración / 3D), Duración (5/10/personalizado seg), Cámara (Quieta / Acercar / Alejar / Órbita / Seguir)
- **Optimización de prompts con IA**: Mejora tus prompts con un clic usando el modelo de texto integrado
- **Motor de demostración local**: Modo offline usando Canvas + MediaRecorder; cambio seamless a Agnes AI
- **Multi-idioma**: 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Português
- **Multi-imagen / Multi-segmento**: Genera hasta 4 imágenes a la vez; videos se dividen automáticamente en segmentos
- **Historial**: Persistencia IndexedDB, filtro por tipo, regenerar o eliminar
- **Sistema de cuota**: Límite diario configurable con bloqueo al exceder
- **UX robusta**: Protección contra prompt vacío, protección contra imagen faltante, prevención de generación duplicada, panel de errores con reintento
- **Responsivo**: Compatible con escritorio y móvil

### Integración Agnes AI

| Uso | Modelo | Endpoint |
|---|---|---|
| Texto / Optimización de prompts | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| Texto→Imagen / Imagen→Imagen | `agnes-image-2.5-flash` | `POST /v1/images/generations` |
| Texto→Video / Imagen→Video | `agnes-video-2.5-flash` o `agnes-video-v2.0` | `POST /v1/videos` |

### Inicio Rápido

```bash
git clone https://github.com/bitini111/imvedio.git
cd imvedio
node server.js
# Abre http://localhost:8653
```

O haz doble clic en `index.html` para abrir directamente (puede tener límites CORS sin el servidor).

### Stack Tecnológico

- HTML / CSS / JavaScript vanilla — cero dependencias, sin build
- Codificación de video con `MediaRecorder` + `captureStream` nativo
- Historial con IndexedDB, cuota con localStorage
- Servidor Node.js que proporciona archivos estáticos + proxy inverso de Agnes AI
