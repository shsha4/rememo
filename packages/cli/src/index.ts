#!/usr/bin/env node
import path from 'path';
import { loadVault } from './vault';
import {
  buildContext,
  buildGraph,
  findNoteByTitle,
  searchNotes,
  type NoteContext,
  type Graph,
  type SearchHit,
} from './graph';
import { writeAgentGuide } from './init';

// 아주 얇은 인자 파서: `rememo <command> [positional] [--flag value] [--bool]`.
interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  options: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      // 다음 토큰이 값(플래그가 아님)이면 소비, 아니면 boolean 플래그.
      if (next !== undefined && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, options };
}

function resolveVaultPath(options: Record<string, string | boolean>): string {
  const v = options.vault;
  if (typeof v === 'string' && v.length > 0) {
    return path.resolve(v);
  }
  return process.cwd();
}

const USAGE = `rememo — vault를 파일에서 즉석 파싱해 관계를 조회한다 (SQLite 미사용, 항상 최신).

사용법:
  rememo init [--vault DIR] [--force]
  rememo context <노트제목> [--vault DIR] [--hops N] [--json]
  rememo graph [--vault DIR] [--json]
  rememo search <쿼리> [--vault DIR] [--json]

옵션:
  --vault DIR   vault 루트 (기본: 현재 디렉터리)
  --json        기계 판독용 JSON 출력 (에이전트 권장)
  --hops N      context 이웃 확장 깊이 (기본 1, 0이면 이웃 없음)
  --force       init에서 기존 AGENTS.md를 덮어쓴다
`;

function printContextText(ctx: NoteContext): void {
  console.log(`# ${ctx.title}  (${ctx.relativePath})`);
  if (ctx.tags.length > 0) {
    console.log(`태그: ${ctx.tags.map((t) => `#${t}`).join(' ')}`);
  }
  console.log(`\n## 아웃링크 (${ctx.outgoing.length})`);
  for (const e of ctx.outgoing) {
    const mark = e.linkType === 'wiki_link' ? '[[]]' : '(멘션)';
    console.log(`  ${mark} ${e.linkText} → ${e.target ?? '(깨진 링크)'}`);
  }
  console.log(`\n## 백링크 (${ctx.backlinks.length})`);
  for (const e of ctx.backlinks) {
    const mark = e.linkType === 'wiki_link' ? '[[]]' : '(멘션)';
    console.log(`  ${mark} ${e.source}`);
  }
  console.log(`\n## 이웃 (${ctx.neighbors.length})`);
  for (const n of ctx.neighbors) {
    console.log(`  - ${n}`);
  }
}

function printGraphText(graph: Graph): void {
  console.log(`노드 ${graph.nodes.length}개, 엣지 ${graph.edges.length}개\n`);
  for (const e of graph.edges) {
    const mark = e.linkType === 'wiki_link' ? '[[]]' : '(멘션)';
    console.log(`  ${e.source} ${mark}→ ${e.target ?? `(깨진: ${e.linkText})`}`);
  }
}

function printSearchText(hits: SearchHit[]): void {
  console.log(`${hits.length}개 매칭`);
  for (const h of hits) {
    const where = [h.matchedTitle ? '제목' : null, h.matchedContent ? '본문' : null]
      .filter(Boolean)
      .join('+');
    console.log(`  - ${h.title}  (${h.relativePath})  [${where}]`);
  }
}

async function run(argv: string[]): Promise<number> {
  const { command, positional, options } = parseArgs(argv);
  const asJson = options.json === true;

  if (!command || command === 'help' || options.help === true) {
    console.log(USAGE);
    return command ? 0 : 1;
  }

  const vaultPath = resolveVaultPath(options);

  switch (command) {
    case 'init': {
      const result = await writeAgentGuide(vaultPath, options.force === true);
      if (!result.written) {
        console.error(`이미 존재합니다: ${result.path}\n덮어쓰려면 --force를 붙이세요.`);
        return 1;
      }
      console.log(`AGENTS.md를 생성했습니다: ${result.path}`);
      return 0;
    }

    case 'context': {
      const title = positional[0];
      if (!title) {
        console.error('오류: 노트 제목이 필요합니다. 예) rememo context "박민준"');
        return 1;
      }
      const notes = await loadVault(vaultPath);
      const note = findNoteByTitle(title, notes);
      if (!note) {
        console.error(`오류: 제목이 "${title}"인 노트를 vault에서 찾지 못했습니다.`);
        return 1;
      }
      // --hops 미지정 시 1. 0은 "이웃 없음"으로 존중하고, 음수/NaN은 1로 폴백.
      let hops = 1;
      if (typeof options.hops === 'string') {
        const parsed = parseInt(options.hops, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          hops = parsed;
        }
      }
      const ctx = buildContext(note, notes, vaultPath, hops);
      if (asJson) {
        console.log(JSON.stringify(ctx, null, 2));
      } else {
        printContextText(ctx);
      }
      return 0;
    }

    case 'graph': {
      const notes = await loadVault(vaultPath);
      const graph = buildGraph(notes, vaultPath);
      if (asJson) {
        console.log(JSON.stringify(graph, null, 2));
      } else {
        printGraphText(graph);
      }
      return 0;
    }

    case 'search': {
      const query = positional[0];
      if (!query) {
        console.error('오류: 검색어가 필요합니다. 예) rememo search "카프카"');
        return 1;
      }
      const notes = await loadVault(vaultPath);
      const hits = searchNotes(query, notes);
      if (asJson) {
        console.log(JSON.stringify(hits, null, 2));
      } else {
        printSearchText(hits);
      }
      return 0;
    }

    default:
      console.error(`알 수 없는 명령: ${command}\n`);
      console.log(USAGE);
      return 1;
  }
}

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error('실행 오류:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
