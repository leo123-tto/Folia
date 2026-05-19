import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSettings, updateSettings, type AppSettings } from '../../services/settingsService';
import {
  checkForAppUpdate,
  getCurrentAppVersion,
  type UpdateCheckResult,
} from '../../services/updateService';

type AvailableUpdate = Extract<UpdateCheckResult, { status: 'available' }>;

type AboutSectionProps = {
  onUpdateAvailable: (update: AvailableUpdate) => void;
};

type CheckState = 'idle' | 'checking' | 'latest' | 'available' | 'unsupported' | 'error';

export function AboutSection({ onUpdateAvailable }: AboutSectionProps) {
  const [settings, setSettings] = useState(() => getSettings());
  const [version, setVersion] = useState('0.1.0');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [message, setMessage] = useState('自动检查会在启动后延迟进行，不影响打开速度。');

  useEffect(() => {
    void getCurrentAppVersion().then(setVersion);
  }, []);

  const handleChange = (patch: Partial<AppSettings>) => {
    updateSettings(patch);
    setSettings(getSettings());
  };

  const handleCheckUpdate = async () => {
    setCheckState('checking');
    setMessage('正在检查 GitHub Releases 更新...');

    const result = await checkForAppUpdate();
    if (result.status === 'available') {
      setCheckState('available');
      setMessage(`发现新版本 ${result.version}`);
      onUpdateAvailable(result);
      return;
    }

    if (result.status === 'not-available') {
      setCheckState('latest');
      setMessage('当前已经是最新版本。');
      return;
    }

    if (result.status === 'unsupported') {
      setCheckState('unsupported');
      setMessage('浏览器开发预览中不检查更新，打包后的桌面应用会启用。');
      return;
    }

    setCheckState('error');
    setMessage(result.message || '检查更新失败，请稍后再试。');
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">关于</h3>

      <div className="settings-row">
        <div>
          <div className="settings-label">版本</div>
          <div className="settings-desc">Folia {version}</div>
        </div>
        <span className="settings-value">轻量 Markdown 阅读器</span>
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-label">自动检查更新</div>
          <div className="settings-desc">启动后延迟检查，不进入冷启动路径</div>
        </div>
        <button
          className={`toggle-switch ${settings.autoUpdateCheck ? 'on' : ''}`}
          onClick={() => handleChange({ autoUpdateCheck: !settings.autoUpdateCheck })}
          aria-label="自动检查更新"
        />
      </div>

      <div className="settings-row settings-row-stacked">
        <div>
          <div className="settings-label">软件更新</div>
          <div className={`settings-desc update-check-message ${checkState}`}>{message}</div>
        </div>
        <button
          type="button"
          className="settings-action-button"
          onClick={handleCheckUpdate}
          disabled={checkState === 'checking'}
        >
          <RefreshCw size={14} className={checkState === 'checking' ? 'spinning' : ''} />
          {checkState === 'checking' ? '检查中' : '检查更新'}
        </button>
      </div>

      <div className="about-links">
        <div className="about-link-row">
          <span className="about-link-label">更新源</span>
          <span className="about-value">GitHub Releases</span>
        </div>
        <div className="about-link-row">
          <span className="about-link-label">项目地址</span>
          <a href="https://github.com/cat-xierluo/Folia" target="_blank" rel="noreferrer">
            github.com/cat-xierluo/Folia
          </a>
        </div>
      </div>
    </div>
  );
}
