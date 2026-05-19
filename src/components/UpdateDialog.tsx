import { Download, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import {
  installAppUpdate,
  type UpdateCheckResult,
  type UpdateProgress,
  type UpdateSource,
} from '../services/updateService';

type AvailableUpdate = Extract<UpdateCheckResult, { status: 'available' }>;

type UpdateDialogProps = {
  update: AvailableUpdate;
  source: UpdateSource;
  onClose: () => void;
};

function progressText(progress: UpdateProgress | null): string {
  if (!progress) return '准备下载更新包';
  if (progress.status === 'installing') return '正在安装更新';
  if (progress.status === 'relaunching') return '正在重启应用';
  if (progress.percent !== undefined) return `正在下载 ${progress.percent}%`;
  return '正在下载更新包';
}

export function UpdateDialog({ update, source, onClose }: UpdateDialogProps) {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState('');

  const handleInstall = async () => {
    setInstalling(true);
    setError('');
    try {
      await installAppUpdate(update.update, setProgress);
    } catch (e) {
      setInstalling(false);
      setError(e instanceof Error ? e.message : '安装更新失败');
    }
  };

  return (
    <div className="update-dialog-overlay" role="presentation" onMouseDown={installing ? undefined : onClose}>
      <section
        className="update-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="update-dialog-close"
          onClick={onClose}
          disabled={installing}
          aria-label="关闭更新提示"
        >
          <X size={15} />
        </button>

        <div className="update-dialog-icon">
          {installing ? <RefreshCw size={21} className="spinning" /> : <Download size={21} />}
        </div>

        <div className="update-dialog-copy">
          <div className="update-dialog-kicker">{source === 'auto' ? '自动检查更新' : '手动检查更新'}</div>
          <h3 id="update-dialog-title">发现新版本 {update.version}</h3>
          {update.body ? (
            <p>{update.body}</p>
          ) : (
            <p>可以现在安装并重启，也可以稍后在设置里重新检查。</p>
          )}
          {installing && (
            <div className="update-progress">
              <div className="update-progress-track">
                <span style={{ width: `${progress?.percent ?? 12}%` }} />
              </div>
              <span>{progressText(progress)}</span>
            </div>
          )}
          {error && <div className="update-error">{error}</div>}
        </div>

        <div className="update-dialog-actions">
          <button type="button" className="secondary-action-button" onClick={onClose} disabled={installing}>
            稍后
          </button>
          <button type="button" className="primary-action-button" onClick={handleInstall} disabled={installing}>
            {installing ? '安装中' : '安装并重启'}
          </button>
        </div>
      </section>
    </div>
  );
}
