import type { Note, NoteCreateInput, NoteUpdateInput } from '../domain/note';
import { NoteNotFoundError, NoteAlreadyExistsError } from '../domain/note';
import { fileService } from './file.service';
import path from 'path';
import crypto from 'crypto';

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
      path: input.path,
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
      path: notePath,
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
    return this.listNotesRecursive(vaultPath);
  }

  private async listNotesRecursive(dirPath: string): Promise<string[]> {
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
        const subNotes = await this.listNotesRecursive(fullPath);
        notes.push(...subNotes);
      } else if (entry.endsWith('.md')) {
        notes.push(fullPath);
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
