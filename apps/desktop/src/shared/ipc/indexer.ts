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
