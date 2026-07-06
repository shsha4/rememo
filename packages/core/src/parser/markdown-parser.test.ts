import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownParser } from './markdown-parser';

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
});
