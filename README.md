# rememo

로컬 우선 마크다운 기반 지식 그래프 데스크톱 애플리케이션

## 소개

rememo는 마크다운 파일을 기반으로 개인 지식을 관리하고 연결하는 데스크톱 애플리케이션입니다. Obsidian, Logseq와 유사하게 노트 간 링크를 통해 지식 그래프를 구축하며, 모든 데이터는 로컬 파일 시스템에 저장되어 완전한 데이터 소유권을 보장합니다.

## 주요 기능

### 📝 마크다운 에디터
- CodeMirror 6 기반의 강력한 마크다운 편집기
- 실시간 미리보기 (Edit / Preview / Split 모드)
- 다크 테마 지원
- Ctrl+S 단축키로 빠른 저장

### 🔗 지식 연결
- **WikiLink**: `[[노트 이름]]` 형식으로 노트 간 링크 생성
- **앨리어스**: `[[노트 이름|표시 이름]]` 형식으로 링크 텍스트 커스터마이징
- **헤딩 링크**: `[[노트 이름#제목]]` 형식으로 특정 섹션으로 이동
- **백링크**: 현재 노트를 참조하는 다른 노트 자동 표시

### 🏷️ 태그 시스템
- `#태그` 형식으로 노트 분류
- `#중첩/태그` 형식으로 계층적 태그 구조 지원
- 태그 기반 노트 검색

### 🕸️ 지식 그래프
- 노트 간 연결 관계를 시각적으로 표시
- React Flow 기반의 인터랙티브 그래프 뷰
- 노드 클릭으로 해당 노트로 즉시 이동

### 🔍 빠른 검색
- SQLite 기반의 전체 텍스트 검색
- 노트 제목과 내용에서 한글 포함 모든 언어 검색 지원
- 실시간 검색 결과 표시

### 📂 Vault 관리
- 여러 Vault(지식 저장소) 생성 및 관리
- 최근 사용한 Vault 목록
- 각 Vault는 독립적인 설정과 인덱스 유지

### ⚡ 실시간 동기화
- 파일 시스템 변경 자동 감지 (chokidar)
- 외부 에디터에서 수정한 내용 자동 반영
- 인덱스 자동 업데이트

## 다운로드 및 설치

### Windows

#### 포터블 버전 (권장)
1. [Releases](../../releases) 페이지에서 `rememo-x.x.x-windows-portable.zip` 다운로드
2. 원하는 위치에 압축 해제
3. `rememo.exe` 실행

#### 설치 프로그램
1. [Releases](../../releases) 페이지에서 `rememo-x.x.x-Setup.exe` 다운로드
2. 설치 프로그램 실행
3. 설치 마법사 따라하기

### 시스템 요구사항
- Windows 10 이상
- 약 250MB 여유 공간

## 사용 방법

### 1. Vault 생성
처음 실행 시 "Create Vault" 버튼을 클릭하여 새 지식 저장소를 생성합니다.
- Vault 이름 입력
- 저장할 폴더 선택
- 생성 완료

### 2. 노트 작성
- 좌측 사이드바의 `+` 버튼을 클릭하여 새 노트 생성
- 노트 이름 입력 후 Enter
- 마크다운 형식으로 노트 작성
- Ctrl+S로 저장

### 3. 노트 연결
노트 내에서 다른 노트를 참조하려면:
```markdown
[[다른 노트 이름]]
[[다른 노트|표시할 이름]]
[[다른 노트#특정 제목]]
```

### 4. 태그 사용
```markdown
#프로젝트 #개발/프론트엔드
```

### 5. 노트 이름 변경
- 좌측 사이드바에서 노트 이름을 더블클릭
- 새 이름 입력 후 Enter

### 6. 그래프 보기
- 상단의 "Graph" 탭 클릭
- 노트 간 연결 관계 시각화 확인
- 노드를 드래그하여 위치 조정
- 노드 클릭으로 해당 노트로 이동

## 기술 스택

- **Desktop Framework**: Electron 28
- **UI Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **State Management**: Zustand
- **Editor**: CodeMirror 6
- **Markdown Preview**: react-markdown + remark-gfm
- **Database**: better-sqlite3
- **Graph Visualization**: React Flow
- **File Watching**: chokidar

## 개발 가이드

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/yourusername/rememo.git
cd rememo

# 의존성 설치
npm install

# 개발 서버 실행
cd apps/desktop
npm run electron:dev
```

### 프로젝트 구조

```
rememo/
├── apps/
│   └── desktop/              # Electron 데스크톱 앱
│       ├── src/
│       │   ├── main/         # Main Process (Node.js)
│       │   │   ├── database/ # SQLite 스키마 및 쿼리
│       │   │   ├── domain/   # 도메인 모델
│       │   │   ├── ipc/      # IPC 핸들러
│       │   │   ├── parser/   # 마크다운 파서
│       │   │   └── services/ # 비즈니스 로직
│       │   ├── preload/      # Preload Script
│       │   └── renderer/     # Renderer Process (React)
│       │       └── src/
│       │           ├── components/ # React 컴포넌트
│       │           └── stores/     # Zustand 스토어
│       └── package.json
└── packages/
    └── core/                 # 공유 타입 및 유틸리티
```

### 빌드

Windows 배포 패키지 생성:

```bash
cd apps/desktop

# 포터블 버전
npm run build && npx electron-builder --win --x64 --dir
cd release
powershell -Command "Compress-Archive -Path 'win-unpacked\*' -DestinationPath 'rememo-0.1.0-windows-portable.zip' -Force"

# 설치 프로그램
npm run build:win
```

자세한 빌드 가이드는 [BUILD.md](apps/desktop/BUILD.md)를 참조하세요.

## 데이터 저장 구조

rememo는 모든 데이터를 로컬 파일 시스템에 저장합니다:

```
your-vault/
├── .memograph/
│   └── index.db          # SQLite 인덱스 (자동 생성)
├── Notes/                # 기본 노트 저장 위치
│   ├── 노트1.md
│   ├── 노트2.md
│   └── ...
└── vault.json            # Vault 설정 파일
```

### 핵심 철학
- **마크다운 파일이 원본 데이터** (Source of Truth)
- **SQLite는 인덱스 저장소** (검색 및 그래프 성능 향상)
- **로컬 우선 & 오프라인 우선**
- **데이터 소유권 보장** (모든 파일은 일반 텍스트로 저장)

## 로드맵

- [ ] 모바일 동반 앱
- [ ] Google Drive / Dropbox 백업 및 동기화
- [ ] 플러그인 시스템
- [ ] 커스텀 테마 지원
- [ ] AI 기반 노트 연결 제안

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 기여

이슈 제보, 기능 제안, Pull Request 모두 환영합니다!

## 문의

문제가 발생하거나 질문이 있으시면 [Issues](../../issues) 페이지에 등록해주세요.
