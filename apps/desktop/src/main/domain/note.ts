export interface Note {
  id: string;
  vaultId: string;
  title: string;
  path: string;
  content: string;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: NoteMetadata;
}

export interface NoteMetadata {
  tags?: string[];
  aliases?: string[];
  [key: string]: any;
}

export interface NoteCreateInput {
  vaultId: string;
  title: string;
  path: string;
  content?: string;
  metadata?: NoteMetadata;
}

export interface NoteUpdateInput {
  content?: string;
  metadata?: NoteMetadata;
}

export class NoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Note not found: ${id}`);
    this.name = 'NoteNotFoundError';
  }
}

export class NoteAlreadyExistsError extends Error {
  constructor(path: string) {
    super(`Note already exists at path: ${path}`);
    this.name = 'NoteAlreadyExistsError';
  }
}
