import type { IpcMainInvokeEvent } from 'electron';
import type { IpcResult } from '../../shared/ipc';

// 핸들러를 try/catch로 감싸 IpcResult 봉투로 표준화한다.
// 핸들러 내부의 부수효과용 try/catch(재인덱싱 등)는 그대로 두고, 주 로직의 에러만 여기서 봉투화한다.
export function ipcHandler<Req, Res>(
  fn: (event: IpcMainInvokeEvent, req: Req) => Promise<Res> | Res,
): (event: IpcMainInvokeEvent, req: Req) => Promise<IpcResult<Res>> {
  return async (event, req) => {
    try {
      return { success: true, data: await fn(event, req) };
    } catch (error) {
      const e = error as Error;
      return {
        success: false,
        error: { code: e?.name || 'Error', message: e?.message || String(error) },
      };
    }
  };
}
