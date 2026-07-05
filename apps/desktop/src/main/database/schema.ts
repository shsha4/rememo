import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export function initializeDatabase(dbPath: string): Database.Database {
  // Ensure the parent directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      title TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  // Create links table for WikiLinks
  // No FOREIGN KEY constraints - target notes may not exist yet
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_note_path TEXT NOT NULL,
      target_note_path TEXT NOT NULL,
      link_text TEXT NOT NULL,
      alias TEXT,
      heading TEXT,
      link_type TEXT NOT NULL,
      position_start INTEGER NOT NULL,
      position_end INTEGER NOT NULL
    );
  `);

  // Create tags table
  // No FOREIGN KEY constraints for flexibility
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_path TEXT NOT NULL,
      tag TEXT NOT NULL,
      position_start INTEGER NOT NULL,
      position_end INTEGER NOT NULL
    );
  `);

  // Create backlinks view (virtual table for quick backlink queries)
  db.exec(`
    CREATE VIEW IF NOT EXISTS backlinks AS
    SELECT
      target_note_path as note_path,
      source_note_path as backlink_path,
      link_text,
      alias,
      heading
    FROM links;
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_vault_id ON notes(vault_id);
    CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path);
    CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);
    CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_note_path);
    CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_note_path);
    CREATE INDEX IF NOT EXISTS idx_tags_note ON tags(note_path);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
  `);

  // Full-text search table for notes
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      path UNINDEXED,
      title,
      content,
      content='notes',
      content_rowid='rowid'
    );
  `);

  // Triggers to keep FTS table in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, path, title, content)
      VALUES (new.rowid, new.path, new.title, new.content);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      DELETE FROM notes_fts WHERE rowid = old.rowid;
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      UPDATE notes_fts
      SET title = new.title, content = new.content
      WHERE rowid = new.rowid;
    END;
  `);

  return db;
}

export function closeDatabase(db: Database.Database): void {
  db.close();
}
