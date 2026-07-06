import { describe, it, expect } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcHandler } from './ipc-result';

// ipcHandler는 electron event를 실제로 사용하지 않으므로 더미로 대체한다.
const fakeEvent = {} as IpcMainInvokeEvent;

describe('ipcHandler', () => {
  it('성공 시 { success: true, data } 봉투를 반환한다', async () => {
    const handler = ipcHandler(async (_event, req: { n: number }) => req.n * 2);

    const result = await handler(fakeEvent, { n: 21 });

    expect(result).toEqual({ success: true, data: 42 });
  });

  it('동기 반환 fn도 봉투로 감싼다', async () => {
    const handler = ipcHandler(() => 'pong');

    const result = await handler(fakeEvent, undefined as never);

    expect(result).toEqual({ success: true, data: 'pong' });
  });

  it('throw 시 { success: false, error: { code, message } } 봉투를 반환한다', async () => {
    const handler = ipcHandler(async () => {
      throw new Error('boom');
    });

    const result = await handler(fakeEvent, undefined as never);

    expect(result).toEqual({
      success: false,
      error: { code: 'Error', message: 'boom' },
    });
  });

  it('커스텀 error.name이 code로 매핑된다', async () => {
    class VaultNotFoundError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'VaultNotFoundError';
      }
    }
    const handler = ipcHandler(async () => {
      throw new VaultNotFoundError('vault 없음');
    });

    const result = await handler(fakeEvent, undefined as never);

    expect(result).toEqual({
      success: false,
      error: { code: 'VaultNotFoundError', message: 'vault 없음' },
    });
  });

  it('name/message가 없는 throw(문자열 등)는 code "Error"로 폴백한다', async () => {
    const handler = ipcHandler(async () => {
      throw 'just a string';
    });

    const result = await handler(fakeEvent, undefined as never);

    expect(result).toEqual({
      success: false,
      error: { code: 'Error', message: 'just a string' },
    });
  });
});
