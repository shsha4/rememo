# CLAUDE.md — rememo 개발 하네스

모든 기여자(사람+AI)가 동일 품질로 개발하기 위한 최상위 지침. 새 작업 전에 읽고 **§5 파이프라인**을 따른다.

> rememo = Obsidian 벤치마킹 **로컬 우선 마크다운 지식 그래프 데스크톱 앱**. Electron + React + TS, 데이터는 전부 로컬 파일시스템(+ SQLite 인덱스).

---

## 1. 아키텍처 지도

npm workspaces 모노레포, **3 워크스페이스**:

```
packages/core/   ★ 도메인 모델 + 마크다운 파서 (진실의 원천)
  domain/        Note/Vault/Link/Tag/Sync/Category 타입·에러 (+category.ts: buildNoteTree 등 폴더 카테고리 순수 로직)
  parser/        MarkdownParser(WikiLink/Tag/YAML/EntityMention), link-editor.ts(addWikiLink 등 문자열→문자열 직렬화)
  agent-guide.ts AGENT_GUIDE — AGENTS.md 본문 단일 원천
  index.ts       공개 API 배럴(여기서만 export)
packages/cli/    헤드리스 조회 CLI(`rememo`) — LLM 에이전트용. vault.ts(파일 직접 로드)/graph.ts(core 파서 재사용)/init.ts/index.ts
apps/desktop/    Electron 앱
  src/main/      Main 프로세스: services/(파일IO·DB·인덱싱·asset) ipc/ protocol/(rememo-asset://) database/(SQLite)
  src/preload/   contextBridge로 안전 API 노출
  src/shared/ipc/ main·preload·renderer 공유 IPC 타입(type-only, 도메인별 파일+배럴)
  src/renderer/src/ React UI: pages/ components/ stores/(Zustand) utils/(순수) api/(preload 래퍼)
```

### ★ 진실의 원천 = `packages/core` (가장 중요)
- **도메인 타입/에러/파서(읽기+쓰기 직렬화)는 오직 core에.** desktop·cli는 `@memograph/core`(배럴)로만 import. **main/cli에 domain/parser 복붙 금지**(과거 유령 사본이 파서를 갈라 버그 유발).
- cli `graph.ts`: 링크 파싱=core `MarkdownParser`, 링크 해석(`resolveTarget`)만 desktop `indexer.service.resolveLinkPath` 규칙(제목 완전일치→상대경로)을 파일 기반 재현. **이 규칙 바꾸면 양쪽 함께.**
- core는 vite alias + tsconfig `paths`로 **소스에서 직접** 해석(desktop·타입체크·vitest). ⚠️ **renderer의 top-level `resolve.alias`에 `@memograph/core`→소스가 필수** — 없으면 dist(CJS)로 해석돼 rollup이 `__exportStar` named 런타임 export를 못 추적해 빌드 깨짐("not exported by index.js"). **예외: cli 빌드(`tsc`)**는 `tsconfig.build.json`에서 `paths`를 비워 dist로 해석 → core 먼저 빌드(루트 `build`가 core→cli 순서 보장).

### UI 셸 / 디자인
- **셸 레이아웃**: 볼트 오픈 후 `App`은 `app-shell = [좌측 NavRail][app-main]`. `NavRail`(`components/NavRail.tsx`)은 아이콘만 있는 세로 내비(에디터/그래프/검색/할일 + 하단 설정/도움말), hover 시 한글 툴팁(`::after` + `data-label`). 볼트 선택 전에는 레일 없이 `VaultPage`만. **새 최상위 화면을 추가하면 NavRail 아이템·`NavPage` 유니온·App `renderPage`를 함께 갱신**한다.
- **밀도/헤더**: 옵시디언식으로 촘촘하게 — 각 페이지 상단은 얇은 헤더(≈40px, 작은 제목 `0.82rem`/text-secondary). 노트 본문(에디터·프리뷰)은 읽기 편하게 두고 크롬(헤더·사이드바·툴바·레일)만 조인다. 새 화면도 이 톤을 따른다.

### 데이터 흐름 (한 방향)
`renderer → api/electron-api → preload(contextBridge) → ipc.handle → service → 파일/DB`. renderer는 Node API 직접 접근 금지.

- **뮤테이션 = 재인덱싱 + markInternalChange**: 노트 생성/수정/삭제/이름변경 핸들러는 indexer 재인덱싱을 명시 트리거하고, 파일 쓰기 직후 `indexerService.markInternalChange(path)`로 뒤따르는 watcher 이벤트를 억제한다. **새 뮤테이션 핸들러 추가 시 둘 다 필수**(rename처럼 old/new 두 경로면 둘 다). (asset:save-image는 인덱싱 대상 아님 → 예외.)
- **watcher**(`indexer.service.ts`): chokidar가 `.md` 외부 편집을 재인덱싱. **chokidar v4+는 glob 제거** → vault를 통째로 재귀 감시 + `ignored` **함수**로 `.md`만(디렉터리 통과, `.memograph`·`node_modules` 제외). 콜백은 절대경로. ⚠️ `chokidar.watch('**/*.md',{cwd})`로 되돌리지 말 것(v5에서 아무것도 감시 못 함).
- **실시간 UI 갱신(외부 변경→push)**: 외부 변경 재색인 직후 `notifyIndexChanged`→`notifier.ts broadcastIndexChanged`가 `webContents.send('indexer:changed', {type,path,vaultPath})`(단방향, IpcResult 봉투 없음). renderer는 `electronAPI.indexer.onChanged(cb)` 구독, `useIndexAutoRefresh` 훅이 ~120ms 디바운스로 목록(`note.list`→`setNotes`→GraphPage `[notes]` 리로드)+열린 노트 갱신. 열린 노트는 **안전 모드**(외부삭제=비움, 외부수정=미저장 없으면 재읽기·있으면 배너). 판정은 순수 함수 `utils/index-refresh.ts planIndexRefresh`(테스트 대상). 앱 자기 변경은 markInternalChange로 push 안 됨. AGENTS.md는 `isAgentGuidePath`로 push 제외.
- **그래프 관계(WikiLink) 편집**: `link:add`/`link:remove`(link.service.ts + link.handlers.ts)가 source 본문을 core 직렬화로 변형해 저장(note:update와 동일: markInternalChange+재인덱싱). 엣지는 `getGraphData`가 `linkType`(`wiki_link`=삭제 가능 / `entity_mention`=자동 감지·삭제 불가) 동봉. 대상 노트가 미저장(`note.store dirtyNotePath`)이면 경고 후 차단.
- **프리뷰 WikiLink 이동**(`MarkdownPreview`): `[[노트]]`를 클릭 가능한 링크로 렌더. 문법 파싱은 core `MarkdownParser`를 재사용하는 순수 remark 플러그인 `utils/remark-wikilink.ts`(테스트 대상, `text` 노드만 쪼개 코드블록/인라인코드는 제외)가 담당, 링크 URL은 내부 전용 `wikilink:<encoded>` 스킴(`urlTransform`이 이 스킴만 새니타이즈 우회로 보존, 나머지는 `defaultUrlTransform`). 해석은 **읽기전용 IPC `link:resolve`**(link.handlers → `indexerService.resolveLink`)가 인덱싱과 **동일 규칙**(`resolveLinkPath`: 제목 완전일치→상대경로)을 재사용해 `{notePath, exists}` 반환 — 렌더러엔 해석 규칙 복붙 없음. ⚠️ resolveLink 결과가 파일 IO(read/create)로 이어지므로 **vault 경계 밖(`../` 등)이면 throw로 거부**(임의 경로 읽기/쓰기 차단, asset 핸들러와 동일 취지). 클릭 동작은 스테일 캐시를 안 믿고 **항상 즉석 재해석**(맵은 표시 스타일 전용, 노트 전환 시 즉시 비움), 이동 전 미저장 편집이 있으면 확인. `EditorPage`가 프리뷰 표시 중 본문의 유니크 타깃을 150ms 디바운스로 배치 해석해 맵을 프리뷰에 전달, 클릭 시 해결=`note.read`→`setCurrentNote`, **미해결(exists=false)=흐릿+점선 표시**·클릭 시 확인 후 `note:create`(현재 노트와 같은 폴더, 제목=타깃 basename)→열기. `[[노트#헤딩]]`은 노트로 이동만(헤딩 스크롤 없음).
- **네비게이션 가드(하얀 화면 방지)**: rememo는 라우터 없는 단일 페이지 앱이라 링크 클릭으로 창이 다른 주소로 이동하면 React 앱이 통째로 사라져 복구 불가. `main/index.ts`가 `webContents.on('will-navigate')`로 창 이동을 전면 차단(`preventDefault`)하고 `http(s)`만 `shell.openExternal`로 시스템 브라우저에 위임, `setWindowOpenHandler`도 동일(새 창 deny). SPA 정상 내비는 없으므로 안전, dev HMR/리로드는 will-navigate 미발생.
- **카테고리 = 폴더**(별도 DB 컬럼 아님, 파일시스템이 진실). 계층은 `Note.path`에 보존, core `buildNoteTree`(순수)로 트리 → Sidebar가 접기/펼치기 렌더, 노트 드래그=`note:rename`(파일 이동). CRUD `category:list/create/rename/delete`(category.service.ts + handlers, shared/ipc/category.ts): create=빈 폴더 mkdir, delete=**빈 것만**(아니면 `CategoryNotEmptyError`), rename=폴더 이동(하위 노트 old/new 모두 markInternalChange 후 `indexVault` 전체 재빌드). `category:list`가 빈 폴더도 반환. **외부 생성 빈 폴더 반영**: watcher가 `addDir`/`unlinkDir`도 push(reloadList=true→Sidebar `[notes]`→loadFolders). 앱 생성 폴더는 핸들러가 `markInternalChange(dirPath)`로 억제. **그래프**: 같은 카테고리를 배경 박스로 감쌈(`utils/graph-categories.ts` 순수 계산 + `CategoryBoxNode` + force `clusterAnchors`), 노드를 박스로 드래그 시 이동. 박스는 bounding hull이라 타 카테고리 노드와 시각적 겹침 가능(의도적). **노드 색**=카테고리(색상)+깊이(음영), 순수 util `utils/graph-node-color.ts`(테스트 대상)로 계산해 GraphPage가 `data.color`로 주입(크기=degree는 별도). 진입 시 전체 그래프를 화면에 맞춘다: 커스텀 노드 크기 측정 전에 fitView하면 우하단 쏠림이 생기므로, `ReactFlowProvider`로 감싼 `GraphFlow`에서 `useNodesInitialized`(측정 완료)를 기다렸다가 그래프당 1회 `fitView`(`hasFitRef`, 이후엔 뷰포트 유지→사용자가 확대).
- **테마(라이트/다크)**: 색은 전부 `renderer/src/index.css` **CSS 토큰**으로만. 다크=`:root` 기본, 라이트=`:root[data-theme='light']` 덮어쓰기(+블록별 `color-scheme`로 네이티브 위젯·스크롤바 추종). 적용은 `stores/theme.store.ts`가 `<html data-theme>` 지정: 선호(`system`/`light`/`dark`)를 `localStorage('rememo-theme')`에 저장, `system`이면 `matchMedia`로 OS 추종. 순수 함수 `resolveEffectiveTheme`(테스트 대상), `main.tsx initTheme()` + `index.html` 인라인 스크립트가 렌더 전 세팅(플래시 방지, 같은 키). SettingsPage 세그먼트로 선택, CodeMirror도 `effective` 구독. 강조=단색 블루, 그라디언트·글래스·컬러 글로우 금지. **새 UI는 색 하드코딩 말고 토큰 참조**(§2).
- **로컬 이미지**: `webSecurity` 켜져 `file://` 불가 → 커스텀 스킴 `rememo-asset://`(main/protocol/)로 vault 내부 이미지만 서빙. `MarkdownPreview`는 src 변환 전 **react-markdown `defaultUrlTransform` 먼저 적용**(위험 스킴 새니타이즈). 핸들러는 확장자 화이트리스트 + `..` 탈출 차단.

### 에이전트/CLI 읽기 경로 (GUI와 독립)
- **LLM 에이전트는 SQLite 인덱스를 안 읽는다.** vault `.md`가 진실, `[[링크]]`·`#태그`·frontmatter가 관계. `.memograph/index.db`는 GUI 전용 파생 캐시(앱 꺼지면 미갱신) — 신뢰 대상 아님.
- 헤드리스 cli(`rememo context/graph/search`)는 **호출 시점 즉석 파싱**(항상 최신, 데몬 불필요, better-sqlite3 미의존). Electron/preload/DB 안 거침.
- **AGENTS.md 단일 원천 = core `AGENT_GUIDE` 상수**(파일 쓰기는 소비자 담당). ① desktop 볼트 오픈 시 `vaultService.openVault`의 `ensureAgentGuide`가 없으면 생성·**있으면 안 덮음**(실패해도 오픈 진행), ② `rememo init`(`--force`로 덮기). 문구는 이 상수만 고침.
- **볼트 루트 `AGENTS.md`는 노트 아닌 메타 파일** → 목록·그래프·검색·백링크 제외(루트 한정, 하위 동명 노트는 정상). 파일명 정의: desktop=`note.service AGENT_GUIDE_FILE`/`isAgentGuidePath`(listNotes·indexerService.indexNote에서 필터), cli=`init.ts AGENT_GUIDE_FILE`(loadVault 필터).

---

## 2. 코드 컨벤션

포맷은 **Prettier**(작은따옴표, 세미콜론, 2칸, 멀티라인 trailing comma, printWidth 100), 규칙은 **ESLint**가 강제. 수동 스타일 조정 금지.

- **서비스**: `class XxxService {}` 정의 후 파일 하단에서 소문자 싱글턴 export(`export const noteService = new NoteService()`).
- **도메인 에러**: 전용 클래스(`NoteNotFoundError` 등)를 throw.
- **IPC 채널명**: `'도메인:동작'`(`note:create`, `vault:open`).
- **IPC 인자**: 1개 이상이면 **채널당 단일 request object**(positional 금지). 0개 채널(`ping` 등)은 그대로. 타입은 `shared/ipc/`에 `<Domain><Action>Request`로 정의해 세 계층 공유(type-only).
- **IPC 핸들러**: `setupXxxHandlers()`로 묶고 `ipcMain.handle('도메인:동작', ipcHandler(async (_e, req: XxxRequest)=>{...}))`. 부수효과는 try/catch로 감싸 실패해도 주응답 반환.
- **IPC 응답 봉투**: 와이어에서 `IpcResult<T>`(`shared/ipc/result.ts`)로 표준화. main은 `ipcHandler()`(`main/ipc/ipc-result.ts`)로 봉투화, preload가 unwrap(성공=data 반환/실패=`error.code`를 name으로 갖는 Error throw). renderer는 `Promise<T>`+try/catch.
- **main→renderer push(예외)**: 단방향 통지는 `webContents.send('도메인:동작', payload)`로 **IpcResult 봉투 없이**. preload는 `on<Event>(cb)→언구독 함수`로 노출, renderer는 useEffect cleanup에서 언구독. payload 타입도 `shared/ipc/` 공유.
- **타입 전용 import**는 `import type`.
- **Zustand**: `interface XxxState`(상태+액션) + `create<XxxState>((set)=>({...}))`, `useXxxStore` export.
- **파일명**: 서비스 `*.service.ts`, 핸들러 `*.handlers.ts`, 컴포넌트 `PascalCase.tsx`(+동명 `.css`), 스토어 `*.store.ts`.
- 주석/문서/커밋/PR은 **한국어**.

### 하지 말 것
- renderer에서 `fs`/`path`/`better-sqlite3` 직접 import(preload 경계 위반).
- `any` 남용(ESLint 경고 — 새로 늘리지 말 것).
- 도메인 로직을 core 대신 desktop에 신설.
- **색상 하드코딩**: hex/rgba를 컴포넌트 CSS에 직접 쓰지 말고 `index.css` 토큰(`--bg-*`/`--text-*`/`--accent-*`/`--danger-*`/`--warning-*`/`--shadow-*`/`--radius-*`)만 참조. 새 색은 토큰 먼저 정의(다크 `:root` + 라이트 `:root[data-theme='light']` 양쪽).

---

## 3. 검증 명령 (DoD 게이트)

작업 완료 = 아래가 **모두 초록불**(루트에서 실행). 커밋 전 순서대로 확인:
1. `npm run type-check` 통과
2. `npm run lint` **에러 0**(경고는 새로 늘리지 않기)
3. `npm run format:check` 통과(또는 `npm run format`)
4. `npm test` 통과 + **새 로직에 단위 테스트 추가**
5. `npm run build` 성공
6. UI/동작 변경이면 `npm run dev`로 실제 앱 확인
7. 아키텍처/컨벤션 변경 시 **이 CLAUDE.md 최신화**(§5 규칙)
8. 커밋 메시지·PR 본문 작성

기타: `npm run test:watch`(watch).

---

## 4. 테스트 규칙

- 러너 **Vitest**. 테스트는 **대상 소스 옆** `*.test.ts`.
- 기본 환경 node. 렌더러 컴포넌트는 파일 상단 `// @vitest-environment jsdom`으로 개별 전환.
- **순수 로직(core 도메인/파서)부터 테스트.** 예: `packages/core/src/parser/markdown-parser.test.ts`.
- 한글/조사, WikiLink 경계, 엔티티 멘션 등 앱 특유 케이스를 남긴다. 작성은 `test-writer` 스킬 참고.
- **E2E(Playwright)는 범위 밖**(도입 시 이 문서 갱신).

---

## 5. 개발 파이프라인

`/feature` 커맨드가 8단계를 안내(수동도 동일): ①프로젝트 분석(§1) →②컨벤션 확인(§2) →③플랜(`plan` 스킬) →④플랜 리뷰(사용자 합의) →⑤코드(§2 + core 규칙) →⑥테스트(`test-writer`, §4) →⑦코드 리뷰(`code-reviewer` 서브에이전트 병렬 또는 `/code-review`) →⑧커밋·푸시(+PR).

### ★ 브랜치 규칙 (필수)
- **신규 작업은 무조건 새 브랜치 먼저 생성 후 진행. `main` 직접 작업/커밋 금지.** 코드 손대기 전 `git switch -c <타입>/<요약>`(예: `feat/...`, `fix/...`, `docs/...`). main 상태에서 요청받으면 브랜치부터 만든다. 예외: 사용자가 "main에서 해라" 명시.

### 커밋/PR
- 커밋/푸시/PR은 **사용자가 요청할 때만**. PR 생성 여부는 항상 사용자 확인.

### ★ 커밋 전 CLAUDE.md 최신화 (필수)
아래가 바뀌면 **같은 커밋에** 이 문서도 수정: §1 아키텍처(구조·데이터 흐름·진실의 원천) / §2 컨벤션(패턴·네이밍·파일 규칙) / §3 DoD·스크립트 / §4 테스트 규칙 / §5~§7 파이프라인·제약·하네스. "코드만 바꾸고 문서는 나중에" 금지.

---

## 6. 알려진 제약 / 함정

- **better-sqlite3 = 네이티브 모듈**(Electron ABI 일치 필요, `asarUnpack`). 로컬 빌드에 툴체인 필요: Windows=VS Build Tools "Desktop development with C++"(MSVC+SDK), macOS=Xcode CLT. "Could not locate the bindings file"/ABI 불일치 시 → `npx electron-rebuild -f -w better-sqlite3`(또는 apps/desktop에서 `npx electron-builder install-app-deps`). ⚠️ **vitest는 시스템 Node ABI를 쓰므로** Electron용으로 빌드된 모듈을 로드하는 테스트(`schema.test.ts` 등)는 로컬에서 ABI 불일치로 실패할 수 있음(앱 자체는 정상). CI는 러너에 툴체인이 있어 자동 재빌드(§7).
- 자동 저장 없음(수동 `Ctrl+S`), 동시 편집 충돌 해결 없음.
- 루트 `test-regex.js`, `apps/desktop/check-db.js`는 **애드혹 디버그 스크립트**(lint/prettier 제외, 제품 코드가 의존 금지).
- core의 `unified`/`remark`는 **미사용**(커스텀 정규식 파서만). unified 재작성 시에만 사용.
- **앱 아이콘**: 원본 `apps/desktop/build/icon.svg`, `scripts/generate-icon.js`(sharp)가 PNG + 멀티사이즈 `icon.ico` 생성(빌드가 자동 실행 안 함 → 커밋된 자산, `build/`가 gitignore라 `git add -f`). 아이콘 변경 시 스크립트 재실행 후 산출물 함께 커밋. Windows 시작표시줄은 멀티사이즈 `.ico` 선호(`build.win.icon`·`BrowserWindow.icon`=`.ico`), macOS Dock은 `BrowserWindow.icon` 무시 → `app.dock.setIcon`(main/index.ts). `build/icon.png`·`icon.ico`는 electron-builder `files`·`asarUnpack`에 포함.

---

## 7. 하네스 구성 요소

- `.claude/skills/plan/` — 플랜 작성(파이프라인 3–4)
- `.claude/skills/test-writer/` — 테스트 작성(6)
- `.claude/commands/feature.md` — 8단계 오케스트레이션
- `.claude/agents/code-reviewer.md` — 코드 리뷰 서브에이전트(7, 병렬)
- `.github/workflows/release.yml` — `v*` 태그 push 시 win/macOS 빌드→`.exe`/`.dmg` Release 첨부(로컬 툴체인 불필요)
- 빌트인: `/code-review`, `/security-review`, `verify`, `run`
