import { useEffect, useRef, useState } from 'react';
import { writeText } from '../services/clipboardService';
import { resolveStatusBarPath } from '../services/settingsService';
import { useSettings } from '../hooks/useSettings';
import { translate } from '../services/i18n';

type StatusBarProps = {
  filePath: string;
  dirty: boolean;
};

type CopyOutcome = 'copied' | 'failed';
type CopyMarker = { path: string; outcome: CopyOutcome } | null;

const COPY_FEEDBACK_RESET_MS = 1200;

export function StatusBar({ filePath, dirty }: StatusBarProps) {
  const settings = useSettings();
  const hasPath = filePath.length > 0;
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.locale, key);
  const displayedPath = hasPath
    ? resolveStatusBarPath(filePath, settings.statusBarPathStyle)
    : t('statusBarNoFileLabel');
  const [copyMarker, setCopyMarker] = useState<CopyMarker>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const scheduleFeedbackReset = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopyMarker(null);
      resetTimerRef.current = null;
    }, COPY_FEEDBACK_RESET_MS);
  };

  const handleDoubleClick = () => {
    if (!hasPath) return;
    void writeText(filePath)
      .then(() => {
        setCopyMarker({ path: filePath, outcome: 'copied' });
      })
      .catch(() => {
        setCopyMarker({ path: filePath, outcome: 'failed' });
      })
      .finally(() => {
        scheduleFeedbackReset();
      });
  };

  const copyState: 'idle' | CopyOutcome =
    copyMarker && copyMarker.path === filePath && hasPath
      ? copyMarker.outcome
      : 'idle';

  return (
    <div className="status-bar" data-status-bar-path-style={settings.statusBarPathStyle}>
      <span
        className="status-path"
        data-copy-state={copyState}
        onDoubleClick={hasPath ? handleDoubleClick : undefined}
        title={hasPath ? t('statusBarPathCopyTitle') : undefined}
        style={
          hasPath ? { cursor: 'text', userSelect: 'text' } : undefined
        }
      >
        {displayedPath}
      </span>
      {copyState !== 'idle' && (
        <span
          className="status-copy-feedback"
          data-copy-state={copyState}
          style={{
            color: copyState === 'copied' ? 'var(--success)' : 'var(--danger)',
            fontWeight: 500,
          }}
        >
          {copyState === 'copied' ? t('statusBarCopySuccess') : t('statusBarCopyFailed')}
        </span>
      )}
      {dirty && <span className="status-dirty">{t('statusBarDirty')}</span>}
    </div>
  );
}
