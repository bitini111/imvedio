# 🇰🇷 Halo · AI 스터디

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
