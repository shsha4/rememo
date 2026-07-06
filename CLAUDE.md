# CLAUDE.md — rememo 개발 하네스

이 문서는 **모든 기여자(사람 + AI)가 동일한 품질로 개발**하기 위한 최상위 지침이다.
새 작업을 시작하기 전에 이 문서를 먼저 읽고, 아래 **개발 파이프라인**을 따른다.

> rememo는 Obsidian을 벤치마킹한 **로컬 우선 마크다운 지식 그래프 데스크톱 앱**이다.
> Electron + React + TypeScript, 데이터는 전부 로컬 파일시스템(+ SQLite 인덱스)에 저장된다.

---

## 1. 아키텍처 지도

npm workspaces 모노레포. **두 개의 워크스페이스만 존재한다.**

```
rememo/
├── packages/core/          # ★ 도메인 모델 + 마크다운 파서 (진실의 원천)
│   └── src/
│       ├── domain/         # Note, Vault, Link, Tag, Sync 타입·에러클래스
│       ├── parser/         # MarkdownParser (WikiLink/Tag/YAML/EntityMention)
│       └── index.ts        # 공개 API 배럴(barrel). 여기서만 export한다.
└── apps/desktop/           # Electron 앱
    └── src/
        ├── main/           # Main 프로세스 (Node 권한)
        │   ├── services/   # 비즈니스 로직 (파일 IO, DB, 인덱싱)
        │   ├── ipc/        # IPC 핸들러 (renderer ↔ main 경계)
        │   └── database/   # SQLite 스키마
        ├── preload/        # contextBridge로 안전한 API 노출
        └── renderer/src/   # React UI
            ├── pages/      # 화면 단위 (Editor/Graph/Search/Vault)
            ├── components/ # 재사용 컴포넌트
            ├── stores/     # Zustand 상태
            └── api/        # preload 브리지 호출 래퍼
```

### ★ 진실의 원천 규칙 (가장 중요)
- **도메인 타입/에러/파서는 오직 `packages/core`에만 정의한다.**
- desktop에서는 반드시 `import ... from '@memograph/core'`로 가져온다. (`packages/core/src/index.ts`가 배럴)
- **`apps/desktop/src/main` 안에 domain/parser를 복붙하지 말 것.** (과거에 유령 사본이 있었고 파서가 갈라져 버그를 낳았다 — 제거 완료.)
- core는 vite alias(`vite.config.ts`)와 tsconfig `paths`로 **소스에서 직접** 해석된다. 별도 빌드 선행 불필요.

### 데이터 흐름 (한 방향)
```
renderer (React) → api/electron-api → preload(contextBridge) → ipc.handle → service → 파일/DB
```
- renderer는 Node API에 직접 접근하지 않는다. 반드시 preload가 노출한 `window.electronAPI`를 통한다.
- 노트 변경(생성/수정/삭제/이름변경) 시 핸들러가 **indexer 재인덱싱**을 명시적으로 트리거한다. 새 뮤테이션을 추가하면 인덱스 갱신도 함께 처리한다.

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
- **IPC 핸들러**: `setupXxxHandlers()` 함수로 묶고 `ipcMain.handle`로 등록. 부수효과(재인덱싱 등)는 `try/catch`로 감싸고 실패해도 주요 응답은 반환한다.
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

### 커밋/PR 규칙
- 기본 브랜치는 `main`. 작업은 새 브랜치에서 한다.
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
- 빌트인 활용: `/code-review`, `/security-review`, `verify`, `run`
