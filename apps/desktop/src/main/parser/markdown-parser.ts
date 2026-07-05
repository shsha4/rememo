import { WikiLink, LinkType, LinkPosition } from '../domain/link';
import { Tag, TagPosition } from '../domain/tag';
import { NoteMetadata } from '../domain/note';

export interface ParseResult {
  wikiLinks: WikiLink[];
  tags: Tag[];
  metadata?: NoteMetadata;
}

export class MarkdownParser {
  // WikiLink patterns: [[link]], [[link|alias]], [[link#heading]]
  private static WIKI_LINK_REGEX = /\[\[([^\]]+?)\]\]/g;

  // Tag pattern: #tag or #nested/tag
  private static TAG_REGEX = /#([\w가-힣]+(?:\/[\w가-힣]+)*)/g;

  // YAML Front Matter pattern
  private static YAML_FRONT_MATTER_REGEX = /^---\n([\s\S]*?)\n---/;

  // Entity mention interface
  parseEntityMentions(content: string, entityTitles: string[], currentNoteTitle?: string): WikiLink[] {
    const mentions: WikiLink[] = [];

    // Filter out the current note's title to avoid self-references
    const filteredTitles = currentNoteTitle
      ? entityTitles.filter(title => title !== currentNoteTitle)
      : entityTitles;

    // Remove YAML front matter and existing WikiLinks to avoid false matches
    const contentWithoutFrontMatter = this.extractContentWithoutFrontMatter(content);
    const wikiLinkRanges = this.getWikiLinkRanges(content);

    // Sort entity titles by length (longest first) to match longer phrases first
    const sortedTitles = [...filteredTitles].sort((a, b) => b.length - a.length);

    for (const title of sortedTitles) {
      if (title.length < 2) continue; // Skip very short titles

      // Escape special regex characters
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Match whole words only (using word boundaries for English, context for Korean/mixed)
      // Korean particles (조사) that can follow nouns: 은, 는, 이, 가, 을, 를, 의, 에, 에서, 으로, 로, 와, 과, etc.
      // After the entity name, allow particles (followed by non-Korean) OR require non-Korean/word boundary
      const regex = new RegExp(`(?<![\\w가-힣])${escapedTitle}(?:(?=[은는이가을를의](?![\\w가-힣]))|(?![\\w가-힣]))`, 'g');

      let match: RegExpExecArray | null;
      while ((match = regex.exec(contentWithoutFrontMatter)) !== null) {
        const position: LinkPosition = {
          start: match.index,
          end: match.index + match[0].length,
          line: this.getLineNumber(contentWithoutFrontMatter, match.index),
        };

        // Skip if this position is already inside a WikiLink
        const isInsideWikiLink = wikiLinkRanges.some(
          (range) => match!.index >= range.start && match!.index < range.end
        );

        if (!isInsideWikiLink) {
          mentions.push({
            target: title,
            position,
          });
        }
      }
    }

    return mentions;
  }

  // Helper to get all WikiLink ranges in content
  private getWikiLinkRanges(content: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    const regex = new RegExp(MarkdownParser.WIKI_LINK_REGEX);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return ranges;
  }

  parse(content: string): ParseResult {
    const wikiLinks = this.parseWikiLinks(content);
    const tags = this.parseTags(content);
    const metadata = this.parseYAMLFrontMatter(content);

    return {
      wikiLinks,
      tags,
      metadata,
    };
  }

  parseWikiLinks(content: string): WikiLink[] {
    const links: WikiLink[] = [];
    let match: RegExpExecArray | null;

    const regex = new RegExp(MarkdownParser.WIKI_LINK_REGEX);

    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const innerText = match[1];

      const position: LinkPosition = {
        start: match.index,
        end: match.index + fullMatch.length,
        line: this.getLineNumber(content, match.index),
      };

      // Parse [[link|alias]] or [[link#heading]]
      if (innerText.includes('|')) {
        const [target, alias] = innerText.split('|').map((s) => s.trim());

        if (target.includes('#')) {
          const [noteTitle, heading] = target.split('#').map((s) => s.trim());
          links.push({
            target: noteTitle,
            alias,
            heading,
            position,
          });
        } else {
          links.push({
            target,
            alias,
            position,
          });
        }
      } else if (innerText.includes('#')) {
        const [target, heading] = innerText.split('#').map((s) => s.trim());
        links.push({
          target,
          heading,
          position,
        });
      } else {
        links.push({
          target: innerText.trim(),
          position,
        });
      }
    }

    return links;
  }

  parseTags(content: string): Tag[] {
    const tags: Tag[] = [];
    let match: RegExpExecArray | null;

    const regex = new RegExp(MarkdownParser.TAG_REGEX);

    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const tag = match[1];

      const position: TagPosition = {
        start: match.index,
        end: match.index + fullMatch.length,
        line: this.getLineNumber(content, match.index),
      };

      tags.push({
        id: '', // Will be set by the service
        noteId: '', // Will be set by the service
        tag,
        position,
      });
    }

    return tags;
  }

  parseYAMLFrontMatter(content: string): NoteMetadata | undefined {
    const match = content.match(MarkdownParser.YAML_FRONT_MATTER_REGEX);
    if (!match) {
      return undefined;
    }

    const yamlContent = match[1];
    const metadata: NoteMetadata = {};

    // Simple YAML parser (only handles basic key: value pairs)
    const lines = yamlContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      // Handle arrays (e.g., tags: [tag1, tag2])
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.substring(1, value.length - 1);
        metadata[key] = arrayContent
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      } else {
        metadata[key] = value;
      }
    }

    return metadata;
  }

  private getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return beforeIndex.split('\n').length;
  }

  extractContentWithoutFrontMatter(content: string): string {
    const match = content.match(MarkdownParser.YAML_FRONT_MATTER_REGEX);
    if (!match) {
      return content;
    }

    return content.substring(match[0].length).trim();
  }
}

export const markdownParser = new MarkdownParser();
