import { useState, useEffect } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import './SearchPage.css';

type SearchMode = 'fulltext' | 'tags';

interface SearchResult {
  id: string;
  title: string;
  path: string;
  content: string;
  rank?: number;
}

interface SearchPageProps {
  onNavigateToEditor: () => void;
}

function SearchPage({ onNavigateToEditor }: SearchPageProps) {
  const { currentVault } = useVaultStore();
  const { setCurrentNote } = useNoteStore();
  const [searchMode, setSearchMode] = useState<SearchMode>('fulltext');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentVault) {
      loadTags();
    }
  }, [currentVault]);

  const loadTags = async () => {
    if (!currentVault) return;

    try {
      const allTags = await electronAPI.indexer.getAllTags(currentVault.path);
      setTags(allTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleSearch = async () => {
    if (!currentVault || !query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      let searchResults: any[] = [];

      if (searchMode === 'fulltext') {
        searchResults = await electronAPI.indexer.searchNotes(currentVault.path, query.trim());
      } else if (searchMode === 'tags') {
        const tagQuery = query.trim().startsWith('#') ? query.trim().substring(1) : query.trim();
        searchResults = await electronAPI.indexer.searchByTag(currentVault.path, tagQuery);
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = async (tag: string) => {
    if (!currentVault) return;

    setSearchMode('tags');
    setQuery(tag);

    // Directly search with the tag without waiting for state update
    setLoading(true);
    try {
      const searchResults = await electronAPI.indexer.searchByTag(currentVault.path, tag);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = async (result: SearchResult) => {
    if (!currentVault) return;

    try {
      // Load the note
      const note = await electronAPI.note.read(result.path, currentVault.id);
      setCurrentNote(note);
      onNavigateToEditor();
    } catch (error) {
      console.error('Failed to load note:', error);
      alert('Failed to load note');
    }
  };

  return (
    <div className="search-page">
      <div className="search-header">
        <h2>검색</h2>
      </div>

      <div className="search-controls">
        <div className="search-mode-selector">
          <button
            className={`mode-btn ${searchMode === 'fulltext' ? 'active' : ''}`}
            onClick={() => setSearchMode('fulltext')}
          >
            전체 검색
          </button>
          <button
            className={`mode-btn ${searchMode === 'tags' ? 'active' : ''}`}
            onClick={() => setSearchMode('tags')}
          >
            태그 검색
          </button>
        </div>

        <div className="search-input-group">
          <input
            type="text"
            className="search-input"
            placeholder={
              searchMode === 'fulltext'
                ? '메모 검색...'
                : '태그로 검색...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn-search" onClick={handleSearch}>
            검색
          </button>
        </div>
      </div>

      {searchMode === 'tags' && tags.length > 0 && (
        <div className="tags-section">
          <h3>모든 태그 ({tags.length})</h3>
          <div className="tags-list">
            {tags.map((tag, index) => (
              <button
                key={index}
                className="tag-button"
                onClick={() => handleTagClick(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="search-results">
        {loading ? (
          <div className="results-loading">검색 중...</div>
        ) : query && results.length === 0 ? (
          <div className="results-empty">검색 결과가 없습니다</div>
        ) : (
          <div className="results-list">
            {results.map((result, index) => (
              <div
                key={index}
                className="result-item"
                onClick={() => handleResultClick(result)}
              >
                <div className="result-title">{result.title}</div>
                <div className="result-path">{result.path}</div>
                {result.content && (
                  <div className="result-preview">
                    {result.content.substring(0, 200)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
