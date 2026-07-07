import { useEffect } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import { planIndexRefresh, type OpenNoteAction } from '../utils/index-refresh';

// 연속 파일 쓰기(에이전트의 대량 편집 등)로 push가 몰릴 때, 매 이벤트마다 IPC 재로드를
// 쏘지 않고 잠잠해진 뒤 한 번에 처리하기 위한 디바운스 간격(ms).
const DEBOUNCE_MS = 120;

// openNote 동작 우선순위(디바운스 창에서 여러 이벤트가 겹칠 때 높은 쪽을 남긴다).
// 삭제 > (미저장으로) 보류 > 재읽기 > 유지.
const OPEN_NOTE_RANK: Record<OpenNoteAction, number> = {
  clear: 3,
  'flag-external': 2,
  reread: 1,
  keep: 0,
};

// 현재 열린 노트의 미저장 여부를 스토어에서 즉석 계산한다.
function currentIsDirty(): boolean {
  const { currentNote, dirtyNotePath } = useNoteStore.getState();
  return dirtyNotePath !== null && dirtyNotePath === (currentNote?.path ?? null);
}

// 외부(Claude Code 등)의 vault 파일 변경 push를 구독해 UI를 실시간 갱신한다.
// App 최상위에서 한 번 호출한다(페이지 전환과 무관하게 상시 구독).
// 스토어 값은 셀렉터로 구독하지 않고 이벤트 시점에 getState()로 읽는다
// → 타이핑/노트전환 때 App이 재렌더되지 않는다.
export function useIndexAutoRefresh(): void {
  useEffect(() => {
    // 디바운스 창에 누적되는 처리 계획.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let needsReload = false;
    let pendingAction: OpenNoteAction = 'keep';
    let pendingActionPath: string | null = null;

    const flush = async () => {
      timer = null;
      const reload = needsReload;
      const action = pendingAction;
      const actionPath = pendingActionPath;
      needsReload = false;
      pendingAction = 'keep';
      pendingActionPath = null;

      const { currentVault } = useVaultStore.getState();
      const vaultPath = currentVault?.path ?? null;
      const vaultId = currentVault?.id ?? '';
      const { setNotes, setCurrentNote, setExternalChangePath } = useNoteStore.getState();

      // 목록 재로드 → setNotes의 새 배열 참조가 GraphPage([notes] 의존)의 그래프 리로드도 유발한다.
      if (reload && vaultPath) {
        try {
          const noteList = await electronAPI.note.list({ vaultPath });
          setNotes(noteList);
        } catch (error) {
          console.error('Failed to reload notes after external change:', error);
        }
      }

      // 열린 노트 동작(안전 모드). 이벤트 수신~flush 사이에 사용자가 다른 노트로 전환했을 수 있으므로,
      // 모든 분기는 "지금도 그 노트가 열려 있는지"를 flush 시점에 다시 확인한 뒤에만 동작한다.
      const stillOpen = () => (useNoteStore.getState().currentNote?.path ?? null) === actionPath;

      if (action === 'clear') {
        // 외부 삭제된 노트가 아직 열려 있을 때만 비운다(전환된 다른 노트의 미저장 편집 보호).
        if (stillOpen()) setCurrentNote(null);
      } else if (action === 'flag-external' && actionPath) {
        if (stillOpen()) setExternalChangePath(actionPath);
      } else if (action === 'reread' && actionPath && vaultId) {
        // 재읽기는 파일 IO(IPC 왕복)가 끼므로, 읽기 전과 setCurrentNote 직전 두 번 모두
        // "같은 노트가 열려 있고 미저장 편집이 없음"을 확인한다(await 도중 시작된 편집 보호).
        if (stillOpen() && !currentIsDirty()) {
          try {
            const fresh = await electronAPI.note.read({ notePath: actionPath, vaultId });
            if (stillOpen() && !currentIsDirty()) {
              setCurrentNote(fresh);
            }
          } catch (error) {
            console.error('Failed to re-read externally changed note:', error);
          }
        }
      }
    };

    const unsubscribe = electronAPI.indexer.onChanged((payload) => {
      const { currentVault } = useVaultStore.getState();
      const { currentNote } = useNoteStore.getState();
      const currentNotePath = currentNote?.path ?? null;

      const plan = planIndexRefresh(payload, {
        currentVaultPath: currentVault?.path ?? null,
        currentNotePath,
        isDirty: currentIsDirty(),
      });

      if (plan.reloadList) needsReload = true;
      if (OPEN_NOTE_RANK[plan.openNote] > OPEN_NOTE_RANK[pendingAction]) {
        pendingAction = plan.openNote;
        pendingActionPath = currentNotePath;
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
