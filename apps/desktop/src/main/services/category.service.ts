import {
  normalizeNotePath,
  CategoryAlreadyExistsError,
  CategoryNotFoundError,
  CategoryNotEmptyError,
} from '@memograph/core';
import { fileService } from './file.service';
import { noteService } from './note.service';
import path from 'path';

/**
 * 카테고리(=vault의 폴더) 파일시스템 조작. core의 순수 트리 로직과 달리, 여기서는 실제
 * mkdir/rename/rmdir를 수행한다. 노트 뮤테이션과 동일하게 IPC 핸들러가 재인덱싱을 트리거한다.
 */
export class CategoryService {
  /**
   * baseDir 하위 모든 폴더를 전체 경로(정규화)로 재귀 수집한다(.memograph·node_modules·숨김 제외).
   * 카테고리는 notesDir 하위 폴더이므로 호출자가 `<vault>/<notesDir>`를 baseDir로 넘긴다.
   * baseDir가 없으면 빈 배열을 반환한다.
   */
  async listFolders(baseDir: string): Promise<string[]> {
    if (!(await fileService.directoryExists(baseDir))) {
      return [];
    }
    return this.listFoldersRecursive(baseDir, []);
  }

  private async listFoldersRecursive(dirPath: string, acc: string[]): Promise<string[]> {
    const entries = await fileService.readDir(dirPath);

    for (const entry of entries) {
      // .memograph·node_modules·숨김 폴더는 카테고리가 아니다.
      if (entry === '.memograph' || entry === 'node_modules' || entry.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dirPath, entry);
      if (await fileService.directoryExists(fullPath)) {
        acc.push(normalizeNotePath(fullPath));
        await this.listFoldersRecursive(fullPath, acc);
      }
    }

    return acc;
  }

  /** 새 카테고리 폴더를 만든다. 이미 있으면 실패. */
  async createCategory(dirPath: string): Promise<void> {
    if (await fileService.directoryExists(dirPath)) {
      throw new CategoryAlreadyExistsError(dirPath);
    }
    await fileService.createDirectory(dirPath);
  }

  /** 카테고리 폴더 이름/위치를 변경한다(하위 노트가 함께 이동). */
  async renameCategory(oldPath: string, newPath: string): Promise<void> {
    if (!(await fileService.directoryExists(oldPath))) {
      throw new CategoryNotFoundError(oldPath);
    }
    if (await fileService.directoryExists(newPath)) {
      throw new CategoryAlreadyExistsError(newPath);
    }
    // fs.rename은 디렉터리 이동에도 동작한다.
    await fileService.moveFile(oldPath, newPath);
  }

  /** 카테고리 폴더를 삭제한다. 데이터 유실 방지를 위해 노트(.md)가 하나라도 있으면 거부한다. */
  async deleteCategory(dirPath: string): Promise<void> {
    if (!(await fileService.directoryExists(dirPath))) {
      throw new CategoryNotFoundError(dirPath);
    }
    // listNotes는 하위 .md를 재귀 수집한다(빈 하위폴더만 있으면 삭제 허용).
    const notes = await noteService.listNotes(dirPath);
    if (notes.length > 0) {
      throw new CategoryNotEmptyError(dirPath);
    }
    await fileService.deleteDirectory(dirPath);
  }

  /** 폴더 하위 노트(.md) 전체 경로 목록. 폴더 이름변경 시 인덱스 갱신·watcher 억제용. */
  async listNotesUnder(dirPath: string): Promise<string[]> {
    return noteService.listNotes(dirPath);
  }
}

export const categoryService = new CategoryService();
