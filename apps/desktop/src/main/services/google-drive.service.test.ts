import { describe, it, expect } from 'vitest';
import {
  GoogleDriveService,
  NotImplementedError,
  googleDriveService,
} from './google-drive.service';

describe('GoogleDriveService (미구현 stub)', () => {
  const service = new GoogleDriveService();

  it('authenticate()는 NotImplementedError로 reject된다', async () => {
    await expect(service.authenticate()).rejects.toThrow(NotImplementedError);
    await expect(service.authenticate()).rejects.toThrow(/not implemented/i);
  });

  it('backupVault()는 NotImplementedError로 reject된다', async () => {
    await expect(service.backupVault('/some/vault')).rejects.toThrow(NotImplementedError);
  });

  it('listBackups()는 NotImplementedError로 reject된다', async () => {
    await expect(service.listBackups()).rejects.toThrow(NotImplementedError);
  });

  it('restoreVault()는 NotImplementedError로 reject된다', async () => {
    await expect(service.restoreVault('backup-1', '/target')).rejects.toThrow(NotImplementedError);
  });

  it('deleteBackup()는 NotImplementedError로 reject된다', async () => {
    await expect(service.deleteBackup('backup-1')).rejects.toThrow(NotImplementedError);
  });

  it('isAuthenticated()는 항상 false를 반환한다(인증 상태를 위장하지 않는다)', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('signOut()은 throw하지 않고 안전하게 resolve된다', async () => {
    await expect(service.signOut()).resolves.toBeUndefined();
  });

  it('싱글턴 googleDriveService도 동일하게 동작한다', async () => {
    expect(googleDriveService.isAuthenticated()).toBe(false);
    await expect(googleDriveService.authenticate()).rejects.toThrow(NotImplementedError);
  });
});
