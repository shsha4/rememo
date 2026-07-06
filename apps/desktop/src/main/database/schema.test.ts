import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initializeDatabase, closeDatabase } from './schema';

// 테스트마다 생성한 임시 DB 파일 경로를 모아 두었다가 종료 시 정리한다.
const tempDbPaths: string[] = [];

function makeTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rememo-schema-test-'));
  const dbPath = path.join(dir, 'index.db');
  tempDbPaths.push(dbPath);
  return dbPath;
}

function existsInMaster(db: Database.Database, name: string): boolean {
  const row = db.prepare('SELECT name FROM sqlite_master WHERE name = ?').get(name);
  return row !== undefined;
}

afterEach(() => {
  // 임시 DB 파일 및 WAL/SHM 사이드카까지 정리
  while (tempDbPaths.length > 0) {
    const dbPath = tempDbPaths.pop();
    if (!dbPath) continue;
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.rmSync(dbPath + suffix, { force: true });
      } catch {
        // 무시 (이미 지워졌거나 열려 있을 수 있음)
      }
    }
    try {
      fs.rmdirSync(path.dirname(dbPath));
    } catch {
      // 무시
    }
  }
});

describe('initializeDatabase — FTS5 dead schema 제거', () => {
  it('notes_fts 가상테이블을 생성하지 않는다', () => {
    const db = initializeDatabase(makeTempDbPath());
    try {
      expect(existsInMaster(db, 'notes_fts')).toBe(false);
    } finally {
      closeDatabase(db);
    }
  });

  it('notes_ai/notes_ad/notes_au 동기화 트리거를 생성하지 않는다', () => {
    const db = initializeDatabase(makeTempDbPath());
    try {
      expect(existsInMaster(db, 'notes_ai')).toBe(false);
      expect(existsInMaster(db, 'notes_ad')).toBe(false);
      expect(existsInMaster(db, 'notes_au')).toBe(false);
    } finally {
      closeDatabase(db);
    }
  });

  it('notes 테이블에 INSERT가 크래시 없이 동작한다 (트리거 잔재 회귀 방지)', () => {
    const db = initializeDatabase(makeTempDbPath());
    try {
      const now = Date.now();
      const insert = () =>
        db
          .prepare(
            `INSERT INTO notes (
              id, vault_id, title, path, content, content_hash, created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run('n1', 'v1', '제목', 'note.md', '내용', 'hash1', now, now, null);

      expect(insert).not.toThrow();

      const row = db.prepare('SELECT title FROM notes WHERE id = ?').get('n1') as
        { title: string } | undefined;
      expect(row?.title).toBe('제목');
    } finally {
      closeDatabase(db);
    }
  });

  it('기존 개발 DB에 남아 있는 notes_fts + 트리거를 재초기화 시 정리한다', () => {
    const dbPath = makeTempDbPath();

    // 과거 버전 상태를 재현: notes 테이블 + notes_fts + 동기화 트리거를 수동 생성.
    const legacy = new Database(dbPath);
    legacy.exec(`
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
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        path UNINDEXED, title, content, content='notes', content_rowid='rowid'
      );
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, path, title, content)
        VALUES (new.rowid, new.path, new.title, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        DELETE FROM notes_fts WHERE rowid = old.rowid;
      END;
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        UPDATE notes_fts SET title = new.title, content = new.content WHERE rowid = new.rowid;
      END;
    `);
    expect(existsInMaster(legacy, 'notes_fts')).toBe(true);
    expect(existsInMaster(legacy, 'notes_ai')).toBe(true);
    legacy.close();

    // 최신 initializeDatabase를 다시 호출하면 잔재가 정리되어야 한다.
    const db = initializeDatabase(dbPath);
    try {
      expect(existsInMaster(db, 'notes_fts')).toBe(false);
      expect(existsInMaster(db, 'notes_ai')).toBe(false);
      expect(existsInMaster(db, 'notes_ad')).toBe(false);
      expect(existsInMaster(db, 'notes_au')).toBe(false);

      // 트리거가 사라졌으니 INSERT가 없는 notes_fts를 참조해 크래시하지 않는다.
      const now = Date.now();
      const insert = () =>
        db
          .prepare(
            `INSERT INTO notes (
              id, vault_id, title, path, content, content_hash, created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run('n1', 'v1', '제목', 'note.md', '내용', 'hash1', now, now, null);
      expect(insert).not.toThrow();
    } finally {
      closeDatabase(db);
    }
  });
});
