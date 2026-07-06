---
name: test-writer
description: rememo에서 Vitest 단위 테스트를 작성한다(파이프라인 6단계). 코드/기능/버그수정을 구현한 뒤, "테스트 작성", "테스트 짜줘", "test 추가", "커버리지", "이거 테스트해줘" 요청이나 새 로직 구현 직후 사용. 이 프로젝트의 테스트 컨벤션·환경·기준 예시를 담는다.
---

# test-writer — Vitest 단위 테스트 작성 (파이프라인 6단계)

## 러너 / 환경
- **Vitest** (`vitest.config.ts`). 실행: 루트에서 `npm test`(1회) / `npm run test:watch`.
- 테스트 파일은 **대상 소스 옆에** `이름.test.ts`로 둔다. 예) `markdown-parser.ts` → `markdown-parser.test.ts`.
- `describe/it/expect`는 globals로 쓸 수 있으나 **명시적 import를 권장**한다:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  ```
- 기본 환경은 **node**. 렌더러(React) 컴포넌트 테스트는 파일 최상단에 주석으로 전환:
  ```ts
  // @vitest-environment jsdom
  ```

## 무엇을 테스트하나 (우선순위)
1. **`packages/core`의 순수 로직** — 파서, 도메인 규칙, 에러 throw. (가장 쉽고 가치 높음)
2. **main의 service 로직** — 파일 IO는 임시 디렉터리/모킹으로 격리. 도메인 에러가 제대로 나는지 확인.
3. renderer store(Zustand)의 상태 전이. (컴포넌트 렌더 테스트는 jsdom 환경으로.)

## 이 앱 특유의 필수 케이스
- **WikiLink**: `[[Note]]`, `[[Note|alias]]`, `[[Note#heading]]`, `[[Note#heading|alias]]`, 여러 개/position.
- **Tag**: 단순 `#tag`, 계층 `#a/b`, **한글 `#태그`**.
- **EntityMention**: 한글 **조사**(은/는/이/가/을/를/의) 경계, 이미 `[[...]]` 안에 있는 텍스트 제외, 현재 노트 자기참조 제외, 2글자 미만 무시.
- **YAML Front Matter**: `key: value`, `[a, b]` 배열, 없을 때 `undefined`.

## 작성 패턴 (기준 예시)
`packages/core/src/parser/markdown-parser.test.ts`를 **그대로 본보기**로 삼는다.
- `describe`로 메서드/기능 단위 그룹핑, `beforeEach`에서 인스턴스 생성.
- 각 `it`은 한 가지 동작만 검증하고, **테스트 이름은 한국어로 "무엇을 한다"** 형태.
- position/line 같은 정확 수치는 꼭 필요할 때만 단언(취약성 최소화).

## 좋은 테스트 원칙
- 한 테스트 = 하나의 행동. 실패 시 원인이 바로 보이게.
- 해피패스 + **엣지케이스 + 실패(에러 throw) 경로**를 함께.
- 구현 세부가 아니라 **관찰 가능한 동작(입력→출력)**을 검증한다.
- 외부(파일시스템/DB/IPC)는 격리한다.

## 완료 확인
- `npm test` 초록불.
- 새로 추가/변경한 로직에 **대응하는 테스트가 존재**하는지 확인(§DoD 4번).
- 이후 파이프라인 7단계(코드 리뷰)로 넘어간다.
