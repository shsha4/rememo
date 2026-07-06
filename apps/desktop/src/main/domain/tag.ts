export interface Tag {
  id: string;
  noteId: string;
  tag: string;
  position?: TagPosition;
}

export interface TagPosition {
  start: number;
  end: number;
  line: number;
}

export interface TagGroup {
  tag: string;
  count: number;
  notes: string[];
}

export interface TagHierarchy {
  tag: string;
  children: TagHierarchy[];
  noteCount: number;
}

export function parseTag(tag: string): string[] {
  return tag.split('/').filter(Boolean);
}

export function buildTagHierarchy(tags: Tag[]): TagHierarchy[] {
  const hierarchyMap = new Map<string, TagHierarchy>();

  tags.forEach((tag) => {
    const parts = parseTag(tag.tag);
    let currentPath = '';

    parts.forEach((part) => {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!hierarchyMap.has(currentPath)) {
        hierarchyMap.set(currentPath, {
          tag: currentPath,
          children: [],
          noteCount: 0,
        });
      }

      const current = hierarchyMap.get(currentPath)!;
      current.noteCount++;

      if (parentPath && hierarchyMap.has(parentPath)) {
        const parent = hierarchyMap.get(parentPath)!;
        if (!parent.children.find((c) => c.tag === currentPath)) {
          parent.children.push(current);
        }
      }
    });
  });

  return Array.from(hierarchyMap.values()).filter(
    (h) => !h.tag.includes('/')
  );
}
