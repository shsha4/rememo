export interface Vault {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  config: VaultConfig;
}

export interface VaultConfig {
  version: string;
  name: string;
  defaultNoteLocation?: string;
  defaultAssetLocation?: string;
  notifications?: NotificationSettings;
}

export interface NotificationSettings {
  /** 할 일 마감 알림 사용 여부 */
  enabled: boolean;
  /** 마감일에 시각이 없을 때 알림을 보낼 기본 시각 ('HH:mm') */
  defaultTime: string;
}

export class VaultNotFoundError extends Error {
  constructor(path: string) {
    super(`Vault not found at path: ${path}`);
    this.name = 'VaultNotFoundError';
  }
}

export class VaultAlreadyExistsError extends Error {
  constructor(path: string) {
    super(`Vault already exists at path: ${path}`);
    this.name = 'VaultAlreadyExistsError';
  }
}
