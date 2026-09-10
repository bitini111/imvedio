# 绘光 Halo · AI Image & Video Studio

> A zero-dependency, multi-language AI creation app — text-to-image, image-to-image, text-to-video, image-to-video.
> Powered by Agnes AI with offline fallback engine.

<div align="center">

[简体中文](#-绘光-halo) · [English](#-halo-ai-studio) · [日本語](#-halo-ai-スタジオ) · [한국어](#-halo-ai-스터디) · [Español](#-halo-ai-estudio) · [Français](#-halo-ai-atelier) · [Deutsch](#-halo-ki-studio) · [Português](#-halo-ia-criativo)

</div>

---

## 🌏 绘光 Halo

基于 Agnes AI 的四模式创作应用。输入一句提示词，或加上传参图片，即可生成图片和短视频，可下载、有历史记录、支持配额管理。零依赖、可直接双击打开，也可启动 Node 服务器获得完整的 API 同源代理能力。

<p align="center">
  <img src="https://raw.githubusercontent.com/bitini111/imvedio/main/homepage.png" alt="绘光 Halo 界面截图" width="800">
</p>

### 特性一览

- **四种创作模式**：文生图 / 图生图（1 张参考图）/ 文生视频 / 图生视频（最多 5 张参考图）
- **丰富参数**：分辨率（1K/2K/3K/4K）、比例（1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / 自定义宽高）、风格（写实 / 动漫 / 电影感 / 插画 / 3D）、视频时长（5/10/自定义秒）与运镜（静止 / 推进 / 拉远 / 环绕 / 跟随）
- **AI 描述优化**：内置文本模型一键润色你的提示词，让生成结果更贴合预期
- **本地演示引擎**：无网络时可用内置 Canvas + MediaRecorder 演示整个流程；接入真实 Agnes AI 后无缝切换
- **多语言支持**：中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Português
- **多图/多段生成**：一次请求 4 张图片；视频超过单段上限时自动拆段、流水线生成、分段播放
- **历史记录**：IndexedDB 持久化，按类型筛选，支持再次生成 / 删除
- **配额系统**：可配置每日上限，超额拦截并提示
- **健壮交互**：空提示词拦截、缺图拦截、生成中防重复提交、错误面板带原因说明与重试按钮
- **全端适配**：桌面与移动端均可使用，响应式布局

### 对接的 Agnes AI 接口

| 用途 | 模型 | 接口 |
|---|---|---|
| 文本 / 描述优化 | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| 文生图 / 图生图 | `agnes-image-2.5-flash` | `POST /v1/images/generations` |
| 文生视频 / 图生视频 | `agnes-video-2.5-flash` 或 `agnes-video-v2.0` | `POST /v1/videos` |

### 运行方式

```bash
# 克隆仓库
git clone https://github.com/bitini111/imvedio.git
cd imvedio

# 启动服务
node server.js

# 访问 http://localhost:8653
```

也可直接双击 `index.html` 打开（浏览器直连 Agnes，可能遇 CORS 限制）。

### 技术栈

- 纯原生 HTML / CSS / JavaScript，无任何第三方依赖，无需构建
- 视频编码使用浏览器原生 `MediaRecorder` + `captureStream`
- 历史记录使用 IndexedDB，配额使用 localStorage
- Node.js 服务器提供静态文件服务 + Agnes API 同源代理

---

## 🌍 Halo · AI Studio

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

---

## 🇯🇵 Halo · AI スタジオ

Agnes AI 搭載のクリエイティブアプリ。テキスト→画像、画像→画像、テキスト→動画、画像→動画の4モードに対応。オフライン対応のローカルデモエンジンも内蔵。依存ゼロ、ブラウザで直接動作。

<p align="center">
  <img src="https://raw.githubusercontent.com/bitini111/imvedio/main/homepage.png" alt="Halo AI Studio スクリーンショット" width="800">
</p>

### 主な機能

- **4つの创作モード**：テキスト→画像 / 画像→画像（参考図1枚）/ テキスト→動画 / 画像→動画（最大5枚）
- **豊富なパラメータ**：解像度（1K/2K/3K/4K）、アスペクト比（1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / カスタム）、スタイル（写実 / アニメ / シネマティック / イラスト / 3D）、動画时长（5/10/カスタム秒）、カメラ（静止 / 推进 / 拉远 / 环绕 / 跟随）
- **AI プロンプト最適化**：内蔵テキストモデルでワンクリックでプロンプトを潤色
- **ローカルデモエンジン**：ネットワークなしでも Canvas + MediaRecorder で全程演示；Agnes AI とシームレス切替
- **多言語対応**：中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Português
- **多图/多段生成**：一度に4枚画像生成；動画は自動でセグメント分割
- **履歴管理**：IndexedDB 永続化、タイプ別フィルタ、再生成 / 削除対応
- **クォータシステム**：日次上限設定可能、超過時にブロック
- **堅牢な UX**：空プロンプトガード、欠陥画像ガード、重複生成防止、エラーパネル付き
- **レスポンシブ**：デスクトップ・モバイル両対応

### Agnes AI インターフェース

| 用途 | モデル | エンドポイント |
|---|---|---|
| テキスト / プロンプト最適化 | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| テキスト→画像 / 画像→画像 | `agnes-image-2.5-flash` | `POST /v1/images/generations` |
| テキスト→動画 / 画像→動画 | `agnes-video-2.5-flash` または `agnes-video-v2.0` | `POST /v1/videos` |

### クイックスタート

```bash
git clone https://github.com/bitini111/imvedio.git
cd imvedio
node server.js
# http://localhost:8653 を開く
```

または `index.html` をダブルクリックで直接開く（サーバーなしでは CORS 制限あり）。

### 技術スタック

- バニラ HTML / CSS / JavaScript — 依存ゼロ、ビルド不要
- 動画エンコーディングはネイティブ `MediaRecorder` + `captureStream`
- 履歴は IndexedDB、クォータは localStorage
- Node.js サーバーが静的ファイル提供 + Agnes API リバースプロキシを提供

---

## 🇰🇷 Halo · AI 스터디

Agnes AI 기반의 크리에이티브 앱. 텍스트→이미지, 이미지→이미지, 텍스트→영상, 이미지→영상 4개 모드를 지원합니다. 오프라인対応 로컬 데모 엔진 내장. 의존성 제로, 브라우저에서 바로 동작.

<p align="center">
  <img src="https://raw.githubusercontent.com/bitini111/imvedio/main/homepage.png" alt="Halo AI Studio 스크린샷" width="800">
</p>

### 주요 기능

- **4가지创作 모드**: 텍스트→이미지 / 이미지→이미지 (참조 이미지 1장) / 텍스트→영상 / 이미지→영상 (최대 5장)
- **풍부한 파라미터**: 해상도 (1K/2K/3K/4K), 종횡비 (1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / 맞춤), 스타일 (리얼리즘 / 애니메이션 / 시네마틱 / 일러스트 / 3D), 영상 길이 (5/10/맞춤 초), 카메라 (고정 / 접근 / 후퇴 / 서라운드 / 추종)
- **AI 프롬프트 최적화**: 내장 텍스트 모델로 원클릭 프롬프트 개선
- **로컬 데모 엔진**: 네트워크 없이도 Canvas + MediaRecorder로 전체 프로세스演示; Agnes AI 와 시무스切換
- **다국어 지원**: 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Português
- **多图/다중 세그먼트**: 한 번에 4장 이미지 생성; 영상은 자동 분할
- **기록 관리**: IndexedDB 영구 저장, 유형별 필터, 재생성 / 삭제 지원
- **할당량 시스템**: 일일 제한 설정 가능, 초과 시 차단
- **견고한 UX**: 빈 프롬프트 가드, 누락 이미지 가드, 중복 생성 방지, 오류 패널 포함
- **반응형**: 데스크톱·모바일 양쪽 대응

### Agnes AI 인터페이스

| 용도 | 모델 | 엔드포인트 |
|---|---|---|
| 텍스트 / 프롬프트 최적화 | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| 텍스트→이미지 / 이미지→이미지 | `agnes-image-2.5-flash` | `POST /v1/images/generations` |
| 텍스트→영상 / 이미지→영상 | `agnes-video-2.5-flash` 또는 `agnes-video-v2.0` | `POST /v1/videos` |

### 빠른 시작

```bash
git clone https://github.com/bitini111/imvedio.git
cd imvedio
node server.js
# http://localhost:8653 열기
```

또는 `index.html` 더블클릭으로 직접 열기 (서버 없이 CORS 제한 있음).

### 기술 스택

- 바닐라 HTML / CSS / JavaScript — 의존성 제로, 빌드 불필요
- 영상 인코딩은 네이티브 `MediaRecorder` + `captureStream`
- 기록은 IndexedDB, 할당량은 localStorage
- Node.js 서버가 정적 파일 제공 + Agnes API 리버스 프록시 제공

---

## 🇪🇸 Halo · AI Estudio

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

---

## 🇫🇷 Halo · AI Atelier

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

---

## 🇩🇪 Halo · KI-Studio

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

---

## 🇧🇷 Halo · IA Criativo

Aplicativo criativo impulsionado por Agnes AI com quatro modos: Texto→Imagem, Imagem→Imagem, Texto→Vídeo, Imagem→Vídeo. Motor de demonstração offline integrado. Zero dependências, funciona diretamente no navegador.

<p align="center">
  <img src="https://raw.githubusercontent.com/bitini111/imvedio/main/homepage.png" alt="Halo IA Criativo captura de tela" width="800">
</p>

### Recursos

- **Quatro modos de criação**: Texto→Img / Img→Img (1 referência) / Texto→Vídeo / Img→Vídeo (até 5 referências)
- **Parâmetros ricos**: Resolução (1K/2K/3K/4K), Proporção (1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / Personalizado), Estilo (Realista / Anime / Cinemático / Ilustração / 3D), Duração (5/10/personalizado seg), Câmera (Fixa / Zoom in / Zoom out / Órbita / Acompanhar)
- **Otimização de prompts por IA**: Melhore seus prompts com um clique usando o modelo de texto integrado
- **Motor de demonstração local**: Modo offline usando Canvas + MediaRecorder; transição seamless para Agnes AI
- **Multi-idioma**: 中文 / English / 日本語 / 한국어 / Español / Français / Deutsch / Português
- **Multi-imagem / Multi-segmento**: Gere até 4 imagens de uma vez; vídeos divididos automaticamente em segmentos
- **Histórico**: Persistência IndexedDB, filtro por tipo, regenerar ou excluir
- **Sistema de cota**: Limite diário configurável com bloqueio ao exceder
- **UX robusta**: Proteção contra prompt vazio, proteção contra imagem ausente, prevenção de geração duplicada, painel de erro com botão de retry
- **Responsivo**: Compatível com desktop e mobile

### Integração Agnes AI

| Uso | Modelo | Endpoint |
|---|---|---|
| Texto / Otimização de prompts | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| Texto→Imagem / Imagem→Imagem | `agnes-image-2.5-flash` | `POST /v1/images/generations` |
| Texto→Vídeo / Imagem→Vídeo | `agnes-video-2.5-flash` ou `agnes-video-v2.0` | `POST /v1/videos` |

### Início Rápido

```bash
git clone https://github.com/bitini111/imvedio.git
cd imvedio
node server.js
# Abra http://localhost:8653
```

Ou dê dois cliques em `index.html` para abrir diretamente (limitações CORS possíveis sem o servidor).

### Stack Tecnológico

- HTML / CSS / JavaScript vanilla — zero dependências, sem build
- Codificação de vídeo com `MediaRecorder` + `captureStream` nativo
- Histórico com IndexedDB, cota com localStorage
- Servidor Node.js fornece arquivos estáticos + proxy reverso Agnes AI

---

**License: MIT** | Author: bitini111
