import { useState, useEffect } from 'react';
import VaultPage from './pages/VaultPage';
import EditorPage from './pages/EditorPage';
import GraphPage from './pages/GraphPage';
import SearchPage from './pages/SearchPage';
import TodoPage from './pages/TodoPage';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';
import { useVaultStore } from './stores/vault.store';

type Page = 'vault' | 'editor' | 'graph' | 'search' | 'todo' | 'settings' | 'help';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('vault');
  const [pageKey, setPageKey] = useState(0);
  const [appKey, setAppKey] = useState(0);
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

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
    setPageKey((prev) => prev + 1);
  };

  const handleNoteDeleted = () => {
    setAppKey((prev) => prev + 1);
    setPageKey((prev) => prev + 1);
  };

  const renderNavBar = () => {
    if (!currentVault) return null;

    return (
      <div className="app-nav">
        <button
          className={`nav-btn ${currentPage === 'editor' ? 'active' : ''}`}
          onClick={() => handlePageChange('editor')}
        >
          에디터
        </button>
        <button
          className={`nav-btn ${currentPage === 'graph' ? 'active' : ''}`}
          onClick={() => handlePageChange('graph')}
        >
          그래프
        </button>
        <button
          className={`nav-btn ${currentPage === 'search' ? 'active' : ''}`}
          onClick={() => handlePageChange('search')}
        >
          검색
        </button>
        <button
          className={`nav-btn ${currentPage === 'todo' ? 'active' : ''}`}
          onClick={() => handlePageChange('todo')}
        >
          할 일
        </button>
        <button
          className={`nav-btn ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => handlePageChange('settings')}
        >
          설정
        </button>
        <button
          className={`nav-btn ${currentPage === 'help' ? 'active' : ''}`}
          onClick={() => handlePageChange('help')}
        >
          도움말
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
            <EditorPage key={`editor-${appKey}`} onNoteDeleted={handleNoteDeleted} />
          </>
        );
      case 'graph':
        return (
          <>
            {renderNavBar()}
            <GraphPage
              key={`graph-${pageKey}`}
              onNavigateToEditor={() => handlePageChange('editor')}
            />
          </>
        );
      case 'search':
        return (
          <>
            {renderNavBar()}
            <SearchPage
              key={`search-${pageKey}`}
              onNavigateToEditor={() => handlePageChange('editor')}
            />
          </>
        );
      case 'todo':
        return (
          <>
            {renderNavBar()}
            <TodoPage
              key={`todo-${pageKey}`}
              onNavigateToEditor={() => handlePageChange('editor')}
            />
          </>
        );
      case 'settings':
        return (
          <>
            {renderNavBar()}
            <SettingsPage key={`settings-${pageKey}`} />
          </>
        );
      case 'help':
        return (
          <>
            {renderNavBar()}
            <HelpPage key={`help-${pageKey}`} />
          </>
        );
      default:
        return <VaultPage />;
    }
  };

  return <div className="app">{renderPage()}</div>;
}

export default App;
