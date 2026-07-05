import { useState, useEffect } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import Logo from '../components/Logo';
import './VaultPage.css';

function VaultPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const { setCurrentVault, recentVaults, addRecentVault } = useVaultStore();

  const handleCreateVault = async () => {
    if (!vaultName.trim()) {
      setError('노트 공간 이름을 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      setLoadingMessage('폴더를 선택해주세요...');

      const folderPath = await electronAPI.vault.selectFolder();

      if (!folderPath) {
        setLoading(false);
        return;
      }

      setLoadingMessage('노트 공간 생성 중...');
      const vault = await electronAPI.vault.create(folderPath, vaultName.trim());

      setLoadingMessage('노트 인덱싱 중...');
      await electronAPI.indexer.indexVault(vault.path, vault.id);

      setLoadingMessage('파일 감시 시작 중...');
      await electronAPI.indexer.startWatching(vault.path, vault.id);

      setLoadingMessage('완료!');

      // Clear loading state before transition
      setLoading(false);
      setLoadingMessage('');

      // Set vault to trigger page transition
      setCurrentVault(vault);
      addRecentVault(vault.path);
    } catch (err: any) {
      console.error('[VaultPage] Error creating vault:', err);
      setError(err.message || '노트 공간 생성에 실패했습니다');
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleOpenVault = async () => {
    try {
      setLoading(true);
      setLoadingMessage('폴더를 선택해주세요...');

      const folderPath = await electronAPI.vault.selectFolder();
      if (!folderPath) {
        setLoading(false);
        return;
      }

      setLoadingMessage('노트 공간 열기 중...');
      const vault = await electronAPI.vault.open(folderPath);

      setLoadingMessage('노트 인덱싱 중...');
      await electronAPI.indexer.indexVault(vault.path, vault.id);

      setLoadingMessage('파일 감시 시작 중...');
      await electronAPI.indexer.startWatching(vault.path, vault.id);

      setLoadingMessage('완료!');

      // Clear loading state before transition
      setLoading(false);
      setLoadingMessage('');

      // Set vault to trigger page transition
      setCurrentVault(vault);
      addRecentVault(vault.path);
    } catch (err: any) {
      setError(err.message || '노트 공간 열기에 실패했습니다');
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleOpenRecentVault = async (vaultPath: string) => {
    try {
      setLoading(true);
      setLoadingMessage('노트 공간 열기 중...');

      const vault = await electronAPI.vault.open(vaultPath);

      setLoadingMessage('노트 인덱싱 중...');
      await electronAPI.indexer.indexVault(vault.path, vault.id);

      setLoadingMessage('파일 감시 시작 중...');
      await electronAPI.indexer.startWatching(vault.path, vault.id);

      setLoadingMessage('완료!');

      // Clear loading state before transition
      setLoading(false);
      setLoadingMessage('');

      // Set vault to trigger page transition
      setCurrentVault(vault);
      addRecentVault(vault.path);
    } catch (err: any) {
      setError(`노트 공간 열기 실패: ${err.message}`);
      setLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="vault-page">
      <div className="vault-header">
        <div className="logo-container">
          <Logo size={80} />
        </div>
        <h1>Rememo</h1>
        <p className="subtitle">기억을 연결하는 지식 그래프</p>
      </div>

      <div className="vault-content">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p className="loading-message">{loadingMessage}</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <div className="vault-actions">
          {!isCreating ? (
            <>
              <button className="btn btn-primary" onClick={() => setIsCreating(true)} disabled={loading}>
                새 노트 공간 만들기
              </button>
              <button className="btn btn-secondary" onClick={handleOpenVault} disabled={loading}>
                기존 노트 공간 열기
              </button>
            </>
          ) : (
            <div className="create-vault-form">
              <h3>새 노트 공간 만들기</h3>
              <input
                type="text"
                placeholder="노트 공간 이름 (예: 내 메모)"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleCreateVault()}
                autoFocus
                disabled={loading}
              />
              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleCreateVault} disabled={loading}>
                  만들기
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setVaultName('');
                  }}
                  disabled={loading}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {recentVaults.length > 0 && !loading && (
          <div className="recent-vaults">
            <h2>최근 노트 공간</h2>
            <ul className="vault-list">
              {recentVaults.map((vaultPath) => (
                <li key={vaultPath} onClick={() => handleOpenRecentVault(vaultPath)}>
                  <div className="vault-item">
                    <span className="vault-path">{vaultPath}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default VaultPage;
