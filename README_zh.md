# 🌏 绘光 Halo

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
