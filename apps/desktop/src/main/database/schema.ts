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

  // Create todos table (체크박스 할 일)
  // No FOREIGN KEY constraints for flexibility (links/tags 테이블과 동일한 방침)
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_path TEXT NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL,
      due_date TEXT,
      has_time INTEGER NOT NULL,
      line INTEGER NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_todos_note ON todos(note_path);
    CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date);
    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
  `);

  // 미사용 FTS5 스키마 잔재 정리 (dead schema)
  // 검색은 searchNotes()에서 LIKE로 처리하며 notes_fts는 MATCH로 전혀 쿼리되지 않는다.
  // 과거 버전에서 생성된 기존 개발 DB에는 notes_fts 테이블·동기화 트리거가 남아 있을 수 있는데,
  // 테이블만 사라지고 트리거가 남으면 notes INSERT/UPDATE/DELETE 시 없는 테이블을 참조해 크래시한다.
  // 따라서 트리거를 먼저, 테이블을 나중에 drop한다(멱등).
  db.exec(`
    DROP TRIGGER IF EXISTS notes_ai;
    DROP TRIGGER IF EXISTS notes_ad;
    DROP TRIGGER IF EXISTS notes_au;
    DROP TABLE IF EXISTS notes_fts;
  `);

  return db;
}

export function closeDatabase(db: Database.Database): void {
  db.close();
}
