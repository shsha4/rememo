import { useState, useEffect } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import './VaultPage.css';

function VaultPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [error, setError] = useState('');
  const { setCurrentVault, recentVaults, addRecentVault } = useVaultStore();

  const handleCreateVault = async () => {
    if (!vaultName.trim()) {
      setError('Please enter a vault name');
      return;
    }

    try {
      const folderPath = await electronAPI.vault.selectFolder();
      if (!folderPath) {
        return;
      }

      const vault = await electronAPI.vault.create(folderPath, vaultName.trim());
      setCurrentVault(vault);
      addRecentVault(vault.path);
    } catch (err: any) {
      setError(err.message || 'Failed to create vault');
    }
  };

  const handleOpenVault = async () => {
    try {
      const folderPath = await electronAPI.vault.selectFolder();
      if (!folderPath) {
        return;
      }

      const vault = await electronAPI.vault.open(folderPath);
      setCurrentVault(vault);
      addRecentVault(vault.path);
    } catch (err: any) {
      setError(err.message || 'Failed to open vault');
    }
  };

  const handleOpenRecentVault = async (vaultPath: string) => {
    try {
      const vault = await electronAPI.vault.open(vaultPath);
      setCurrentVault(vault);
      addRecentVault(vault.path);
    } catch (err: any) {
      setError(`Failed to open vault: ${err.message}`);
    }
  };

  return (
    <div className="vault-page">
      <div className="vault-header">
        <h1>MemoGraph</h1>
        <p className="subtitle">Local-first Markdown Knowledge Graph</p>
      </div>

      <div className="vault-content">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <div className="vault-actions">
          {!isCreating ? (
            <>
              <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
                Create New Vault
              </button>
              <button className="btn btn-secondary" onClick={handleOpenVault}>
                Open Existing Vault
              </button>
            </>
          ) : (
            <div className="create-vault-form">
              <h3>Create New Vault</h3>
              <input
                type="text"
                placeholder="Vault name"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateVault()}
                autoFocus
              />
              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleCreateVault}>
                  Create
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setVaultName('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {recentVaults.length > 0 && (
          <div className="recent-vaults">
            <h2>Recent Vaults</h2>
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
