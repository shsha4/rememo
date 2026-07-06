import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownParser, toggleTodoLine, setDueDateOnLine } from './markdown-parser';

// 이 파일은 rememo의 "단위 테스트 기준 예시"다.
// - 순수 로직(파서)은 이렇게 입력→출력을 직접 검증한다.
// - 한글/조사 등 도메인 특성(엔티티 멘션)을 반드시 케이스로 남긴다.
describe('MarkdownParser', () => {
  let parser: MarkdownParser;

  beforeEach(() => {
    parser = new MarkdownParser();
  });

  describe('parseWikiLinks', () => {
    it('단순 링크 [[Note]]의 target을 추출한다', () => {
      const links = parser.parseWikiLinks('본문 [[Kafka]] 끝');
      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('Kafka');
      expect(links[0].alias).toBeUndefined();
    });

    it('별칭 [[Note|alias]]을 분리한다', () => {
      const [link] = parser.parseWikiLinks('[[Kafka|카프카]]');
      expect(link.target).toBe('Kafka');
      expect(link.alias).toBe('카프카');
    });

    it('헤딩 [[Note#Heading]]을 분리한다', () => {
      const [link] = parser.parseWikiLinks('[[Kafka#Producer]]');
      expect(link.target).toBe('Kafka');
      expect(link.heading).toBe('Producer');
    });

    it('헤딩+별칭 [[Note#Heading|alias]]을 모두 분리한다', () => {
      const [link] = parser.parseWikiLinks('[[Kafka#Producer|프로듀서]]');
      expect(link.target).toBe('Kafka');
      expect(link.heading).toBe('Producer');
      expect(link.alias).toBe('프로듀서');
    });

    it('한 본문의 여러 링크를 모두 찾고 position을 기록한다', () => {
      const links = parser.parseWikiLinks('[[A]]\n[[B]]');
      expect(links.map((l) => l.target)).toEqual(['A', 'B']);
      expect(links[1].position.line).toBe(2);
    });
  });

  describe('parseTags', () => {
    it('단순 태그 #tag를 추출한다', () => {
      const tags = parser.parseTags('#backend 관련 노트');
      expect(tags).toHaveLength(1);
      expect(tags[0].tag).toBe('backend');
    });

    it('계층 태그 #nested/tag를 하나로 추출한다', () => {
      const [tag] = parser.parseTags('#infra/kubernetes');
      expect(tag.tag).toBe('infra/kubernetes');
    });

    it('한글 태그를 지원한다', () => {
      const [tag] = parser.parseTags('#백엔드');
      expect(tag.tag).toBe('백엔드');
    });
  });

  describe('parseYAMLFrontMatter', () => {
    it('key: value 쌍을 파싱한다', () => {
      const meta = parser.parseYAMLFrontMatter('---\ntitle: My Note\n---\n본문');
      expect(meta?.title).toBe('My Note');
    });

    it('[a, b] 형태의 배열을 파싱한다', () => {
      const meta = parser.parseYAMLFrontMatter('---\ntags: [backend, java]\n---');
      expect(meta?.tags).toEqual(['backend', 'java']);
    });

    it('Front Matter가 없으면 undefined를 반환한다', () => {
      expect(parser.parseYAMLFrontMatter('# 제목만 있는 노트')).toBeUndefined();
    });
  });

  describe('extractContentWithoutFrontMatter', () => {
    it('Front Matter를 제거한 본문만 반환한다', () => {
      const body = parser.extractContentWithoutFrontMatter('---\ntitle: x\n---\n본문 내용');
      expect(body).toBe('본문 내용');
    });
  });

  describe('parseEntityMentions', () => {
    it('한글 조사 앞의 엔티티 멘션을 인식한다', () => {
      const mentions = parser.parseEntityMentions('카프카는 메시지 큐다', ['카프카']);
      expect(mentions.map((m) => m.target)).toEqual(['카프카']);
    });

    it('조사가 아닌 한글이 이어지면 멘션으로 보지 않는다', () => {
      // "카프카방" 은 별개 단어이므로 매칭되면 안 된다.
      const mentions = parser.parseEntityMentions('카프카방에 갔다', ['카프카']);
      expect(mentions).toHaveLength(0);
    });

    it('조사 "과/와"가 붙은 이름도 인식한다 (한 문장에 여러 엔티티)', () => {
      // 실제 버그 케이스: "박민준과 은혁진은 직장동료였다."에서 둘 다 인식돼야 한다.
      const mentions = parser.parseEntityMentions('박민준과 은혁진은 직장동료였다.', [
        '박민준',
        '은혁진',
      ]);
      expect(mentions.map((m) => m.target).sort()).toEqual(['박민준', '은혁진']);
    });

    it('다양한 조사(도/에서/으로)를 인식한다', () => {
      expect(parser.parseEntityMentions('박민준도 왔다', ['박민준'])).toHaveLength(1);
      expect(parser.parseEntityMentions('디케이테크인에서 일한다', ['디케이테크인'])).toHaveLength(
        1,
      );
      expect(parser.parseEntityMentions('무신사로 이직했다', ['무신사'])).toHaveLength(1);
    });

    it('이미 [[WikiLink]] 안에 있는 텍스트는 중복 멘션하지 않는다', () => {
      const mentions = parser.parseEntityMentions('[[카프카]] 문서', ['카프카']);
      expect(mentions).toHaveLength(0);
    });

    it('현재 노트 제목은 자기 참조로 제외한다', () => {
      const mentions = parser.parseEntityMentions('카프카 문서', ['카프카'], '카프카');
      expect(mentions).toHaveLength(0);
    });

    it('2글자 미만의 제목은 무시한다', () => {
      const mentions = parser.parseEntityMentions('A는 무엇인가', ['A']);
      expect(mentions).toHaveLength(0);
    });
  });

  describe('parseTodos', () => {
    it('미완료/완료 체크박스를 인식하고 completed를 구분한다', () => {
      const todos = parser.parseTodos('- [ ] 보고서 쓰기\n- [x] 장보기');
      expect(todos).toHaveLength(2);
      expect(todos[0]).toMatchObject({ text: '보고서 쓰기', completed: false });
      expect(todos[1]).toMatchObject({ text: '장보기', completed: true });
    });

    it('대문자 [X]도 완료로 인식한다', () => {
      const [todo] = parser.parseTodos('- [X] 완료된 일');
      expect(todo.completed).toBe(true);
    });

    it('불릿 -, *, + 를 모두 지원한다', () => {
      const todos = parser.parseTodos('- [ ] a\n* [ ] b\n+ [ ] c');
      expect(todos.map((t) => t.text)).toEqual(['a', 'b', 'c']);
    });

    it('체크박스가 아닌 줄은 무시한다', () => {
      const todos = parser.parseTodos('# 제목\n일반 문단\n- 일반 리스트\n- [ ] 진짜 할 일');
      expect(todos).toHaveLength(1);
      expect(todos[0].text).toBe('진짜 할 일');
    });

    it('들여쓴 하위 체크박스도 인식하고 줄 번호를 기록한다', () => {
      const todos = parser.parseTodos('- [ ] 상위\n  - [ ] 하위');
      expect(todos).toHaveLength(2);
      expect(todos[1].text).toBe('하위');
      expect(todos[1].line).toBe(2);
    });

    describe('마감일 문법', () => {
      it('📅 이모지 문법의 날짜를 분리하고 텍스트에서 제거한다', () => {
        const [todo] = parser.parseTodos('- [ ] 보고서 쓰기 📅 2026-07-10');
        expect(todo.text).toBe('보고서 쓰기');
        expect(todo.dueDate).toBe('2026-07-10');
        expect(todo.hasTime).toBe(false);
      });

      it('@due(...) 문법의 날짜를 분리한다', () => {
        const [todo] = parser.parseTodos('- [ ] 보고서 쓰기 @due(2026-07-10)');
        expect(todo.text).toBe('보고서 쓰기');
        expect(todo.dueDate).toBe('2026-07-10');
      });

      it('시간까지 있으면 hasTime=true, dueDate에 THH:mm을 붙인다', () => {
        const [todo] = parser.parseTodos('- [ ] 회의 📅 2026-07-10 14:30');
        expect(todo.dueDate).toBe('2026-07-10T14:30');
        expect(todo.hasTime).toBe(true);
      });

      it('마감일이 없으면 dueDate는 undefined다', () => {
        const [todo] = parser.parseTodos('- [ ] 그냥 할 일');
        expect(todo.dueDate).toBeUndefined();
        expect(todo.hasTime).toBe(false);
      });

      it('유효하지 않은 날짜(2026-13-40)는 마감일로 취급하지 않는다', () => {
        const [todo] = parser.parseTodos('- [ ] 잘못된 날짜 📅 2026-13-40');
        expect(todo.dueDate).toBeUndefined();
      });

      it('두 문법이 함께 있고 앞 토큰이 무효 날짜면 뒤의 유효한 토큰을 채택한다', () => {
        const [todo] = parser.parseTodos('- [ ] 작업 📅 2026-13-40 @due(2026-07-10)');
        expect(todo.dueDate).toBe('2026-07-10');
      });

      it('시각 범위(24:00 등)가 유효하지 않으면 시각을 무시하고 날짜만 쓴다', () => {
        const [todo] = parser.parseTodos('- [ ] 회의 📅 2026-07-10 25:99');
        expect(todo.dueDate).toBe('2026-07-10');
        expect(todo.hasTime).toBe(false);
      });

      it('한글 텍스트 뒤 마감일도 정상 분리한다', () => {
        const [todo] = parser.parseTodos('- [x] 카프카 공부하기 @due(2026-08-01)');
        expect(todo.text).toBe('카프카 공부하기');
        expect(todo.completed).toBe(true);
        expect(todo.dueDate).toBe('2026-08-01');
      });
    });

    describe('코드펜스 제외', () => {
      it('``` 코드블록 안의 체크박스는 할 일로 보지 않는다', () => {
        const content = ['- [ ] 진짜', '```', '- [ ] 코드 예시', '```', '- [x] 또 진짜'].join('\n');
        const todos = parser.parseTodos(content);
        expect(todos.map((t) => t.text)).toEqual(['진짜', '또 진짜']);
      });

      it('~~~ 펜스도 동일하게 제외한다', () => {
        const content = ['~~~', '- [ ] 코드 안', '~~~', '- [ ] 코드 밖'].join('\n');
        const todos = parser.parseTodos(content);
        expect(todos.map((t) => t.text)).toEqual(['코드 밖']);
      });
    });
  });
});

describe('toggleTodoLine', () => {
  it('[ ] 를 [x] 로 토글한다', () => {
    const result = toggleTodoLine('- [ ] 할 일', 1);
    expect(result).toBe('- [x] 할 일');
  });

  it('[x] 를 [ ] 로 토글한다', () => {
    const result = toggleTodoLine('- [x] 할 일', 1);
    expect(result).toBe('- [ ] 할 일');
  });

  it('대문자 [X] 도 [ ] 로 토글한다', () => {
    expect(toggleTodoLine('- [X] 할 일', 1)).toBe('- [ ] 할 일');
  });

  it('지정한 줄만 토글하고 나머지는 그대로 둔다', () => {
    const content = '- [ ] 첫째\n- [ ] 둘째\n- [ ] 셋째';
    const result = toggleTodoLine(content, 2);
    expect(result).toBe('- [ ] 첫째\n- [x] 둘째\n- [ ] 셋째');
  });

  it('체크박스가 아닌 줄이면 원본을 그대로 반환한다', () => {
    expect(toggleTodoLine('일반 문단', 1)).toBe('일반 문단');
  });

  it('범위를 벗어난 줄 번호면 원본을 그대로 반환한다', () => {
    expect(toggleTodoLine('- [ ] 할 일', 5)).toBe('- [ ] 할 일');
  });

  it('CRLF 줄바꿈의 \\r을 보존한다', () => {
    const result = toggleTodoLine('- [ ] 할 일\r\n다음 줄', 1);
    expect(result).toBe('- [x] 할 일\r\n다음 줄');
  });
});

describe('setDueDateOnLine', () => {
  it('마감일이 없던 할 일에 📅 날짜를 추가한다', () => {
    expect(setDueDateOnLine('- [ ] 보고서', 1, '2026-07-10')).toBe('- [ ] 보고서 📅 2026-07-10');
  });

  it('시각까지 있으면 날짜 뒤에 시각을 붙인다', () => {
    expect(setDueDateOnLine('- [ ] 회의', 1, '2026-07-10T14:30')).toBe(
      '- [ ] 회의 📅 2026-07-10 14:30',
    );
  });

  it('기존 📅 마감일을 새 날짜로 교체한다', () => {
    expect(setDueDateOnLine('- [ ] 보고서 📅 2026-07-01', 1, '2026-07-10')).toBe(
      '- [ ] 보고서 📅 2026-07-10',
    );
  });

  it('기존 @due() 마감일도 교체한다', () => {
    expect(setDueDateOnLine('- [ ] 보고서 @due(2026-07-01)', 1, '2026-07-10')).toBe(
      '- [ ] 보고서 📅 2026-07-10',
    );
  });

  it('dueDate가 null이면 기존 마감일 토큰을 제거한다', () => {
    expect(setDueDateOnLine('- [ ] 보고서 📅 2026-07-10', 1, null)).toBe('- [ ] 보고서');
  });

  it('체크박스가 아닌 줄이면 원본을 그대로 반환한다', () => {
    expect(setDueDateOnLine('일반 문단', 1, '2026-07-10')).toBe('일반 문단');
  });

  it('지정한 줄만 바꾸고 CRLF를 보존한다', () => {
    expect(setDueDateOnLine('- [ ] 첫째\r\n- [ ] 둘째', 2, '2026-07-10')).toBe(
      '- [ ] 첫째\r\n- [ ] 둘째 📅 2026-07-10',
    );
  });
});
