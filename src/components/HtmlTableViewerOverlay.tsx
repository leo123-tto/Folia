import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { translate } from '../services/i18n';
import { createHtmlReadingPreviewHtml } from '../services/htmlReadingPreviewService';
import type { HtmlTableBlock } from '../services/htmlTableBlockService';

type HtmlTableViewerOverlayProps = {
  block: HtmlTableBlock;
  onClose: () => void;
};

const ICON_SIZE = 16;
const ICON_STROKE_WIDTH = 1.6;

export function HtmlTableViewerOverlay({ block, onClose }: HtmlTableViewerOverlayProps) {
  const settings = useSettings();
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.locale, key);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const sanitizedHtml = useMemo(() => createHtmlReadingPreviewHtml(block.html), [block.html]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="html-table-viewer-overlay"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className="html-table-viewer-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('htmlTableViewerTitle')}
      >
        <div className="html-table-viewer-header">
          <div className="html-table-viewer-heading">
            <span>{t('htmlTableViewerTitle')}</span>
            <small>{t('htmlTableViewerDesc')}</small>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="html-table-viewer-close"
            onClick={onClose}
            aria-label={t('htmlTableViewerCloseLabel')}
            title={t('htmlTableViewerCloseLabel')}
          >
            <X size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />
          </button>
        </div>
        <div
          className="html-table-viewer-body vditor-reset"
          /* Sanitized by DOMPurify in createHtmlReadingPreviewHtml. */
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
    </div>
  );
}
