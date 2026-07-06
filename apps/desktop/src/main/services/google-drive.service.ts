/**
 * Google Drive Backup/Restore Service
 *
 * ⚠️ 미구현 stub. 아래 동작 메서드는 실제 구현 전까지 성공을 위장하지 않고
 *    반드시 NotImplementedError를 throw한다. (과거엔 가짜 성공값을 반환해
 *    호출부가 "동기화됨"으로 오인할 수 있었다 — 이를 제거했다.)
 *
 * TODO: Implement OAuth2 authentication with Google
 * TODO: Integrate Google Drive API v3
 * TODO: Implement resumable uploads for large files
 * TODO: Add progress tracking for uploads/downloads
 * TODO: Implement conflict resolution strategies
 *
 * Required packages to install:
 * - googleapis
 * - @google-cloud/local-auth
 */

/**
 * 아직 구현되지 않은 기능을 호출했을 때 던지는 도메인 에러.
 */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet.`);
    this.name = 'NotImplementedError';
  }
}

export class GoogleDriveService {
  /**
   * Initialize OAuth2 authentication
   * TODO: Implement actual OAuth flow
   */
  async authenticate(): Promise<boolean> {
    throw new NotImplementedError('Google Drive authentication');
  }

  /**
   * Check if user is authenticated
   * 미구현 상태이므로 항상 false를 반환한다(인증된 상태를 위장하지 않는다).
   */
  isAuthenticated(): boolean {
    return false;
  }

  /**
   * Backup vault to Google Drive
   * TODO: Implement actual upload logic
   */
  async backupVault(_vaultPath: string): Promise<string> {
    throw new NotImplementedError('Google Drive backup');
  }

  /**
   * List all backups from Google Drive
   * TODO: Implement actual listing logic
   */
  async listBackups(): Promise<Array<{ id: string; name: string; createdAt: Date }>> {
    throw new NotImplementedError('Google Drive backup listing');
  }

  /**
   * Restore vault from Google Drive backup
   * TODO: Implement actual download and restore logic
   */
  async restoreVault(_backupId: string, _targetPath: string): Promise<void> {
    throw new NotImplementedError('Google Drive restore');
  }

  /**
   * Delete backup from Google Drive
   * TODO: Implement deletion logic
   */
  async deleteBackup(_backupId: string): Promise<void> {
    throw new NotImplementedError('Google Drive backup deletion');
  }

  /**
   * Sign out from Google Drive
   * 로그아웃은 미구현이어도 무해하므로 부수효과 없는 안전한 no-op으로 둔다.
   */
  async signOut(): Promise<void> {
    // 유지할 인증 세션이 없으므로 아무 것도 하지 않는다.
  }
}

export const googleDriveService = new GoogleDriveService();
