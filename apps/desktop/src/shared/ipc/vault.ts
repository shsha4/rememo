import type { VaultConfig } from '@memograph/core';

export interface VaultCreateRequest {
  vaultPath: string;
  name: string;
}

export interface VaultOpenRequest {
  vaultPath: string;
}

export interface VaultIsValidRequest {
  vaultPath: string;
}

export interface VaultUpdateConfigRequest {
  vaultPath: string;
  config: Partial<VaultConfig>;
}
