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

// 프리뷰에서 [[target]] 위키링크를 실제 노트 경로로 해석할 때 쓴다(읽기 전용).
export interface LinkResolveRequest {
  vaultPath: string;
  // 링크가 적힌(출발) 노트의 절대경로. 상대경로 후보를 만드는 기준 디렉터리.
  notePath: string;
  // [[...]] 안의 대상 텍스트(헤딩/별칭 제외한 노트 제목·경로).
  target: string;
}

export interface LinkResolveResult {
  // 해석된(또는 존재해야 할 후보) 노트의 절대경로.
  notePath: string;
  // 그 경로에 실제 노트 파일이 존재하는지. false면 미해결 링크(클릭 시 생성 대상).
  exists: boolean;
}
