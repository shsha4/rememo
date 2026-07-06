import type { NoteCreateInput, NoteUpdateInput } from '@memograph/core';

export interface NoteCreateRequest {
  input: NoteCreateInput;
  vaultPath: string;
}

export interface NoteReadRequest {
  notePath: string;
  vaultId: string;
}

export interface NoteUpdateRequest {
  notePath: string;
  vaultId: string;
  update: NoteUpdateInput;
  vaultPath: string;
}

export interface NoteDeleteRequest {
  notePath: string;
  vaultPath: string;
}

export interface NoteListRequest {
  vaultPath: string;
}

export interface NoteRenameRequest {
  oldPath: string;
  newPath: string;
  vaultPath: string;
  vaultId: string;
}

export interface NoteGetTitleRequest {
  notePath: string;
}

export interface NoteGetRelativePathRequest {
  notePath: string;
  vaultPath: string;
}
