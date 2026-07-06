import type Database from 'better-sqlite3';
import { normalizeNotePath } from '@memograph/core';
import { initializeDatabase, closeDatabase } from '../database/schema';
import path from 'path';

export class DatabaseService {
  private databases: Map<string, Database.Database> = new Map();

  getDatabase(vaultPath: string): Database.Database {
    const existing = this.databases.get(vaultPath);
    if (existing) {
      return existing;
    }

    const dbPath = path.join(vaultPath, '.memograph', 'index.db');
    const db = initializeDatabase(dbPath);
    this.databases.set(vaultPath, db);
    return db;
  }

  closeDatabase(vaultPath: string): void {
    const db = this.databases.get(vaultPath);
    if (db) {
      closeDatabase(db);
      this.databases.delete(vaultPath);
    }
  }

  closeAllDatabases(): void {
    for (const [vaultPath, db] of this.databases.entries()) {
      closeDatabase(db);
      this.databases.delete(vaultPath);
    }
  }

  // Note operations
  insertNote(
    vaultPath: string,
    note: {
      id: string;
      vaultId: string;
      title: string;
      path: string;
      content: string;
      contentHash: string;
      createdAt: Date;
      updatedAt: Date;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const db = this.getDatabase(vaultPath);
    const notePath = normalizeNotePath(note.path);

    // Check if note exists by path
    const existing = db.prepare('SELECT id, created_at FROM notes WHERE path = ?').get(notePath) as
      { id: string; created_at: number } | undefined;

    if (existing) {
      // Update existing note - keep original id and created_at
      const stmt = db.prepare(`
        UPDATE notes
        SET vault_id = ?, title = ?, content = ?, content_hash = ?, updated_at = ?, metadata = ?
        WHERE path = ?
      `);
      stmt.run(
        note.vaultId,
        note.title,
        note.content,
        note.contentHash,
        note.updatedAt.getTime(),
        note.metadata ? JSON.stringify(note.metadata) : null,
        notePath,
      );
    } else {
      // Insert new note
      const stmt = db.prepare(`
        INSERT INTO notes (
          id, vault_id, title, path, content, content_hash, created_at, updated_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        note.id,
        note.vaultId,
        note.title,
        notePath,
        note.content,
        note.contentHash,
        note.createdAt.getTime(),
        note.updatedAt.getTime(),
        note.metadata ? JSON.stringify(note.metadata) : null,
      );
    }
  }

  deleteNote(vaultPath: string, rawNotePath: string): void {
    const db = this.getDatabase(vaultPath);
    const notePath = normalizeNotePath(rawNotePath);

    // Delete from notes table
    const deleteNoteStmt = db.prepare('DELETE FROM notes WHERE path = ?');
    deleteNoteStmt.run(notePath);

    // Delete all links where this note is source or target
    const deleteLinksStmt = db.prepare(
      'DELETE FROM links WHERE source_note_path = ? OR target_note_path = ?',
    );
    deleteLinksStmt.run(notePath, notePath);

    // Delete all tags for this note
    const deleteTagsStmt = db.prepare('DELETE FROM tags WHERE note_path = ?');
    deleteTagsStmt.run(notePath);

    // Delete all todos for this note
    const deleteTodosStmt = db.prepare('DELETE FROM todos WHERE note_path = ?');
    deleteTodosStmt.run(notePath);
  }

  getNoteByPath(vaultPath: string, notePath: string): any {
    const db = this.getDatabase(vaultPath);
    const stmt = db.prepare('SELECT * FROM notes WHERE path = ?');
    return stmt.get(normalizeNotePath(notePath));
  }

  /**
   * 볼트 인덱스(notes/links/tags/todos)를 전부 비운다.
   * indexVault가 매번 깨끗한 상태에서 재빌드하도록 해, 이름변경·이동·경로표기 변경으로
   * 남는 orphan 행을 정리한다. (인덱스는 파일에서 재생성되는 파생 데이터라 안전)
   */
  clearVaultIndex(vaultPath: string): void {
    const db = this.getDatabase(vaultPath);
    db.exec('DELETE FROM todos; DELETE FROM tags; DELETE FROM links; DELETE FROM notes;');
  }

  // Link operations
  insertLinks(
    vaultPath: string,
    links: Array<{
      sourceNotePath: string;
      targetNotePath: string;
      linkText: string;
      alias?: string;
      heading?: string;
      linkType: string;
      positionStart: number;
      positionEnd: number;
    }>,
  ): void {
    const db = this.getDatabase(vaultPath);

    // First, delete existing links from this source note
    const deleteStmt = db.prepare('DELETE FROM links WHERE source_note_path = ?');
    if (links.length > 0) {
      deleteStmt.run(normalizeNotePath(links[0].sourceNotePath));
    }

    // Insert new links
    const insertStmt = db.prepare(`
      INSERT INTO links (
        source_note_path, target_note_path, link_text, alias, heading, link_type, position_start, position_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const link of links) {
      insertStmt.run(
        normalizeNotePath(link.sourceNotePath),
        normalizeNotePath(link.targetNotePath),
        link.linkText,
        link.alias || null,
        link.heading || null,
        link.linkType,
        link.positionStart,
        link.positionEnd,
      );
    }
  }

  // Tag operations
  insertTags(
    vaultPath: string,
    tags: Array<{
      notePath: string;
      tag: string;
      positionStart: number;
      positionEnd: number;
    }>,
  ): void {
    const db = this.getDatabase(vaultPath);

    // First, delete existing tags from this note
    const deleteStmt = db.prepare('DELETE FROM tags WHERE note_path = ?');
    if (tags.length > 0) {
      deleteStmt.run(normalizeNotePath(tags[0].notePath));
    }

    // Insert new tags
    const insertStmt = db.prepare(`
      INSERT INTO tags (note_path, tag, position_start, position_end)
      VALUES (?, ?, ?, ?)
    `);

    for (const tag of tags) {
      insertStmt.run(normalizeNotePath(tag.notePath), tag.tag, tag.positionStart, tag.positionEnd);
    }
  }

  // Todo operations
  deleteTodosForNote(vaultPath: string, notePath: string): void {
    const db = this.getDatabase(vaultPath);
    db.prepare('DELETE FROM todos WHERE note_path = ?').run(normalizeNotePath(notePath));
  }

  insertTodos(
    vaultPath: string,
    todos: Array<{
      notePath: string;
      text: string;
      completed: boolean;
      dueDate?: string;
      hasTime: boolean;
      line: number;
      positionStart: number;
      positionEnd: number;
    }>,
  ): void {
    if (todos.length === 0) {
      return;
    }
    const db = this.getDatabase(vaultPath);
    const insertStmt = db.prepare(`
      INSERT INTO todos (
        note_path, text, completed, due_date, has_time, line, position_start, position_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const todo of todos) {
      insertStmt.run(
        normalizeNotePath(todo.notePath),
        todo.text,
        todo.completed ? 1 : 0,
        todo.dueDate ?? null,
        todo.hasTime ? 1 : 0,
        todo.line,
        todo.positionStart,
        todo.positionEnd,
      );
    }
  }

  getAllTodos(vaultPath: string): Array<{
    notePath: string;
    text: string;
    completed: boolean;
    dueDate?: string;
    hasTime: boolean;
    line: number;
  }> {
    const db = this.getDatabase(vaultPath);
    const rows = db
      .prepare(
        `SELECT note_path, text, completed, due_date, has_time, line
         FROM todos
         ORDER BY (due_date IS NULL), due_date ASC`,
      )
      .all() as Array<{
      note_path: string;
      text: string;
      completed: number;
      due_date: string | null;
      has_time: number;
      line: number;
    }>;

    return rows.map((r) => ({
      notePath: r.note_path,
      text: r.text,
      completed: r.completed === 1,
      dueDate: r.due_date ?? undefined,
      hasTime: r.has_time === 1,
      line: r.line,
    }));
  }

  // Backlink queries
  getBacklinks(vaultPath: string, notePath: string): any[] {
    const db = this.getDatabase(vaultPath);
    const stmt = db.prepare(`
      SELECT * FROM backlinks WHERE note_path = ?
    `);
    return stmt.all(normalizeNotePath(notePath));
  }

  // Search operations with improved Korean support
  searchNotes(vaultPath: string, query: string): any[] {
    const db = this.getDatabase(vaultPath);

    // Clean and prepare search query
    const cleanQuery = query.trim();
    if (cleanQuery.length === 0) {
      return [];
    }

    // Use LIKE search for better Korean character support
    // Search in both title and content
    const likePattern = `%${cleanQuery}%`;

    const stmt = db.prepare(`
      SELECT
        *,
        CASE
          WHEN title LIKE ? THEN 10
          WHEN content LIKE ? THEN 5
          ELSE 1
        END as relevance_score
      FROM notes
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY relevance_score DESC, updated_at DESC
      LIMIT 50
    `);

    return stmt.all(likePattern, likePattern, likePattern, likePattern);
  }

  searchByTag(vaultPath: string, tag: string): any[] {
    const db = this.getDatabase(vaultPath);
    const stmt = db.prepare(`
      SELECT DISTINCT n.*
      FROM notes n
      JOIN tags t ON n.path = t.note_path
      WHERE t.tag = ?
    `);
    return stmt.all(tag);
  }

  getAllTags(vaultPath: string): string[] {
    const db = this.getDatabase(vaultPath);
    const stmt = db.prepare('SELECT DISTINCT tag FROM tags ORDER BY tag');
    const results = stmt.all() as Array<{ tag: string }>;
    return results.map((r) => r.tag);
  }

  getAllNoteTitles(vaultPath: string): string[] {
    const db = this.getDatabase(vaultPath);
    const stmt = db.prepare('SELECT DISTINCT title FROM notes ORDER BY LENGTH(title) DESC');
    const results = stmt.all() as Array<{ title: string }>;
    return results.map((r) => r.title);
  }

  getTitleToPathMap(vaultPath: string): Map<string, string> {
    const db = this.getDatabase(vaultPath);
    const stmt = db.prepare('SELECT title, path FROM notes');
    const results = stmt.all() as Array<{ title: string; path: string }>;
    const map = new Map<string, string>();
    results.forEach((r) => map.set(r.title, r.path));
    return map;
  }

  // Graph data
  getGraphData(vaultPath: string): { nodes: any[]; edges: any[] } {
    const db = this.getDatabase(vaultPath);

    const nodesStmt = db.prepare('SELECT DISTINCT path, title FROM notes');
    const nodes = nodesStmt.all();

    // Only include edges where both source and target notes exist
    const edgesStmt = db.prepare(`
      SELECT DISTINCT l.source_note_path as source, l.target_note_path as target
      FROM links l
      INNER JOIN notes n1 ON l.source_note_path = n1.path
      INNER JOIN notes n2 ON l.target_note_path = n2.path
    `);
    const edges = edgesStmt.all();

    console.log('[GraphData] Nodes count:', nodes.length);
    console.log('[GraphData] Edges count:', edges.length);
    console.log('[GraphData] Nodes:', nodes);

    return { nodes, edges };
  }
}

export const databaseService = new DatabaseService();
