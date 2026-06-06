import { useState } from 'react';
import {
  getSettings,
  STATUS_BAR_PATH_STYLES,
  updateSettings,
  type AppSettings,
  type StatusBarPathStyle,
} from '../../services/settingsService';
import { translate } from '../../services/i18n';

const ZOOM_LEVELS = [80, 90, 100, 110, 120];

export function AppearanceSection() {
  const [settings, setSettings] = useState(() => getSettings());
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.locale, key);

  const handleChange = (patch: Partial<AppSettings>) => {
    updateSettings(patch);
    setSettings(getSettings());
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">外观</h3>

      <div className="settings-row">
        <div>
          <div className="settings-label">主题</div>
        </div>
        <select
          className="settings-select"
          value={settings.theme}
          onChange={(e) => handleChange({ theme: e.target.value as AppSettings['theme'] })}
        >
          <option value="light">亮色</option>
          <option value="dark">暗色</option>
        </select>
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-label">界面缩放</div>
        </div>
        <select
          className="settings-select"
          value={settings.zoomLevel}
          onChange={(e) => handleChange({ zoomLevel: Number(e.target.value) })}
        >
          {ZOOM_LEVELS.map((z) => (
            <option key={z} value={z}>{z}%</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-label">{t('statusBarPathLabel')}</div>
          <div className="settings-desc">{t('statusBarPathDesc')}</div>
        </div>
        <select
          className="settings-select"
          aria-label={t('statusBarPathLabel')}
          value={settings.statusBarPathStyle}
          onChange={(e) => handleChange({ statusBarPathStyle: e.target.value as StatusBarPathStyle })}
        >
          {STATUS_BAR_PATH_STYLES.map((style) => {
            const labelKey = (
              {
                full: 'statusBarPathStyleFull',
                basename: 'statusBarPathStyleBasename',
                middle: 'statusBarPathStyleMiddle',
              } as const
            )[style];
            return (
              <option key={style} value={style}>{t(labelKey)}</option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
