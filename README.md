# 绘光 Halo · AI 文生图 / 图生图 / 文生视频 / 图生视频

基于 Agnes AI 的四模式创作应用。输入一句提示词，或加上传参图片，即可生成图片和短视频，可下载、有历史记录、支持配额管理。零依赖、可直接双击打开，也可启动 Node 服务器获得完整的 API 同源代理能力。

## 特性一览

- **四种创作模式**：文生图 / 图生图（1 张参考图）/ 文生视频 / 图生视频（最多 5 张参考图）
- **丰富参数**：分辨率（1K/2K/3K/4K）、比例（1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / 自定义宽高）、风格（写实 / 动漫 / 电影感 / 插画 / 3D）、视频时长（5/10/自定义秒）与运镜（静止 / 推进 / 拉远 / 环绕 / 跟随）
- **AI 描述优化**：内置文本模型一键润色你的提示词，让生成结果更贴合预期
- **本地演示引擎**：无网络时可用内置 Canvas + MediaRecorder 演示整个流程；接入真实 Agnes AI 后无缝切换
- **多图/多段生成**：一次请求 4 张图片；视频超过单段上限时自动拆段、流水线生成、分段播放
- **历史记录**：IndexedDB 持久化，按类型筛选，支持再次生成 / 删除
- **配额系统**：可配置每日上限，超额拦截并提示
- **健壮交互**：空提示词拦截、缺图拦截、生成中防重复提交、错误面板带原因说明与重试按钮
- **全端适配**：桌面与移动端均可使用，响应式布局

## 对接的 Agnes AI 接口

| 用途 | 模型 | 接口 |
|---|---|---|
| 文本 / 描述优化 | `agnes-2.5-flash` | `POST /v1/chat/completions` |
| 文生图 / 图生图 | `agnes-image-2.5-flash` | `POST /v1/images/generations`（图生图传 `extra_body.image`） |
| 文生视频 / 图生视频 | `agnes-video-2.5-flash` 或 `agnes-video-v2.0` | `POST /v1/videos` 提交异步任务，轮询 `/agnesapi?video_id=…` |

详细说明见 [Agnes AI 文档](https://www.agnes-ai.com/zh-Hans/docs/)。

## 技术栈

- 纯原生 HTML / CSS / JavaScript，无任何第三方依赖，无需构建
- 视频编码使用浏览器原生 `MediaRecorder` + `captureStream`
- 历史记录使用 IndexedDB，配额使用 localStorage
- Node.js 服务器提供静态文件服务 + Agnes API 同源代理（解决浏览器 CORS 限制）

## 文件结构

```
imvedio/
├── index.html         # 应用入口
├── server.js          # Node 静态服务 + API 代理
├── README.md          # 本文档
├── LICENSE
├── css/
│   └── style.css      # 全部样式
└── js/
    ├── rng.js         # 可复现伪随机数
    ├── art.js         # 本地预览引擎（Canvas + WebM）
    ├── agnes.js       # Agnes AI 客户端
    ├── storage.js     # IndexedDB 历史 + localStorage 配额
    └── app.js         # 应用控制器（业务逻辑）
```

## 运行方式

### 方式一：直接打开（浏览器直连 Agnes）

```bash
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

适合快速体验。注意：浏览器直连 Agnes API 可能遇到 CORS 限制，若请求失败请切换到方式二。

### 方式二：本地服务器（推荐，含 API 代理）

需要 [Node.js 18+](https://nodejs.org/)。

```bash
# 克隆仓库
git clone https://github.com/bitini111/imvedio.git
cd imvedio

# 启动服务（默认端口 8653）
node server.js

# 访问 http://localhost:8653
```

也可指定端口：

```bash
PORT=3000 node server.js
```

服务器同时提供：
- 静态文件服务（`/` → `index.html`）
- Agnes API 同源代理（`/api/*` → `https://apihub.agnes-ai.com/v1/*`）

### 方式三：任意静态服务器

把整个仓库拷贝到任意 HTTP 服务器根目录即可（Nginx / Vercel / GitHub Pages 等）。若使用 GitHub Pages，因无后端代理，需配合浏览器 CORS 扩展或自建代理服务。

## 使用步骤

1. **选择模式**：顶栏切换「文生图 / 图生图 / 文生视频 / 图生视频」
2. **输入提示词**：在「画面描述」框中输入，或点示例词 / 「✨ 自动优化描述」
3. **设置参数**：分辨率、比例、风格（图片）/ 时长、运镜（视频）
4. **上传参考图**（图生图 / 图生视频）：拖拽或点击上传
5. **点击生成**：等待进度条完成后查看结果
6. **操作结果**：放大预览 / 播放 / 下载 / 再次生成 / 继续修改提示词
7. **历史记录**：点击顶栏「历史」查看全部记录，支持筛选、再次生成、删除

## 配置说明

点顶栏齿轮「设置」可调整：

- **生成引擎**：`AI 接口`（调用 Agnes AI）或 `本地演示`（离线用 Canvas 引擎）
- **API 密钥**：填入 Agnes API Key（默认已预置，保存在浏览器 localStorage）
- **视频接口**：`2.5 Flash`（推荐，支持多图参考）或 `V2.0`（兼容旧接口）
- **每日生成次数上限**：默认 1000，可按需调整
- **测试连接**：点击验证密钥与网络是否可用

> **安全提示**：演示版密钥已预置在前端代码中，仅适合个人使用。正式上线前请：
> 1. 把密钥移到服务端保管，前端不再下发密钥
> 2. 对 `/api/*` 代理增加鉴权与限流
> 3. 不在公开仓库中暴露密钥

## 本地演示引擎

当 `AI 接口` 不可用时（无网络 / 额度耗尽 / 服务端异常），应用会自动退回本地引擎：

- **图片**：用 Canvas 根据提示词 + 风格程序化绘制风格化画面（渐变天空、天体、山脊、光晕、粒子）
- **视频**：基于参考图或程序化场景，用 `captureStream` + `MediaRecorder` 录制为可下载的 WebM 文件
- **效果**：并非真实 AI 生成，但流程完整（输入 → 生成 → 预览 → 下载 → 历史），适合演示与开发调试

## 视频时长说明

Agnes Video 2.5 Flash 单次最长约 12 秒，V2.0 最长约 18 秒。选择 30 秒 / 1 分钟时，应用会自动拆成多段（每段 10 秒）依次提交、轮询、合成播放，用户无需手动拼接。

## 开发者快速上手

```bash
# 1. 克隆并进入目录
git clone https://github.com/bitini111/imvedio.git
cd imvedio

# 2. 启动服务
node server.js

# 3. 打开浏览器
open http://localhost:8653

# 4. 如需修改密钥，打开 JS 控制台运行：
# Agnes.saveConfig({ ...Agnes.loadConfig(), apiKey: '你的新密钥' })
```

## 贡献指南

欢迎提 Issue 和 Pull Request。主要关注点：

- 保持零依赖、无构建流程的设计原则
- 新增功能前先确认浏览器兼容性（目标 Chrome / Edge / Safari 最新两版）
- 涉及 Agnes API 的请求务必走 `/api/*` 代理，不要直连（避免 CORS）
- 提交前请用 `node server.js` 自测核心流程：四模式切换、生成、下载、历史记录

## 许可证

[MIT License](LICENSE)