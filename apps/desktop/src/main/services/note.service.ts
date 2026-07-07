import type { Note, NoteCreateInput, NoteUpdateInput } from '@memograph/core';
import { NoteNotFoundError, NoteAlreadyExistsError, normalizeNotePath } from '@memograph/core';
import { fileService } from './file.service';
import path from 'path';
import crypto from 'crypto';

// LLM 에이전트 지침 파일. 볼트 오픈 시 자동 생성되는 프로젝트 메타 파일이지 사용자 노트가
// 아니므로, 노트 목록·인덱스(그래프/검색/백링크)에서 제외한다. (생성은 vault.service가 담당)
export const AGENT_GUIDE_FILE = 'AGENTS.md';

/** 볼트 루트의 에이전트 지침(AGENTS.md)인지 판정한다(노트 목록/인덱스 제외용). */
export function isAgentGuidePath(notePath: string, vaultPath: string): boolean {
  return path.resolve(notePath) === path.resolve(vaultPath, AGENT_GUIDE_FILE);
}

export class NoteService {
  async createNote(input: NoteCreateInput): Promise<Note> {
    const exists = await fileService.fileExists(input.path);
    if (exists) {
      throw new NoteAlreadyExistsError(input.path);
    }

    const content = input.content || '';
    const contentHash = this.calculateHash(content);

    const note: Note = {
      id: crypto.randomUUID(),
      vaultId: input.vaultId,
      title: input.title,
      path: normalizeNotePath(input.path),
      content,
      contentHash,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: input.metadata,
    };

    await fileService.writeFile(input.path, content);
    return note;
  }

  async readNote(notePath: string, vaultId: string): Promise<Note> {
    const exists = await fileService.fileExists(notePath);
    if (!exists) {
      throw new NoteNotFoundError(notePath);
    }

    const content = await fileService.readFile(notePath);
    const title = fileService.getFileNameWithoutExt(notePath);
    const contentHash = this.calculateHash(content);

    return {
      id: crypto.randomUUID(),
      vaultId,
      title,
      path: normalizeNotePath(notePath),
      content,
      contentHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateNote(notePath: string, vaultId: string, update: NoteUpdateInput): Promise<Note> {
    const exists = await fileService.fileExists(notePath);
    if (!exists) {
      throw new NoteNotFoundError(notePath);
    }

    const currentNote = await this.readNote(notePath, vaultId);
    const newContent = update.content !== undefined ? update.content : currentNote.content;
    const contentHash = this.calculateHash(newContent);

    await fileService.writeFile(notePath, newContent);

    return {
      ...currentNote,
      content: newContent,
      contentHash,
      updatedAt: new Date(),
      metadata: update.metadata || currentNote.metadata,
    };
  }

  async deleteNote(notePath: string): Promise<void> {
    const exists = await fileService.fileExists(notePath);
    if (!exists) {
      throw new NoteNotFoundError(notePath);
    }

    await fileService.deleteFile(notePath);
  }

  async listNotes(vaultPath: string): Promise<string[]> {
    return this.listNotesRecursive(vaultPath, vaultPath);
  }

  private async listNotesRecursive(dirPath: string, vaultPath: string): Promise<string[]> {
    const entries = await fileService.readDir(dirPath);
    const notes: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const isDir = await fileService.directoryExists(fullPath);

      // Skip .memograph directory
      if (entry === '.memograph') {
        continue;
      }

      if (isDir) {
        const subNotes = await this.listNotesRecursive(fullPath, vaultPath);
        notes.push(...subNotes);
      } else if (entry.endsWith('.md')) {
        // 에이전트 지침 파일(AGENTS.md)은 노트가 아니므로 목록에서 제외한다.
        if (isAgentGuidePath(fullPath, vaultPath)) {
          continue;
        }
        notes.push(normalizeNotePath(fullPath));
      }
    }

    return notes;
  }

  async renameNote(oldPath: string, newPath: string): Promise<void> {
    const exists = await fileService.fileExists(oldPath);
    if (!exists) {
      throw new NoteNotFoundError(oldPath);
    }

    const newExists = await fileService.fileExists(newPath);
    if (newExists) {
      throw new NoteAlreadyExistsError(newPath);
    }

    await fileService.moveFile(oldPath, newPath);
  }

  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  getNoteTitleFromPath(notePath: string): string {
    return fileService.getFileNameWithoutExt(notePath);
  }

  getNoteRelativePath(notePath: string, vaultPath: string): string {
    return path.relative(vaultPath, notePath);
  }
}

export const noteService = new NoteService();
