# MemoGraph

Local-first Markdown Knowledge Graph Desktop Application

## 개발 상태

### ✅ Phase 1: Electron 초기 프로젝트 (완료)
- Electron + React + Vite + TypeScript 설정
- Main Process, Preload, Renderer 구조
- IPC 통신 기본 설정
- 기본 UI 레이아웃

### ✅ Phase 2: Vault 관리 (완료)
- File Service (폴더 선택, 파일 읽기/쓰기)
- Vault Service (vault.json 기반)
- Vault 생성 및 열기 기능
- 최근 Vault 목록

### ✅ Phase 3: Note 기능 (완료)
- Note Service (Markdown 파일 CRUD)
- Sidebar 파일 목록
- 기본 텍스트 에디터
- Ctrl+S 저장 기능

### ✅ Phase 4: Editor (완료)
- CodeMirror6 통합
- Markdown Preview (react-markdown + remark-gfm)
- Split View (Edit/Preview/Split 모드)
- Ctrl+S 저장 기능

### 🔜 Phase 5: Markdown Parser
- WikiLink 파싱 (`[[link]]`)
- Alias 지원 (`[[link|alias]]`)
- Heading Link (`[[note#heading]]`)
- Tag 추출 (`#tag`)

### 🔜 Phase 6: Indexer + SQLite
- SQLite 설정
- Vault 전체 스캔
- Index 생성 및 갱신

### 🔜 Phase 7-11
- Backlink
- Graph View
- Search
- Google Drive Backup
- Google Drive Import

## 프로젝트 구조

```
memograph/
├── apps/
│   └── desktop/          # Electron 앱
│       ├── src/
│       │   ├── main/     # Main Process
│       │   ├── preload/  # Preload Script
│       │   └── renderer/ # React UI
│       └── index.html
└── packages/
    └── core/             # 도메인 모델
```

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행
cd apps/desktop
npm run dev

# 별도 터미널에서 Electron 실행
npm run electron
```

또는 concurrently 사용:

```bash
cd apps/desktop
npm run electron:dev
```

## 기술 스택

- **Desktop**: Electron
- **UI**: React + TypeScript
- **Build**: Vite
- **State**: Zustand
- **Markdown**: 추후 CodeMirror6, remark, unified
- **Database**: 추후 better-sqlite3 (Phase 6)
- **Graph**: 추후 React Flow (Phase 8)

## 핵심 철학

- **Markdown 파일이 원본 데이터** (Source of Truth)
- **SQLite는 인덱스 저장소** (Phase 6에서 추가)
- **Local First & Offline First**
- **Google Drive 백업/복원 지원** (Phase 10-11)
- **AI/RAG 확장 가능 설계**

## 라이선스

MIT
