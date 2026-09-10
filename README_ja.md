# 🇯🇵 Halo · AI スタジオ

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
