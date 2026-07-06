import { useState, useEffect } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import './Backlinks.css';

interface BacklinkItem {
  backlink_path: string;
  link_text: string;
  alias?: string;
  heading?: string;
}

interface BacklinksProps {
  notePath: string;
}

function Backlinks({ notePath }: BacklinksProps) {
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentVault } = useVaultStore();

  useEffect(() => {
    if (!currentVault || !notePath) {
      setBacklinks([]);
      return;
    }

    loadBacklinks();
  }, [currentVault, notePath]);

  const loadBacklinks = async () => {
    if (!currentVault) return;

    setLoading(true);
    try {
      const results = await electronAPI.indexer.getBacklinks({
        vaultPath: currentVault.path,
        notePath,
      });
      setBacklinks(results || []);
    } catch (error) {
      console.error('Failed to load backlinks:', error);
      setBacklinks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBacklinkClick = async (backlinkPath: string) => {
    // TODO: Implement navigation to the backlink note
    console.log('Navigate to:', backlinkPath);
  };

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        <h3>Backlinks</h3>
        <span className="backlink-count">{backlinks.length}</span>
      </div>

      {loading ? (
        <div className="backlinks-loading">Loading backlinks...</div>
      ) : backlinks.length === 0 ? (
        <div className="backlinks-empty">No backlinks found</div>
      ) : (
        <div className="backlinks-list">
          {backlinks.map((backlink, index) => (
            <div
              key={index}
              className="backlink-item"
              onClick={() => handleBacklinkClick(backlink.backlink_path)}
            >
              <div className="backlink-title">{backlink.alias || backlink.link_text}</div>
              {backlink.heading && <div className="backlink-heading">#{backlink.heading}</div>}
              <div className="backlink-path">{backlink.backlink_path}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Backlinks;
