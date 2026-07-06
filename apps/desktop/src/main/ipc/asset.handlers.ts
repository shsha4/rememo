import { ipcMain } from 'electron';
import { assetService } from '../services/asset.service';

export function setupAssetHandlers() {
  // 클립보드/드래그앤드롭 이미지를 vault의 Assets/에 저장하고 상대경로를 반환한다.
  // 이미지는 링크/엔티티 인덱싱 대상이 아니므로 재인덱싱 트리거는 하지 않는다.
  ipcMain.handle(
    'asset:save-image',
    async (
      _event,
      vaultPath: string,
      data: Uint8Array,
      mime: string,
      originalName?: string,
    ): Promise<string> => {
      return assetService.saveImage(vaultPath, data, mime, originalName);
    },
  );
}
