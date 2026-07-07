# CLAUDE.md — rememo 개발 하네스

이 문서는 **모든 기여자(사람 + AI)가 동일한 품질로 개발**하기 위한 최상위 지침이다.
새 작업을 시작하기 전에 이 문서를 먼저 읽고, 아래 **개발 파이프라인**을 따른다.

> rememo는 Obsidian을 벤치마킹한 **로컬 우선 마크다운 지식 그래프 데스크톱 앱**이다.
> Electron + React + TypeScript, 데이터는 전부 로컬 파일시스템(+ SQLite 인덱스)에 저장된다.

---

## 1. 아키텍처 지도

npm workspaces 모노레포. **세 개의 워크스페이스가 존재한다.**

```
rememo/
├── packages/core/          # ★ 도메인 모델 + 마크다운 파서 (진실의 원천)
│   └── src/
│       ├── domain/         # Note, Vault, Link, Tag, Sync 타입·에러클래스
│       ├── parser/         # MarkdownParser (WikiLink/Tag/YAML/EntityMention)
│       ├── agent-guide.ts  # AGENT_GUIDE — 에이전트 지침(AGENTS.md) 본문 단일 원천 (desktop·cli 공유)
│       └── index.ts        # 공개 API 배럴(barrel). 여기서만 export한다.
├── packages/cli/           # 헤드리스 조회 CLI (`rememo`) — LLM 에이전트용
│   └── src/
│       ├── vault.ts        # vault의 .md를 재귀 로드 (SQLite 미사용, 파일 직접 읽기)
│       ├── graph.ts        # core 파서 재사용해 그래프/백링크/이웃/맥락 계산 (순수 함수)
│       ├── init.ts         # `rememo init`: 지침(core AGENT_GUIDE)을 vault 루트에 AGENTS.md로 써넣음
│       └── index.ts        # CLI 진입점 (init/context/graph/search 명령)
└── apps/desktop/           # Electron 앱
    └── src/
        ├── main/           # Main 프로세스 (Node 권한)
        │   ├── services/   # 비즈니스 로직 (파일 IO, DB, 인덱싱, 이미지 asset)
        │   ├── ipc/        # IPC 핸들러 (renderer ↔ main 경계)
        │   ├── protocol/   # 커스텀 스킴 핸들러 (예: rememo-asset:// 로컬 이미지 서빙)
        │   └── database/   # SQLite 스키마
        ├── preload/        # contextBridge로 안전한 API 노출
        ├── shared/ipc/     # main·preload·renderer가 공유하는 IPC request 타입 (type-only, 도메인별 파일 + 배럴)
        └── renderer/src/   # React UI
            ├── pages/      # 화면 단위 (Editor/Graph/Search/Vault)
            ├── components/ # 재사용 컴포넌트
            ├── stores/     # Zustand 상태
            ├── utils/      # 순수 유틸 (Node API 없이 문자열/URL 변환 등)
            └── api/        # preload 브리지 호출 래퍼
```

### ★ 진실의 원천 규칙 (가장 중요)
- **도메인 타입/에러/파서는 오직 `packages/core`에만 정의한다.**
- 마크다운을 **읽는 것**뿐 아니라 **쓰는(직렬화) 로직도 core에 둔다.** 예) `parser/link-editor.ts`의 `addWikiLink`/`removeWikiLink`/`hasWikiLink`는 문자열→문자열 순수 함수로, 그래프에서 관계를 추가/삭제할 때 노트 본문을 변형한다(파일 IO는 main의 service가 담당).
- desktop·cli 모두 반드시 `import ... from '@memograph/core'`로 가져온다. (`packages/core/src/index.ts`가 배럴)
- **`apps/desktop/src/main`이나 `packages/cli` 안에 domain/parser를 복붙하지 말 것.** (과거에 유령 사본이 있었고 파서가 갈라져 버그를 낳았다 — 제거 완료.) cli의 `graph.ts`는 링크 파싱을 core `MarkdownParser`로 하고, 링크 해석(`resolveTarget`)만 desktop `indexer.service.resolveLinkPath`의 규칙(제목 완전일치 → 상대경로)을 파일 기반으로 재현한다. 이 해석 규칙을 바꾸면 양쪽을 함께 맞춘다.
- core는 vite alias(`vite.config.ts`)와 tsconfig `paths`로 **소스에서 직접** 해석된다(desktop·타입체크·vitest). **단 cli 빌드(`tsc`)는 예외** — `tsconfig.build.json`에서 `paths`를 비워 core를 node_modules의 빌드 산출물(dist)로 해석하므로 core를 먼저 빌드해야 한다(루트 `build` 스크립트가 core→cli 순서 보장). cli 타입체크(`tsconfig.json`)는 다른 워크스페이스처럼 소스에서 해석한다.

### 데이터 흐름 (한 방향)
```
renderer (React) → api/electron-api → preload(contextBridge) → ipc.handle → service → 파일/DB
```
- renderer는 Node API에 직접 접근하지 않는다. 반드시 preload가 노출한 `window.electronAPI`를 통한다.
- 노트 변경(생성/수정/삭제/이름변경) 시 핸들러가 **indexer 재인덱싱**을 명시적으로 트리거한다. 새 뮤테이션을 추가하면 인덱스 갱신도 함께 처리한다. (이미지 asset은 링크/엔티티 인덱싱 대상이 아니므로 `asset:save-image`는 재인덱싱을 트리거하지 않는다.)
- **그래프에서 노드 간 관계(WikiLink) 편집**: `link:add`/`link:remove`(main/services/link.service.ts + ipc/link.handlers.ts)가 source 노트 본문을 core의 링크 직렬화 함수로 변형해 파일에 쓴다. 이 역시 노트 뮤테이션이므로 `markInternalChange` + 재인덱싱을 트리거한다(note:update와 동일 패턴). 그래프 엣지는 `getGraphData`가 `linkType`(`wiki_link`=명시적·삭제 가능 / `entity_mention`=자동 감지·그래프에서 삭제 불가)을 함께 내려 renderer가 편집 가능 여부를 구분한다. 대상 노트가 에디터에서 미저장(`note.store`의 `dirtyNotePath`) 상태면 편집 유실 방지를 위해 경고 후 막는다.
- **watcher 이중 재인덱싱 방지**: chokidar watcher(`indexer.service.ts`)도 `**/*.md` 변경 시 재인덱싱한다. 앱이 직접 쓴 파일은 핸들러가 이미 재인덱싱하므로, 파일 쓰기 직후 `indexerService.markInternalChange(path)`를 호출해 뒤이어 오는 watcher 이벤트(add/change/unlink)를 무시하게 한다(외부 에디터 편집만 watcher가 처리). **새 노트 뮤테이션 핸들러를 추가하면 이 `markInternalChange` 호출도 반드시 함께 넣는다**(rename처럼 old/new 두 경로가 바뀌면 둘 다 표시).
- **로컬 이미지 렌더링**: `webSecurity`가 켜져 있어 프리뷰에서 `file://`로 로컬 이미지를 못 읽는다. 그래서 커스텀 스킴 `rememo-asset://`(main/protocol/)을 등록해 vault 내부 이미지 파일만 서빙한다. 프리뷰(`MarkdownPreview`)는 이미지 src를 이 URL로 변환하되, **반드시 react-markdown의 `defaultUrlTransform`을 먼저 적용**해 `javascript:` 등 위험 스킴을 새니타이즈한다. 프로토콜 핸들러는 이미지 확장자 화이트리스트 + `..` 경로탈출 차단을 적용한다.

### 에이전트/CLI 읽기 경로 (GUI와 별개)
- **LLM 에이전트(Claude Code/Codex)는 SQLite 인덱스를 읽지 않는다.** vault의 `.md` 파일이 진실의 원천이고, `[[위키링크]]`·`#태그`·frontmatter가 곧 관계다. `<vault>/.memograph/index.db`는 **GUI 전용 파생 캐시**이며 앱이 꺼져 있으면 갱신되지 않는다 — 에이전트 관점에선 신뢰 대상이 아니다.
- 따라서 헤드리스 `packages/cli`(`rememo` 명령)는 **호출 시점에 파일을 즉석 파싱**한다(항상 최신, 데몬·앱·색인 단계 불필요). `rememo context/graph/search`로 관계를 JSON/텍스트로 조회한다.
- **에이전트 지침(AGENTS.md) 단일 원천 = `packages/core`의 `AGENT_GUIDE` 상수**(core는 순수하므로 파일 쓰기는 각 소비자가 담당). 두 경로로 vault 루트에 뿌려진다: ① **desktop이 볼트 오픈 시 자동 생성** — `vaultService.openVault`가 `ensureAgentGuide`로 없으면 쓰고 **있으면 절대 덮어쓰지 않는다**(사용자 편집 보존, 실패해도 오픈은 진행). ② `rememo init`(cli)이 수동 생성(`--force`로 덮어쓰기). 지침 문구를 바꾸면 이 상수만 고친다.
- **볼트 루트의 `AGENTS.md`는 사용자 노트가 아닌 프로젝트 메타 파일**이므로 GUI·CLI 모두에서 노트 취급하지 않는다(목록·그래프·검색·백링크에서 제외). 루트 한정이라 하위 폴더의 동명 노트는 정상 노출된다. 파일명은 각 소비 패키지가 단일 정의: **desktop** = `note.service`의 `AGENT_GUIDE_FILE`/`isAgentGuidePath`(→ `listNotes`와 `indexerService.indexNote`[watcher 외부편집 관문] 두 곳에서 필터, vault.service 자동 생성도 재사용), **cli** = `init.ts`의 `AGENT_GUIDE_FILE`(→ `loadVault`가 즉석 로딩 시 필터).
- 이 경로는 데스크톱 데이터 흐름(renderer→ipc→service→DB)과 **완전히 독립**이다. cli는 Electron/preload/DB를 거치지 않고 파일시스템만 읽는다(better-sqlite3 미의존 → Node ABI 재빌드 함정 없음).

---

## 2. 코드 컨벤션

포맷은 **Prettier가 강제**하고(수동으로 스타일 맞추지 말 것), 규칙은 **ESLint**가 잡는다. 아래는 코드가 실제로 따르는 패턴이다.

### 포맷 (`.prettierrc.json`)
작은따옴표, 세미콜론 필수, 2칸 들여쓰기, 멀티라인 trailing comma, printWidth 100.

### 네이밍 / 구조 패턴
- **서비스**: `class XxxService {}`를 정의하고 **파일 하단에서 소문자 싱글턴을 export**한다.
  ```ts
  export class NoteService { /* ... */ }
  export const noteService = new NoteService();
  ```
- **도메인 에러**: 전용 에러 클래스를 만든다. 예) `NoteNotFoundError`, `NoteAlreadyExistsError`. 서비스는 실패 시 이 에러를 throw한다.
- **IPC 채널명**: `'도메인:동작'` 케밥/콜론 규칙. 예) `note:create`, `vault:open`, `note:rename`.
- **IPC 인자**: 인자가 1개 이상인 채널은 **채널당 단일 request object**(`{ ... }`) 하나만 받는다(positional 인자 금지 — 같은 타입 인자 순서 뒤섞임 방지). 인자 0개 채널(`ping`, `system:get-platform`, `vault:select-folder`, `sync:*`의 인자 없는 것들)은 그대로 둔다. request 타입은 `apps/desktop/src/shared/ipc/`에 도메인별로 `<Domain><Action>Request`로 정의하고 **main·preload·renderer 세 계층이 동일 타입을 공유**한다(이 디렉터리는 type-only, `@memograph/core`의 도메인 타입만 type-only import).
- **IPC 핸들러**: `setupXxxHandlers()` 함수로 묶고 `ipcMain.handle('도메인:동작', ipcHandler(async (_event, req: XxxRequest) => {...}))`로 등록, 본문에서 `req.*`를 구조분해해 서비스를 호출한다. 부수효과(재인덱싱 등)는 `try/catch`로 감싸고 실패해도 주요 응답은 반환한다.
- **IPC 응답 봉투**: 모든 IPC 응답은 와이어에서 `IpcResult<T>`(`shared/ipc/result.ts`) 봉투로 표준화한다. main 핸들러는 `ipcHandler()`(`main/ipc/ipc-result.ts`)로 감싸 성공/실패를 봉투화하고, preload가 unwrap해 성공 시 `data`를 반환·실패 시 `error.code`를 name으로 갖는 Error를 throw한다(renderer는 기존처럼 `Promise<T>`를 받고 try/catch로 처리).
- **타입 전용 import**는 `import type { ... }`을 쓴다.
- **Zustand 스토어**: `interface XxxState`에 상태+액션을 함께 선언하고 `create<XxxState>((set) => ({...}))` 패턴, `useXxxStore`로 export.
- **파일명**: 서비스 `*.service.ts`, IPC 핸들러 `*.handlers.ts`, 컴포넌트 `PascalCase.tsx`(+동명 `.css`), 스토어 `*.store.ts`.
- 주석/문서/커밋/PR 본문은 **한국어**로 작성한다(기존 코드베이스 관례).

### 하지 말 것
- renderer에서 `fs`/`path`/`better-sqlite3` 직접 import 금지 (preload 경계 위반).
- `any` 남용 금지 (ESLint가 경고한다 — 점진적으로 제거).
- 도메인 로직을 core 대신 desktop에 새로 만들지 말 것.

---

## 3. 검증 명령 (Definition of Done 게이트)

작업 완료 = 아래가 **모두 초록불**이어야 한다. 루트에서 실행한다.

| 목적 | 명령 |
|---|---|
| 타입 검사 (양 워크스페이스) | `npm run type-check` |
| 린트 (0 errors 필수) | `npm run lint` |
| 포맷 검사 | `npm run format:check` |
| 포맷 자동 적용 | `npm run format` |
| 단위 테스트 | `npm test` |
| 테스트 watch | `npm run test:watch` |
| 프로덕션 빌드 | `npm run build` |
| 앱 실행(수동 확인) | `npm run dev` |

### Definition of Done 체크리스트
1. [ ] `npm run type-check` 통과
2. [ ] `npm run lint` **에러 0** (경고는 새로 늘리지 않기)
3. [ ] `npm run format:check` 통과 (또는 `npm run format` 적용)
4. [ ] `npm test` 통과 + **새 로직에 대한 단위 테스트 추가**
5. [ ] `npm run build` 성공
6. [ ] UI/동작 변경이면 `npm run dev`로 **실제 앱에서 동작 확인**
7. [ ] **아키텍처/컨벤션이 바뀌었으면 이 `CLAUDE.md`를 최신화** (아래 규칙 참고)
8. [ ] 커밋 메시지·PR 본문 작성 (아래 파이프라인 8단계)

---

## 4. 테스트 규칙

- 러너는 **Vitest** (`vitest.config.ts`). 테스트 파일은 **대상 소스 옆에** `*.test.ts`로 둔다.
- 기본 환경은 **node**. 렌더러 컴포넌트 테스트는 파일 상단에 `// @vitest-environment jsdom` 주석으로 개별 전환한다.
- **순수 로직(core의 도메인/파서)부터 반드시 테스트한다.** 기준 예시: `packages/core/src/parser/markdown-parser.test.ts`.
- 한글/조사, WikiLink 경계, 엔티티 멘션처럼 이 앱 특유의 케이스를 꼭 남긴다.
- 테스트 작성은 `test-writer` 스킬을 참고한다.
- **E2E(Playwright)는 현재 범위 밖**이다(Electron 셋업 무거움). 도입 시 이 문서를 갱신한다.

---

## 5. 개발 파이프라인 (모든 작업의 표준 절차)

`/feature` 슬래시 커맨드가 아래 8단계를 순서대로 안내한다. 수동으로 진행할 때도 이 순서를 따른다.

| # | 단계 | 방법 / 도구 |
|---|---|---|
| 1 | **프로젝트 분석** | 관련 파일·아키텍처 파악 (이 문서 §1) |
| 2 | **컨벤션 확인** | 이 문서 §2 + 유사 기존 코드 참조 |
| 3 | **요구사항 분석 & 플랜** | `plan` 스킬 → 계획 수립 |
| 4 | **플랜 리뷰** | 플랜을 사용자와 합의(과설계/누락 점검) 후 착수 |
| 5 | **코드 작성** | §2 컨벤션 준수, core 진실의 원천 규칙 준수 |
| 6 | **테스트 작성** | `test-writer` 스킬 → 단위 테스트 (§4) |
| 7 | **코드 리뷰** | `code-reviewer` 서브에이전트(병렬) 또는 `/code-review` |
| 8 | **커밋 & 푸시 (+ PR)** | 아래 규칙. PR 생성은 **사용자에게 질의 후** 결정 |

### ★ 브랜치 규칙 (필수 — 예외 없음)
- **신규 작업은 무조건 새 브랜치를 먼저 생성하고 거기서 진행한다. `main`에서 직접 작업/커밋 금지.**
- 작업 시작 시 코드에 손대기 전에 브랜치부터 만든다: `git switch -c <타입>/<요약>` (예: `feat/ci-release`, `fix/sqlite-bindings`, `docs/claude-md`).
- 이미 `main`에 있는 상태에서 작업 요청을 받으면, **가장 먼저 브랜치를 생성**한 뒤 나머지를 진행한다.
- 예외: 사용자가 명시적으로 "main에서 해라"라고 지시한 경우에만.

### 커밋/PR 규칙
- 기본 브랜치는 `main`. 작업은 **항상** 새 브랜치에서 한다(위 브랜치 규칙 참고).
- 커밋/푸시/PR은 **사용자가 요청할 때만** 수행한다.
- PR 생성 여부는 항상 사용자에게 확인한다(선택 사항).

### ★ 커밋/푸시 전 CLAUDE.md 최신화 (필수)
**아키텍처는 계속 바뀐다. 커밋/푸시 전에 이 문서가 현재 코드와 일치하는지 반드시 확인하고 갱신한다.**
아래 중 하나라도 해당하면 이 `CLAUDE.md`를 **같은 커밋에** 함께 수정한다:
- §1 아키텍처 지도가 바뀜 (워크스페이스/디렉터리 구조, 데이터 흐름, 진실의 원천 규칙 변경)
- §2 컨벤션이 바뀜 (새 패턴 도입·기존 패턴 폐기, 네이밍/파일 규칙 변경)
- §3 검증 명령·DoD 게이트가 바뀜 (스크립트 추가/삭제, 테스트 러너 변경)
- §4 테스트 규칙이 바뀜 (E2E 도입 등)
- §5 파이프라인·§6 제약·§7 하네스 구성이 바뀜 (스킬/커맨드/에이전트 추가·삭제)

문서와 코드가 어긋나면 팀원·AI가 잘못된 전제로 개발하게 된다. **"코드만 바꾸고 문서는 나중에"는 금지.**

---

## 6. 알려진 제약 / 함정

- **better-sqlite3는 네이티브 모듈**이다. Electron 버전과 ABI가 맞아야 하며 `asarUnpack` 처리됨. 설치 문제 시 `@electron/rebuild` 사용.
  - **로컬 개발/빌드에는 네이티브 컴파일 툴체인이 필요하다.** Windows = Visual Studio Build Tools의 **"Desktop development with C++"** 워크로드(MSVC + Windows SDK), macOS = Xcode Command Line Tools(`xcode-select --install`).
  - `npm install` 후 `node-v148`(Electron ABI) 바인딩이 없어 `dev`/`build`가 "Could not locate the bindings file"로 죽으면 → `npx electron-rebuild -f -w better-sqlite3`(또는 `apps/desktop`에서 `npx electron-builder install-app-deps`)로 Electron용 재빌드.
  - **CI(GitHub Actions)에서 빌드하면 로컬 툴체인이 필요 없다** — 러너에 MSVC/Xcode가 이미 있어 재빌드가 자동으로 된다(§7 `release.yml`).
- 자동 저장 없음(수동 `Ctrl+S`). 동시 편집 충돌 해결 없음.
- 루트의 `test-regex.js`, `apps/desktop/src`가 아닌 `apps/desktop/check-db.js`는 **애드혹 디버그 스크립트**다. 테스트/제품 코드가 아니며 lint/prettier 대상에서 제외되어 있다. 새 코드가 이들에 의존하지 않게 한다.
- `packages/core`는 `unified`/`remark` 의존성을 갖고 있으나 현재 커스텀 정규식 파서만 사용한다(해당 의존성은 미사용). 파서를 unified 기반으로 재작성할 때만 사용한다.

---

## 7. 하네스 구성 요소 위치

- 이 문서: 최상위 지침 (항상 읽힘)
- `.claude/skills/plan/` — 요구사항 분석 & 플랜 작성 스킬 (파이프라인 3–4)
- `.claude/skills/test-writer/` — 테스트 작성 스킬 (파이프라인 6)
- `.claude/commands/feature.md` — 8단계 파이프라인 오케스트레이션 커맨드
- `.claude/agents/code-reviewer.md` — 코드 리뷰 서브에이전트 (파이프라인 7, 병렬)
- `.github/workflows/release.yml` — 크로스 플랫폼 배포 CI. `v*` 태그 push 시 windows/macOS 러너에서 빌드해 `.exe`/`.dmg`를 GitHub Release에 첨부(수동 실행 시 Artifacts). 로컬 툴체인 없이 배포 가능.
- 빌트인 활용: `/code-review`, `/security-review`, `verify`, `run`
