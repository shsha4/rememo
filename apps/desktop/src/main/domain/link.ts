export enum LinkType {
  WIKI_LINK = 'wiki_link',
  HEADING_LINK = 'heading_link',
  TAG = 'tag',
}

export interface Link {
  id: string;
  sourceNoteId: string;
  targetTitle: string;
  targetNoteId?: string;
  linkType: LinkType;
  alias?: string;
  heading?: string;
  position?: LinkPosition;
}

export interface LinkPosition {
  start: number;
  end: number;
  line: number;
}

export interface WikiLink {
  target: string;
  alias?: string;
  heading?: string;
  position?: LinkPosition;
}

export interface Backlink {
  noteId: string;
  noteTitle: string;
  notePath: string;
  links: Link[];
}
