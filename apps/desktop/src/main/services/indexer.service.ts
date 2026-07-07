import { databaseService } from './database.service';
import { noteService, isAgentGuidePath } from './note.service';
import { fileService } from './file.service';
import { MarkdownParser } from '@memograph/core';
import type { FSWatcher } from 'chokidar';
import path from 'path';

// 내부(앱)에서 발생한 파일 변경을 watcher가 무시할 유예 시간(ms).
// 파일 쓰기 완료 후 chokidar 이벤트가 도착하기까지의 지연을 여유있게 커버한다.
const INTERNAL_CHANGE_WINDOW_MS = 5000;

export class IndexerService {
  private watchers: Map<string, FSWatcher> = new Map();
  private parser = new MarkdownParser();
  private chokidar: any = null;

  // 앱 내부에서 방금 변경한 파일 경로(정규화 key) → 변경 시각(ms).
  // IPC 핸들러가 직접 reindex하므로, 뒤이어 오는 watcher 이벤트는 중복이라 무시한다.
  private internalChanges: Map<string, number> = new Map();

  private async getChokidar() {
    if (!this.chokidar) {
      this.chokidar = await import('chokidar');
    }
    return this.chokidar;
  }

  // Windows 대소문자/경로구분자 차이를 흡수해 동일 파일을 같은 key로 매칭한다.
  // watcher의 path.join(vaultPath, relativePath)와 핸들러의 절대경로가 같은 key가 되도록 한다.
  private normalizeKey(p: string): string {
    return path.resolve(p).toLowerCase();
  }

  // 앱 내부에서 파일을 변경했음을 기록한다(watcher 억제용).
  markInternalChange(notePath: string): void {
    this.internalChanges.set(this.normalizeKey(notePath), Date.now());
  }

  // 최근 내부 변경인지 판정한다. 매칭된 항목은 히트 여부와 무관하게 소비(delete)하고,
  // 만료된 다른 항목들도 함께 정리한다. 테스트를 위해 now를 주입할 수 있다.
  isRecentInternalChange(notePath: string, now: number = Date.now()): boolean {
    const key = this.normalizeKey(notePath);
    const ts = this.internalChanges.get(key);

    let recent = false;
    if (ts !== undefined) {
      recent = now - ts < INTERNAL_CHANGE_WINDOW_MS;
      // 매칭된 항목은 소비한다(한 번의 내부 변경 → 한 번의 억제).
      this.internalChanges.delete(key);
    }

    // 만료된 잔여 항목 정리(누수 방지).
    for (const [k, t] of this.internalChanges.entries()) {
      if (now - t >= INTERNAL_CHANGE_WINDOW_MS) {
        this.internalChanges.delete(k);
      }
    }

    return recent;
  }

  async indexVault(vaultPath: string, vaultId: string): Promise<void> {
    console.log(`Starting indexing for vault: ${vaultPath}`);

    // 매번 깨끗한 상태에서 재빌드한다(경로표기 변경·이름변경·이동으로 남은 orphan 정리).
    databaseService.clearVaultIndex(vaultPath);

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

  private async indexLinksAndTags(
    notePath: string,
    vaultPath: string,
    vaultId: string,
  ): Promise<void> {
    // Read the note
    const note = await noteService.readNote(notePath, vaultId);

    // Parse and index explicit WikiLinks
    const links = this.parser.parseWikiLinks(note.content);
    const linkRecords = links.map((link) => ({
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
    console.log(
      `[${notePath}] Found ${entityMentions.length} entity mentions:`,
      entityMentions.map((m) => m.target),
    );
    const entityMentionRecords = entityMentions.map((mention) => ({
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
    const tagRecords = tags.map((tag) => ({
      notePath,
      tag: tag.tag,
      positionStart: tag.position?.start || 0,
      positionEnd: tag.position?.end || 0,
    }));

    if (tagRecords.length > 0) {
      databaseService.insertTags(vaultPath, tagRecords);
    }

    // Parse and index todos (체크박스 할 일)
    // 항상 기존 todo를 먼저 지워, 노트에서 할 일이 모두 제거된 경우도 반영한다.
    databaseService.deleteTodosForNote(vaultPath, notePath);
    const todos = this.parser.parseTodos(note.content);
    const todoRecords = todos.map((todo) => ({
      notePath,
      text: todo.text,
      completed: todo.completed,
      dueDate: todo.dueDate,
      hasTime: todo.hasTime,
      line: todo.line,
      positionStart: todo.position?.start || 0,
      positionEnd: todo.position?.end || 0,
    }));

    if (todoRecords.length > 0) {
      databaseService.insertTodos(vaultPath, todoRecords);
    }
  }

  async indexNote(notePath: string, vaultPath: string, vaultId: string): Promise<void> {
    // 에이전트 지침 파일(AGENTS.md)은 노트가 아니므로 인덱싱하지 않는다
    // (watcher가 외부 편집으로 add/change를 잡아도 DB에 넣지 않도록 이 단일 관문에서 막는다).
    if (isAgentGuidePath(notePath, vaultPath)) {
      return;
    }

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
    // chokidar v4+에서는 glob 패턴 지원이 제거됐다. 따라서 vault 디렉터리를 통째로(재귀) 감시하고
    // `ignored` 함수로 .md 파일만 남긴다. (과거 `chokidar.watch('**/*.md', {cwd})`는 v5에서
    // '**/*.md'를 literal 경로로 취급해 아무것도 감시하지 못했다.)
    const watcher = chokidar.watch(vaultPath, {
      // stats가 있는 파일 이벤트에서만 확장자를 검사한다. 디렉터리(stats 없음/isDirectory)는
      // 통과시켜야 하위로 재귀 감시가 이어진다. .memograph·node_modules는 경로로 배제한다.
      ignored: (testPath: string, stats?: { isFile(): boolean }) => {
        const norm = testPath.replace(/\\/g, '/');
        if (norm.includes('/.memograph') || norm.includes('/node_modules')) return true;
        if (stats?.isFile() && !norm.endsWith('.md')) return true;
        return false;
      },
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('add', async (changedPath: string) => {
      const fullPath = path.resolve(changedPath);
      if (this.isRecentInternalChange(fullPath)) {
        console.log('internal change 무시:', fullPath);
        return;
      }
      console.log(`Note added: ${fullPath}`);
      try {
        // Index the new note
        await this.indexNote(fullPath, vaultPath, vaultId);

        // Re-index all existing notes' links/tags to detect entity mentions to the new note
        console.log('Re-indexing all notes to detect entity mentions to new note...');
        await this.reindexAllNotesLinks(vaultPath, vaultId);

        // renderer UI 실시간 갱신 알림(DB 재색인 완료 후 발신).
        await this.notifyIndexChanged('add', fullPath, vaultPath);
      } catch (error) {
        console.error(`Failed to index new note ${fullPath}:`, error);
      }
    });

    watcher.on('change', async (changedPath: string) => {
      const fullPath = path.resolve(changedPath);
      if (this.isRecentInternalChange(fullPath)) {
        console.log('internal change 무시:', fullPath);
        return;
      }
      console.log(`Note changed: ${fullPath}`);
      try {
        await this.reindexNote(fullPath, vaultPath, vaultId);

        // Re-index all other notes' links/tags to detect entity mentions to/from this note
        console.log('Re-indexing all notes to update entity mentions...');
        await this.reindexAllNotesLinks(vaultPath, vaultId);

        // renderer UI 실시간 갱신 알림(DB 재색인 완료 후 발신).
        await this.notifyIndexChanged('change', fullPath, vaultPath);
      } catch (error) {
        console.error(`Failed to reindex note ${fullPath}:`, error);
      }
    });

    watcher.on('unlink', async (changedPath: string) => {
      const fullPath = path.resolve(changedPath);
      if (this.isRecentInternalChange(fullPath)) {
        console.log('internal change 무시:', fullPath);
        return;
      }
      console.log(`Note deleted: ${fullPath}`);
      try {
        await this.deleteNoteFromIndex(fullPath, vaultPath);

        // renderer UI 실시간 갱신 알림(DB 재색인 완료 후 발신).
        await this.notifyIndexChanged('unlink', fullPath, vaultPath);
      } catch (error) {
        console.error(`Failed to delete note from index ${fullPath}:`, error);
      }
    });

    // 폴더(카테고리) 추가/삭제. 빈 카테고리는 .md가 없어 위 파일 이벤트로는 잡히지 않으므로,
    // 디렉터리 이벤트를 받아 UI를 갱신한다(인덱스는 노트가 없어 손댈 게 없고, push만 보낸다).
    // 앱 자신이 만든 폴더는 category 핸들러가 markInternalChange로 표시해 여기서 무시된다.
    watcher.on('addDir', async (changedPath: string) => {
      const fullPath = path.resolve(changedPath);
      if (fullPath === path.resolve(vaultPath)) return; // vault 루트 자신은 무시
      if (this.isRecentInternalChange(fullPath)) return;
      console.log(`Folder added: ${fullPath}`);
      await this.notifyIndexChanged('add', fullPath, vaultPath);
    });

    watcher.on('unlinkDir', async (changedPath: string) => {
      const fullPath = path.resolve(changedPath);
      if (this.isRecentInternalChange(fullPath)) return;
      console.log(`Folder removed: ${fullPath}`);
      await this.notifyIndexChanged('unlink', fullPath, vaultPath);
    });

    this.watchers.set(vaultPath, watcher);
  }

  // renderer로 인덱스 변경을 push한다. electron(BrowserWindow) 의존은 chokidar와 동일하게
  // 동적 import로 지연 로드해, 이 모듈을 정적으로 import하는 단위 테스트(node)가 깨지지 않게 한다.
  private async notifyIndexChanged(
    type: 'add' | 'change' | 'unlink',
    fullPath: string,
    vaultPath: string,
  ): Promise<void> {
    // AGENTS.md는 노트가 아니므로 UI 갱신 대상에서 제외한다(indexNote 필터와 일관).
    if (isAgentGuidePath(fullPath, vaultPath)) {
      return;
    }
    try {
      const { broadcastIndexChanged } = await import('../notifier');
      broadcastIndexChanged({ type, path: fullPath, vaultPath });
    } catch (error) {
      console.error('Failed to broadcast index change:', error);
    }
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

  // WikiLink 대상(target)을 실제 노트 경로로 해석하고 그 노트가 존재하는지 판정한다.
  // 프리뷰에서 [[링크]]를 해결(이동)/미해결(생성) 중 무엇으로 렌더·처리할지 결정하는 데 쓴다.
  // 해석 규칙은 인덱싱과 동일한 단일 소스(resolveLinkPath: 제목 완전일치→상대경로)를 재사용한다.
  // exists=false여도 notePath는 "그 노트가 있어야 할 후보 경로"라 미해결 링크 클릭 시 생성 위치가 된다.
  async resolveLink(
    vaultPath: string,
    notePath: string,
    target: string,
  ): Promise<{ notePath: string; exists: boolean }> {
    const resolvedPath = this.resolveLinkPath(target, notePath, vaultPath);

    // 경계 보호: target에 `../` 등이 있으면 resolveLinkPath가 vault 밖 경로를 낼 수 있다.
    // 이 결과는 프리뷰 클릭 시 note.read/note.create의 파일 IO로 이어지므로, vault를 벗어나면
    // 거부해 임의 경로 읽기/쓰기를 막는다(asset 핸들러의 `..` 탈출 차단과 동일한 보호).
    const root = path.resolve(vaultPath);
    const resolved = path.resolve(resolvedPath);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`링크 대상이 vault 범위를 벗어납니다: ${target}`);
    }

    const exists = await fileService.fileExists(resolvedPath);
    return { notePath: resolvedPath, exists };
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

  getGraphData(vaultPath: string): { nodes: any[]; edges: any[] } {
    return databaseService.getGraphData(vaultPath);
  }
}

export const indexerService = new IndexerService();
