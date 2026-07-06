import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// indexer.service는 database.service/note.service를 통해 better-sqlite3(네이티브 모듈)를
// 정적 import한다. 억제 로직만 검증하므로 두 의존성을 빈 목으로 대체해 네이티브 로딩을 피한다.
vi.mock('./database.service', () => ({ databaseService: {} }));
vi.mock('./note.service', () => ({ noteService: {} }));

import { IndexerService } from './indexer.service';

describe('IndexerService 내부 변경 억제(watcher 중복 방지)', () => {
  let indexer: IndexerService;
  const base = 1_000_000; // 고정 기준 시각(ms)

  beforeEach(() => {
    // markInternalChange는 내부적으로 Date.now()를 사용하므로 고정해 결정적으로 만든다.
    vi.spyOn(Date, 'now').mockReturnValue(base);
    indexer = new IndexerService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mark 직후 window 내 now에서는 최근 내부 변경으로 판정한다', () => {
    const p = 'C:\\vault\\a.md';
    indexer.markInternalChange(p); // ts = base
    expect(indexer.isRecentInternalChange(p, base + 100)).toBe(true);
  });

  it('window(5초)를 벗어난 now에서는 false', () => {
    const p = 'C:\\vault\\a.md';
    indexer.markInternalChange(p);
    expect(indexer.isRecentInternalChange(p, base + 6000)).toBe(false);
  });

  it('한 번 판정하면 소비(consume)되어 같은 now의 두 번째 호출은 false', () => {
    const p = 'C:\\vault\\a.md';
    indexer.markInternalChange(p);
    expect(indexer.isRecentInternalChange(p, base + 100)).toBe(true);
    expect(indexer.isRecentInternalChange(p, base + 100)).toBe(false);
  });

  it('mark하지 않은 경로는 false', () => {
    expect(indexer.isRecentInternalChange('C:\\vault\\none.md', base + 100)).toBe(false);
  });

  // path.resolve 기반 정규화는 win32에서만 대소문자/역슬래시를 동일하게 처리한다.
  it.skipIf(process.platform !== 'win32')(
    '대소문자/경로구분자가 달라도 같은 파일로 인식한다 (win32)',
    () => {
      // 핸들러가 넘기는 절대경로 형태로 mark
      indexer.markInternalChange('C:\\vault\\Sub\\Note.md');
      // watcher의 path.join 결과처럼 표기가 달라도 같은 key로 매칭되어야 한다
      expect(indexer.isRecentInternalChange('c:/vault/sub/note.md', base + 100)).toBe(true);
    },
  );

  it('만료된 잔여 항목은 이후 판정 시 정리된다(누수 방지)', () => {
    indexer.markInternalChange('C:\\vault\\stale.md'); // ts = base
    // 다른 경로를 window 밖 시각으로 조회하면, 조회 대상뿐 아니라 만료된 stale도 정리된다.
    expect(indexer.isRecentInternalChange('C:\\vault\\other.md', base + 6000)).toBe(false);
    // 이제 stale은 이미 만료·정리되었으므로 window 내 시각으로 조회해도 false여야 한다.
    expect(indexer.isRecentInternalChange('C:\\vault\\stale.md', base + 100)).toBe(false);
  });
});
