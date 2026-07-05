import { useState, useEffect } from 'react';
import VaultPage from './pages/VaultPage';
import EditorPage from './pages/EditorPage';
import GraphPage from './pages/GraphPage';
import SearchPage from './pages/SearchPage';
import { useVaultStore } from './stores/vault.store';

type Page = 'vault' | 'editor' | 'graph' | 'search';

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

  const renderNavBar = () => {
    if (!currentVault) return null;

    return (
      <div className="app-nav">
        <button
          className={`nav-btn ${currentPage === 'editor' ? 'active' : ''}`}
          onClick={() => setCurrentPage('editor')}
        >
          Editor
        </button>
        <button
          className={`nav-btn ${currentPage === 'graph' ? 'active' : ''}`}
          onClick={() => setCurrentPage('graph')}
        >
          Graph
        </button>
        <button
          className={`nav-btn ${currentPage === 'search' ? 'active' : ''}`}
          onClick={() => setCurrentPage('search')}
        >
          Search
        </button>
      </div>
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'vault':
        return <VaultPage />;
      case 'editor':
        return (
          <>
            {renderNavBar()}
            <EditorPage />
          </>
        );
      case 'graph':
        return (
          <>
            {renderNavBar()}
            <GraphPage />
          </>
        );
      case 'search':
        return (
          <>
            {renderNavBar()}
            <SearchPage />
          </>
        );
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
