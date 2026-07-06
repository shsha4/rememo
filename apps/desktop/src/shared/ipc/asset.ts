export interface AssetSaveImageRequest {
  vaultPath: string;
  data: Uint8Array;
  mime: string;
  originalName?: string;
}
