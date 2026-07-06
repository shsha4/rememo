import { useState } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import type { NotificationSettings } from '../types';
import './SettingsPage.css';

const DEFAULT_SETTINGS: NotificationSettings = { enabled: true, defaultTime: '09:00' };

function SettingsPage() {
  const { currentVault, setCurrentVault } = useVaultStore();
  const initial = currentVault?.config.notifications ?? DEFAULT_SETTINGS;

  const [enabled, setEnabled] = useState(initial.enabled);
  const [defaultTime, setDefaultTime] = useState(initial.defaultTime);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const handleSave = async () => {
    if (!currentVault) return;
    setSaving(true);
    try {
      const settings: NotificationSettings = { enabled, defaultTime };
      await electronAPI.todo.updateSettings(currentVault.path, settings);

      // 스토어의 currentVault도 갱신해 화면 상태를 일치시킨다.
      setCurrentVault({
        ...currentVault,
        config: { ...currentVault.config, notifications: settings },
      });
      setSavedAt(new Date().toLocaleTimeString('ko-KR'));
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('설정 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>설정</h2>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h3>할 일 마감 알림</h3>

          <div className="setting-row">
            <div className="setting-label">
              <span className="setting-title">마감 알림 켜기</span>
              <span className="setting-desc">
                마감일이 있는 할 일을 마감일 당일 지정한 시각에 알려줍니다. (마감일이 없는 할 일은
                알림이 오지 않습니다.)
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          <div className={`setting-row ${enabled ? '' : 'disabled'}`}>
            <div className="setting-label">
              <span className="setting-title">기본 알림 시각</span>
              <span className="setting-desc">
                시각을 적지 않은 할 일(날짜만 있는 경우)은 마감일 당일 이 시각에 알립니다. 시각을
                적은 할 일은 그 시각에 알립니다.
              </span>
            </div>
            <input
              type="time"
              className="time-input"
              value={defaultTime}
              disabled={!enabled}
              onChange={(e) => setDefaultTime(e.target.value)}
            />
          </div>
        </section>

        <div className="settings-actions">
          <button className="btn-save-settings" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
          {savedAt && <span className="settings-saved">{savedAt}에 저장됨</span>}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
