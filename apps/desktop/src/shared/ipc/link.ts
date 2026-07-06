// 그래프 UI에서 노드 간 관계(WikiLink)를 추가/삭제하는 IPC 요청 타입.
// main·preload·renderer 세 계층이 공유한다.

export interface LinkAddRequest {
  sourceNotePath: string;
  targetTitle: string;
  vaultId: string;
  vaultPath: string;
}

export interface LinkRemoveRequest {
  sourceNotePath: string;
  targetTitle: string;
  vaultId: string;
  vaultPath: string;
}
