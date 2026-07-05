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
