import { useDeferredValue, useEffect, useMemo, useRef } from 'react';
import '../styles/preview.css';
import type { TocItem } from '../types/document';
import { useSettings } from '../hooks/useSettings';
import { detectMarkdownRenderFeatures } from '../services/markdownFeatureDetector';
import { resolvePreviewFontFamily } from '../services/settingsService';
import { VDITOR_PREVIEW_I18N } from '../services/vditorPreviewConfig';

type PreviewPaneProps = {
  source: string;
  tocIds: TocItem[];
  wideTables?: boolean;
};

export function PreviewPane({ source, tocIds, wideTables = false }: PreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const deferredSource = useDeferredValue(source);
  const deferredTocIds = useDeferredValue(tocIds);
  const settings = useSettings();
  const renderFeatures = useMemo(
    () => detectMarkdownRenderFeatures(deferredSource),
    [deferredSource],
  );
  const previewFontFamily = resolvePreviewFontFamily(settings.previewFontFamily);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (deferredSource.trim() === '') {
      el.replaceChildren();
      return;
    }

    let cancelled = false;
    void Promise.all([
      import('vditor/dist/index.css'),
      import('vditor'),
    ]).then(([, { default: Vditor }]) => {
      if (cancelled) return;
      Vditor.preview(el, deferredSource, {
        mode: 'light',
        anchor: 0,
        cdn: '/vditor',
        i18n: VDITOR_PREVIEW_I18N,
        icon: undefined,
        theme: {
          current: 'light',
          path: '',
        },
        hljs: {
          style: 'github',
          enable: renderFeatures.hasHighlightableCode,
          lineNumber: false,
        },
        markdown: {
          sanitize: true,
        },
        after() {
          if (cancelled || deferredTocIds.length === 0) return;
          const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
          headings.forEach((h, i) => {
            const tocItem = deferredTocIds[i];
            if (tocItem) {
              h.id = tocItem.id;
            }
          });
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [deferredSource, deferredTocIds, renderFeatures.hasHighlightableCode]);

  return (
    <div
      className={`preview-shell ${wideTables ? 'html-preview-pane' : ''}`}
      aria-label={wideTables ? 'HTML 阅读预览' : 'Markdown 阅读预览'}
      style={{
        '--preview-font-size': `${settings.previewFontSize}px`,
        '--preview-line-height': `${settings.previewLineHeight}`,
        '--preview-width': `${settings.previewWidth}px`,
        '--preview-font-family': previewFontFamily,
      } as React.CSSProperties}
    >
      <div
        ref={containerRef}
        className={`vditor-reset preview-content ${wideTables ? 'html-table-preview-content' : ''}`}
      />
    </div>
  );
}
