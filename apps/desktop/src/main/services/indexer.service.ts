import { databaseService } from './database.service';
import { noteService } from './note.service';
import { MarkdownParser } from '../parser/markdown-parser';
import type { FSWatcher } from 'chokidar';
import path from 'path';
import { fileService } from './file.service';

export class IndexerService {
  private watchers: Map<string, FSWatcher> = new Map();
  private parser = new MarkdownParser();
  private chokidar: any = null;

  private async getChokidar() {
    if (!this.chokidar) {
      this.chokidar = await import('chokidar');
    }
    return this.chokidar;
  }

  async indexVault(vaultPath: string, vaultId: string): Promise<void> {
    console.log(`Starting indexing for vault: ${vaultPath}`);

    // Get all markdown files in the vault
    const notes = await noteService.listNotes(vaultPath);

    console.log(`Found ${notes.length} notes to index`);

    // Phase 1: Insert all notes first
    console.log('Phase 1: Indexing all notes...');
    for (const notePath of notes) {
      try {
        const note = await noteService.readNote(notePath, vaultId);
        databaseService.insertNote(vaultPath, note);
      } catch (error) {
        console.error(`Failed to index note ${notePath}:`, error);
      }
    }

    // Phase 2: Index links, entity mentions, and tags
    console.log('Phase 2: Indexing links and entity mentions...');
    for (const notePath of notes) {
      try {
        await this.indexLinksAndTags(notePath, vaultPath, vaultId);
      } catch (error) {
        console.error(`Failed to index links for ${notePath}:`, error);
      }
    }

    console.log(`Indexing complete for vault: ${vaultPath}`);
  }

  private async indexLinksAndTags(notePath: string, vaultPath: string, vaultId: string): Promise<void> {
    // Read the note
    const note = await noteService.readNote(notePath, vaultId);

    // Parse and index explicit WikiLinks
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

    // Parse and index entity mentions (auto-detected references to other notes)
    const allNoteTitles = databaseService.getAllNoteTitles(vaultPath);
    console.log(`[${notePath}] All note titles:`, allNoteTitles);
    const entityMentions = this.parser.parseEntityMentions(note.content, allNoteTitles, note.title);
    console.log(`[${notePath}] Found ${entityMentions.length} entity mentions:`, entityMentions.map(m => m.target));
    const entityMentionRecords = entityMentions.map(mention => ({
      sourceNotePath: notePath,
      targetNotePath: this.resolveLinkPath(mention.target, notePath, vaultPath),
      linkText: mention.target,
      alias: mention.alias,
      heading: mention.heading,
      linkType: 'entity_mention',
      positionStart: mention.position?.start || 0,
      positionEnd: mention.position?.end || 0,
    }));

    // Combine all links (explicit + entity mentions)
    const allLinkRecords = [...linkRecords, ...entityMentionRecords];

    if (allLinkRecords.length > 0) {
      databaseService.insertLinks(vaultPath, allLinkRecords);
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

  async indexNote(notePath: string, vaultPath: string, vaultId: string): Promise<void> {
    // Read the note
    const note = await noteService.readNote(notePath, vaultId);

    // Insert note into database
    databaseService.insertNote(vaultPath, note);

    // Index links and tags
    await this.indexLinksAndTags(notePath, vaultPath, vaultId);
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

  async reindexAllNotesLinks(vaultPath: string, vaultId: string): Promise<void> {
    // Get all notes from the database (they're already indexed)
    const notes = await noteService.listNotes(vaultPath);

    // Re-index links and tags for all notes (to pick up new entity mentions)
    for (const notePath of notes) {
      try {
        await this.indexLinksAndTags(notePath, vaultPath, vaultId);
      } catch (error) {
        console.error(`Failed to reindex links for ${notePath}:`, error);
      }
    }
  }

  async startWatching(vaultPath: string, vaultId: string): Promise<void> {
    if (this.watchers.has(vaultPath)) {
      console.log(`Already watching vault: ${vaultPath}`);
      return;
    }

    console.log(`Starting file watcher for vault: ${vaultPath}`);

    const chokidar = await this.getChokidar();
    const watcher = chokidar.watch('**/*.md', {
      cwd: vaultPath,
      ignored: ['**/.memograph/**', '**/node_modules/**'],
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('add', async (relativePath: string) => {
      const fullPath = path.join(vaultPath, relativePath);
      console.log(`Note added: ${fullPath}`);
      try {
        // Index the new note
        await this.indexNote(fullPath, vaultPath, vaultId);

        // Re-index all existing notes' links/tags to detect entity mentions to the new note
        console.log('Re-indexing all notes to detect entity mentions to new note...');
        await this.reindexAllNotesLinks(vaultPath, vaultId);
      } catch (error) {
        console.error(`Failed to index new note ${fullPath}:`, error);
      }
    });

    watcher.on('change', async (relativePath: string) => {
      const fullPath = path.join(vaultPath, relativePath);
      console.log(`Note changed: ${fullPath}`);
      try {
        await this.reindexNote(fullPath, vaultPath, vaultId);

        // Re-index all other notes' links/tags to detect entity mentions to/from this note
        console.log('Re-indexing all notes to update entity mentions...');
        await this.reindexAllNotesLinks(vaultPath, vaultId);
      } catch (error) {
        console.error(`Failed to reindex note ${fullPath}:`, error);
      }
    });

    watcher.on('unlink', async (relativePath: string) => {
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
    const cleanLinkText = linkText.split('#')[0].trim();

    // Get title-to-path mapping from database
    const titleToPath = databaseService.getTitleToPathMap(vaultPath);

    // Try to find exact match by title
    if (titleToPath.has(cleanLinkText)) {
      return titleToPath.get(cleanLinkText)!;
    }

    // If it contains path separators, treat as relative path
    if (cleanLinkText.includes('/') || cleanLinkText.includes('\\')) {
      const currentDir = path.dirname(currentNotePath);
      return path.join(currentDir, `${cleanLinkText}.md`);
    }

    // Fallback: assume it's in the same directory as current note
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
