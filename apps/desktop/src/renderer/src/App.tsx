import { useState, useEffect } from 'react';
import VaultPage from './pages/VaultPage';
import EditorPage from './pages/EditorPage';
import { useVaultStore } from './stores/vault.store';

type Page = 'vault' | 'editor' | 'graph' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('vault');
  const { currentVault, loadRecentVaults } = useVaultStore();

  useEffect(() => {
    loadRecentVaults();
  }, [loadRecentVaults]);

  useEffect(() => {
    if (currentVault) {
      setCurrentPage('editor');
    } else {
      setCurrentPage('vault');
    }
  }, [currentVault]);

  const renderPage = () => {
    switch (currentPage) {
      case 'vault':
        return <VaultPage />;
      case 'editor':
        return <EditorPage />;
      default:
        return <VaultPage />;
    }
  };

  return (
    <div className="app">
      {renderPage()}
    </div>
  );
}

export default App;
