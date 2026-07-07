import { BrowserWindow } from 'electron';
import type { IndexChangedPayload } from '../shared/ipc';

// main → renderer 단방향 push. 열려 있는 모든 창의 renderer에 인덱스 변경을 알린다.
// (request/response가 아니므로 IpcResult 봉투를 쓰지 않는다.)
export function broadcastIndexChanged(payload: IndexChangedPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send('indexer:changed', payload);
  }
}
