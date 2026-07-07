// 카테고리(=vault 폴더) IPC 요청 타입. main·preload·renderer 세 계층이 공유한다.

export interface CategoryListRequest {
  vaultPath: string;
  /** 기본 노트 폴더명(예: "Notes"). 카테고리는 이 폴더 하위에서만 수집한다. */
  notesDir: string;
}

export interface CategoryCreateRequest {
  /** 생성할 카테고리 폴더의 전체 경로. */
  dirPath: string;
}

export interface CategoryRenameRequest {
  /** 기존 카테고리 폴더 전체 경로. */
  oldPath: string;
  /** 변경할 카테고리 폴더 전체 경로. */
  newPath: string;
  vaultPath: string;
  vaultId: string;
}

export interface CategoryDeleteRequest {
  /** 삭제할 카테고리 폴더 전체 경로. */
  dirPath: string;
  vaultPath: string;
}
