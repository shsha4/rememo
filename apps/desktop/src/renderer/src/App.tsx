import { useState, useEffect } from 'react';
import VaultPage from './pages/VaultPage';
import EditorPage from './pages/EditorPage';
import GraphPage from './pages/GraphPage';
import SearchPage from './pages/SearchPage';
import TodoPage from './pages/TodoPage';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';
import NavRail from './components/NavRail';
import type { NavPage } from './components/NavRail';
import { useVaultStore } from './stores/vault.store';
import { useIndexAutoRefresh } from './hooks/useIndexAutoRefresh';

function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>('editor');
  const [pageKey, setPageKey] = useState(0);
  const [appKey, setAppKey] = useState(0);
  const { currentVault, loadRecentVaults } = useVaultStore();

  // 외부(Claude Code 등) 파일 변경을 구독해 목록·그래프·열린 노트를 실시간 갱신한다.
  useIndexAutoRefresh();

  useEffect(() => {
    loadRecentVaults();
  }, [loadRecentVaults]);

  useEffect(() => {
    if (currentVault) {
      setCurrentPage('editor');
    }
  }, [currentVault]);

  const handlePageChange = (page: NavPage) => {
    setCurrentPage(page);
    setPageKey((prev) => prev + 1);
  };

  const handleNoteDeleted = () => {
    setAppKey((prev) => prev + 1);
    setPageKey((prev) => prev + 1);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'editor':
        return <EditorPage key={`editor-${appKey}`} onNoteDeleted={handleNoteDeleted} />;
      case 'graph':
        return (
          <GraphPage
            key={`graph-${pageKey}`}
            onNavigateToEditor={() => handlePageChange('editor')}
          />
        );
      case 'search':
        return (
          <SearchPage
            key={`search-${pageKey}`}
            onNavigateToEditor={() => handlePageChange('editor')}
          />
        );
      case 'todo':
        return (
          <TodoPage key={`todo-${pageKey}`} onNavigateToEditor={() => handlePageChange('editor')} />
        );
      case 'settings':
        return <SettingsPage key={`settings-${pageKey}`} />;
      case 'help':
        return <HelpPage key={`help-${pageKey}`} />;
      default:
        return <EditorPage key={`editor-${appKey}`} onNoteDeleted={handleNoteDeleted} />;
    }
  };

  // 볼트를 열기 전에는 레일 없이 볼트 선택 화면만 보여준다.
  if (!currentVault) {
    return (
      <div className="app">
        <VaultPage />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-shell">
        <NavRail currentPage={currentPage} onNavigate={handlePageChange} />
        <div className="app-main">{renderPage()}</div>
      </div>
    </div>
  );
}

export default App;
