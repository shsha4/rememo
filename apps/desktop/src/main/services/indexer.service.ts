import { databaseService } from './database.service';
import { noteService } from './note.service';
import { MarkdownParser } from '../parser/markdown-parser';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import path from 'path';
import { fileService } from './file.service';

export class IndexerService {
  private watchers: Map<string, FSWatcher> = new Map();
  private parser = new MarkdownParser();

  async indexVault(vaultPath: string, vaultId: string): Promise<void> {
    console.log(`Starting indexing for vault: ${vaultPath}`);

    // Get all markdown files in the vault
    const notes = await noteService.listNotes(vaultPath);

    console.log(`Found ${notes.length} notes to index`);

    // Index each note
    for (const notePath of notes) {
      try {
        await this.indexNote(notePath, vaultPath, vaultId);
      } catch (error) {
        console.error(`Failed to index note ${notePath}:`, error);
      }
    }

    console.log(`Indexing complete for vault: ${vaultPath}`);
  }

  async indexNote(notePath: string, vaultPath: string, vaultId: string): Promise<void> {
    // Read the note
    const note = await noteService.readNote(notePath, vaultId);

    // Insert note into database
    databaseService.insertNote(vaultPath, note);

    // Parse and index links
    const links = this.parser.parseWikiLinks(note.content);
    const linkRecords = links.map(link => ({
      sourceNotePath: notePath,
      targetNotePath: this.resolveLinkPath(link.target, notePath, vaultPath),
      linkText: link.target,
      alias: link.alias,
      heading: link.heading,
      linkType: 'wiki_link',
      positionStart: link.position?.start || 0,
      positionEnd: link.position?.end || 0,
    }));

    if (linkRecords.length > 0) {
      databaseService.insertLinks(vaultPath, linkRecords);
    }

    // Parse and index tags
    const tags = this.parser.parseTags(note.content);
    const tagRecords = tags.map(tag => ({
      notePath,
      tag: tag.tag,
      positionStart: tag.position?.start || 0,
      positionEnd: tag.position?.end || 0,
    }));

    if (tagRecords.length > 0) {
      databaseService.insertTags(vaultPath, tagRecords);
    }
  }

  async reindexNote(notePath: string, vaultPath: string, vaultId: string): Promise<void> {
    // Delete old index data
    databaseService.deleteNote(vaultPath, notePath);

    // Re-index the note
    await this.indexNote(notePath, vaultPath, vaultId);
  }

  async deleteNoteFromIndex(notePath: string, vaultPath: string): Promise<void> {
    databaseService.deleteNote(vaultPath, notePath);
  }

  startWatching(vaultPath: string, vaultId: string): void {
    if (this.watchers.has(vaultPath)) {
      console.log(`Already watching vault: ${vaultPath}`);
      return;
    }

    console.log(`Starting file watcher for vault: ${vaultPath}`);

    const watcher = chokidar.watch('**/*.md', {
      cwd: vaultPath,
      ignored: ['**/.memograph/**', '**/node_modules/**'],
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('add', async (relativePath) => {
      const fullPath = path.join(vaultPath, relativePath);
      console.log(`Note added: ${fullPath}`);
      try {
        await this.indexNote(fullPath, vaultPath, vaultId);
      } catch (error) {
        console.error(`Failed to index new note ${fullPath}:`, error);
      }
    });

    watcher.on('change', async (relativePath) => {
      const fullPath = path.join(vaultPath, relativePath);
      console.log(`Note changed: ${fullPath}`);
      try {
        await this.reindexNote(fullPath, vaultPath, vaultId);
      } catch (error) {
        console.error(`Failed to reindex note ${fullPath}:`, error);
      }
    });

    watcher.on('unlink', async (relativePath) => {
      const fullPath = path.join(vaultPath, relativePath);
      console.log(`Note deleted: ${fullPath}`);
      try {
        await this.deleteNoteFromIndex(fullPath, vaultPath);
      } catch (error) {
        console.error(`Failed to delete note from index ${fullPath}:`, error);
      }
    });

    this.watchers.set(vaultPath, watcher);
  }

  stopWatching(vaultPath: string): void {
    const watcher = this.watchers.get(vaultPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(vaultPath);
      console.log(`Stopped watching vault: ${vaultPath}`);
    }
  }

  stopAllWatchers(): void {
    for (const [vaultPath, watcher] of this.watchers.entries()) {
      watcher.close();
      this.watchers.delete(vaultPath);
    }
    console.log('Stopped all file watchers');
  }

  private resolveLinkPath(linkText: string, currentNotePath: string, vaultPath: string): string {
    // Remove heading reference if present
    const cleanLinkText = linkText.split('#')[0];

    // If it's an absolute path from vault root
    if (!cleanLinkText.includes('/')) {
      return path.join(vaultPath, 'Notes', `${cleanLinkText}.md`);
    }

    // If it's a relative path
    const currentDir = path.dirname(currentNotePath);
    return path.join(currentDir, `${cleanLinkText}.md`);
  }

  getBacklinks(vaultPath: string, notePath: string): any[] {
    return databaseService.getBacklinks(vaultPath, notePath);
  }

  searchNotes(vaultPath: string, query: string): any[] {
    return databaseService.searchNotes(vaultPath, query);
  }

  searchByTag(vaultPath: string, tag: string): any[] {
    return databaseService.searchByTag(vaultPath, tag);
  }

  getAllTags(vaultPath: string): string[] {
    return databaseService.getAllTags(vaultPath);
  }

  getGraphData(vaultPath: string): { nodes: any[], edges: any[] } {
    return databaseService.getGraphData(vaultPath);
  }
}

export const indexerService = new IndexerService();
