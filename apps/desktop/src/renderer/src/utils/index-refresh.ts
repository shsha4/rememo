import type { IndexChangedPayload } from '../../../shared/ipc';

// 열린 노트에 대해 취할 동작.
// - 'reread'       : 파일을 다시 읽어 에디터에 즉시 반영(미저장 편집이 없을 때).
// - 'clear'        : 열린 노트가 외부에서 삭제됨 → 에디터를 비운다.
// - 'flag-external': 미저장 편집이 있어 덮어쓰지 않고 "외부 변경됨" 배너만 띄운다(안전 모드).
// - 'keep'         : 열린 노트와 무관 → 그대로 둔다.
export type OpenNoteAction = 'reread' | 'clear' | 'flag-external' | 'keep';

export interface RefreshPlan {
  // 노트 목록(및 그에 반응하는 그래프)을 다시 로드할지.
  reloadList: boolean;
  // 현재 에디터에 열린 노트에 대한 동작.
  openNote: OpenNoteAction;
}

export interface RefreshContext {
  // 현재 열린 vault의 루트 경로(없으면 null).
  currentVaultPath: string | null;
  // 현재 에디터에 열린 노트 경로(없으면 null).
  currentNotePath: string | null;
  // 열린 노트에 미저장 편집이 있는지.
  isDirty: boolean;
}

// Windows 대소문자/경로구분자 차이를 흡수해 동일 경로를 같은 값으로 비교한다.
// (main의 fullPath는 native 구분자, renderer의 저장 경로와 표기가 다를 수 있다.)
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

// 외부 파일 변경 push 하나에 대해 renderer가 취할 갱신 계획을 정한다(순수 함수).
export function planIndexRefresh(event: IndexChangedPayload, ctx: RefreshContext): RefreshPlan {
  // 다른 vault의 변경은 무시한다(현재 열린 vault가 없어도 무시).
  if (
    !ctx.currentVaultPath ||
    normalizePath(event.vaultPath) !== normalizePath(ctx.currentVaultPath)
  ) {
    return { reloadList: false, openNote: 'keep' };
  }

  const affectsOpenNote =
    ctx.currentNotePath !== null &&
    normalizePath(event.path) === normalizePath(ctx.currentNotePath);

  let openNote: OpenNoteAction = 'keep';
  if (affectsOpenNote) {
    if (event.type === 'unlink') {
      openNote = 'clear';
    } else if (event.type === 'change') {
      openNote = ctx.isDirty ? 'flag-external' : 'reread';
    }
    // 'add'가 열린 노트 경로로 오는 경우는 실질적으로 없고, 온다 해도 목록 갱신만으로 충분하다.
  }

  // 같은 vault의 어떤 변경이든 목록·그래프는 최신화한다(추가/삭제는 물론, 수정도
  // 엔티티 멘션·태그 변화로 그래프에 영향을 줄 수 있다).
  return { reloadList: true, openNote };
}
