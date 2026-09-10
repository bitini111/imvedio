# 🇧🇷 Halo · IA Criativo

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
