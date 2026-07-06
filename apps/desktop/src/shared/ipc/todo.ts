import type { NotificationSettings } from '@memograph/core';

export interface TodoListRequest {
  vaultPath: string;
}

export interface TodoToggleRequest {
  vaultPath: string;
  notePath: string;
  line: number;
  vaultId: string;
}

export interface TodoSetDueRequest {
  vaultPath: string;
  notePath: string;
  line: number;
  dueDate: string | null;
  vaultId: string;
}

export interface TodoUpdateSettingsRequest {
  vaultPath: string;
  settings: NotificationSettings;
}
