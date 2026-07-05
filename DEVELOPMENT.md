# MemoGraph 개발 가이드

## 현재 구현 완료된 기능 (Phase 1-5)

### Phase 1: Electron 초기 프로젝트 ✅
- Electron + React + Vite + TypeScript
- Main Process / Preload / Renderer 구조
- IPC 통신 시스템

### Phase 2: Vault 관리 ✅
- Vault 생성 및 열기
- vault.json 설정 파일 관리
- 최근 Vault 목록 (localStorage)

### Phase 3: Note 기능 ✅
- Markdown 파일 CRUD
- Sidebar 파일 목록
- 노트 선택 및 내용 표시

### Phase 4: Editor ✅
- CodeMirror6 기반 Markdown 에디터
- Syntax highlighting (oneDark theme)
- react-markdown Preview
- Edit/Split/Preview 뷰 모드
- Ctrl+S 저장

### Phase 5: Markdown Parser ✅
- WikiLink 파싱: `[[link]]`, `[[link|alias]]`, `[[link#heading]]`
- Tag 파싱: `#tag`, `#nested/tag`
- YAML Front Matter 파싱
- Position tracking

---

## 개발 환경 설정

### 필수 요구사항
- Node.js >= 18.0.0
- npm >= 9.0.0

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. Desktop 앱 개발 모드 실행
cd apps/desktop

# 방법 1: Vite dev server와 Electron을 동시에 실행
npm run electron:dev

# 방법 2: 별도 터미널에서 실행
# 터미널 1
npm run dev

# 터미널 2
npm run electron
```

### 프로젝트 구조

```
memograph/
├── apps/desktop/              # Electron 앱
│   ├── src/
│   │   ├── main/             # Main Process
│   │   │   ├── index.ts
│   │   │   ├── ipc/          # IPC 핸들러
│   │   │   └── services/     # 비즈니스 로직
│   │   ├── preload/          # Preload 스크립트
│   │   └── renderer/         # React UI
│   │       └── src/
│   │           ├── components/
│   │           ├── pages/
│   │           └── stores/
│   └── index.html
└── packages/core/            # 도메인 모델
    └── src/
        ├── domain/           # Note, Vault, Link, Tag
        └── parser/           # Markdown 파서
```

---

## 사용 방법

### 1. Vault 생성
1. 앱 실행 후 "Create New Vault" 클릭
2. Vault 이름 입력 (예: "My Knowledge Base")
3. 저장할 폴더 선택
4. Vault가 생성되고 자동으로 열림

### 2. Note 작성
1. Sidebar에서 "+" 버튼 클릭
2. 노트 이름 입력 (예: "Getting Started")
3. CodeMirror 에디터에서 Markdown 작성
4. Ctrl+S 또는 Save 버튼으로 저장

### 3. 뷰 모드 전환
- **Edit**: 에디터만 표시
- **Split**: 에디터 + 프리뷰 동시 표시
- **Preview**: 프리뷰만 표시

### 4. Markdown 문법

#### WikiLink
```markdown
[[Kafka]]                    # 다른 노트 링크
[[Kafka|카프카]]              # Alias 지정
[[Kafka#Producer]]           # 특정 섹션으로 링크
```

#### Tags
```markdown
#backend                     # 단순 태그
#infra/kubernetes            # 계층 태그
```

#### YAML Front Matter
```markdown
---
title: My Note
tags: [backend, java]
created: 2024-01-01
---

# Content starts here
```

---

## Vault 구조

```
My Vault/
├── vault.json              # Vault 설정
├── Notes/                  # 기본 노트 폴더
│   ├── Getting Started.md
│   └── Kafka.md
├── Assets/                 # 에셋 폴더
└── .memograph/             # 메타데이터 (추후 SQLite)
```

### vault.json 예시
```json
{
  "version": "1.0.0",
  "name": "My Knowledge Base",
  "defaultNoteLocation": "Notes",
  "defaultAssetLocation": "Assets"
}
```

---

## 기술 스택

### Frontend
- **UI Framework**: React 18
- **Build Tool**: Vite 5
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand
- **Editor**: CodeMirror 6
- **Markdown Rendering**: react-markdown + remark-gfm

### Desktop
- **Runtime**: Electron 28
- **File System**: Node.js fs/promises
- **IPC**: Electron IPC (Main ↔ Renderer)

### Parser
- **Markdown**: unified + remark
- **Custom Parser**: WikiLink, Tags, YAML Front Matter

---

## 다음 단계 (Phase 6-11)

### Phase 6: Indexer + SQLite (보류)
- better-sqlite3 설치 (Visual Studio Build Tools 필요)
- 또는 sql.js (WebAssembly) 대안
- Vault 전체 스캔 및 인덱싱
- Links, Tags 테이블 생성

### Phase 7: Backlink
- 현재 노트를 참조하는 노트 목록
- 양방향 링크 시각화

### Phase 8: Graph View
- React Flow 기반 그래프 뷰
- 노트 간 연결 시각화
- 노드 클릭으로 노트 이동

### Phase 9: Search
- 전체 텍스트 검색
- 태그 필터
- WikiLink 검색

### Phase 10-11: Google Drive
- OAuth 인증
- Backup (로컬 → Drive)
- Import (Drive → 로컬)

---

## 알려진 제한사항

1. **SQLite 미구현**: Phase 6 이후 추가 예정
2. **WikiLink 클릭 불가**: UI에 표시되지만 클릭 기능 없음 (Phase 7 이후)
3. **검색 기능 없음**: Phase 9에서 구현 예정
4. **자동 저장 없음**: 수동 저장만 지원 (Ctrl+S)
5. **충돌 해결 없음**: 동시 편집 지원 안 함

---

## 문제 해결

### Electron이 실행되지 않을 때
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### Vite dev server 오류
```bash
# 포트 충돌 시 package.json의 포트 변경
# apps/desktop/vite.config.ts의 server.port 수정
```

### TypeScript 타입 오류
```bash
cd apps/desktop
npm run type-check
```

---

## 라이선스

MIT

---

## 기여

GitHub: https://github.com/shsha4/rememo
