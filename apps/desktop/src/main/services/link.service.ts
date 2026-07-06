import type { Note } from '@memograph/core';
import { addWikiLink, removeWikiLink } from '@memograph/core';
import { noteService } from './note.service';

// 그래프 UI에서 노드 간 관계(WikiLink)를 추가/삭제하는 서비스.
// 실제 링크 문자열 변형은 core의 순수 함수(addWikiLink/removeWikiLink)에 위임하고,
// 여기서는 노트 파일 읽기/쓰기 오케스트레이션만 담당한다. 재인덱싱은 IPC 핸들러가 트리거한다.
export class LinkService {
  // sourceNotePath 노트 본문에 targetTitle로의 WikiLink를 추가한다.
  // 이미 링크가 있으면(멱등) 파일을 쓰지 않고 현재 노트를 그대로 반환한다.
  async addLink(sourceNotePath: string, targetTitle: string, vaultId: string): Promise<Note> {
    const note = await noteService.readNote(sourceNotePath, vaultId);
    const newContent = addWikiLink(note.content, targetTitle);

    if (newContent === note.content) {
      return note;
    }

    return noteService.updateNote(sourceNotePath, vaultId, { content: newContent });
  }

  // sourceNotePath 노트 본문에서 targetTitle로의 WikiLink를 제거한다.
  // 제거할 링크가 없으면 파일을 쓰지 않고 현재 노트를 그대로 반환한다.
  async removeLink(sourceNotePath: string, targetTitle: string, vaultId: string): Promise<Note> {
    const note = await noteService.readNote(sourceNotePath, vaultId);
    const newContent = removeWikiLink(note.content, targetTitle);

    if (newContent === note.content) {
      return note;
    }

    return noteService.updateNote(sourceNotePath, vaultId, { content: newContent });
  }
}

export const linkService = new LinkService();
