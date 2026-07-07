export interface IndexerIndexVaultRequest {
  vaultPath: string;
  vaultId: string;
}

export interface IndexerGetBacklinksRequest {
  vaultPath: string;
  notePath: string;
}

export interface IndexerSearchNotesRequest {
  vaultPath: string;
  query: string;
}

export interface IndexerSearchByTagRequest {
  vaultPath: string;
  tag: string;
}

export interface IndexerGetAllTagsRequest {
  vaultPath: string;
}

export interface IndexerGetGraphDataRequest {
  vaultPath: string;
}

export interface IndexerStartWatchingRequest {
  vaultPath: string;
  vaultId: string;
}

export interface IndexerStopWatchingRequest {
  vaultPath: string;
}

// main → renderer 단방향 push(`index:changed`) 페이로드.
// watcher가 외부 파일 변경을 재색인한 직후 발신한다(앱 자기 변경은 억제되어 발신되지 않음).
export interface IndexChangedPayload {
  // chokidar 이벤트 종류.
  type: 'add' | 'change' | 'unlink';
  // 변경된 노트의 절대 경로.
  path: string;
  // 어느 vault에서 발생했는지(렌더러가 현재 vault와 대조해 무시 여부를 판단).
  vaultPath: string;
}
