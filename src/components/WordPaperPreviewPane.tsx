import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FileOutput, X } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { detectMarkdownRenderFeatures } from '../services/markdownFeatureDetector';
import { setExportPreset } from '../services/settingsService';
import { VDITOR_PREVIEW_I18N } from '../services/vditorPreviewConfig';
import { getPreset, listPresets } from '../services/word/config';
import { createWordPreviewStyle } from '../services/wordPreviewStyle';
import type { PresetId } from '../services/word';

type WordPaperPreviewPaneProps = {
  source: string;
  previewWidth: number;
  canExport: boolean;
  onExportWord: () => void;
  onClose: () => void;
};

const CSS_PX_PER_CM = 96 / 2.54;
const PREVIEW_HORIZONTAL_PADDING = 56;

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}

function makePage(container: HTMLDivElement, pageNumber: number): HTMLDivElement {
  const shell = document.createElement('section');
  shell.className = 'word-page-shell';
  shell.setAttribute('aria-label', `第 ${pageNumber} 页`);

  const label = document.createElement('div');
  label.className = 'word-page-label';
  label.textContent = `第 ${pageNumber} 页`;

  const viewport = document.createElement('div');
  viewport.className = 'word-page-viewport';

  const frame = document.createElement('div');
  frame.className = 'word-page-frame';

  const paper = document.createElement('div');
  paper.className = 'word-paper word-rendered-paper';

  const content = document.createElement('div');
  content.className = 'vditor-reset word-paper-content';

  paper.append(content);
  frame.append(paper);
  viewport.append(frame);
  shell.append(label, viewport);
  container.append(shell);

  return content;
}

function paginateRenderedContent(measureContent: HTMLDivElement, pagesContainer: HTMLDivElement, contentHeight: number): void {
  pagesContainer.replaceChildren();

  if (measureContent.children.length === 0) {
    makePage(pagesContainer, 1);
    return;
  }

  let pageNumber = 1;
  let currentPage = makePage(pagesContainer, pageNumber);

  Array.from(measureContent.children).forEach((child) => {
    const clone = child.cloneNode(true);
    currentPage.append(clone);

    if (currentPage.children.length > 1 && currentPage.scrollHeight > contentHeight) {
      clone.parentNode?.removeChild(clone);
      pageNumber += 1;
      currentPage = makePage(pagesContainer, pageNumber);
      currentPage.append(clone);
    }
  });
}

export function WordPaperPreviewPane({
  source,
  previewWidth,
  canExport,
  onExportWord,
  onClose,
}: WordPaperPreviewPaneProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const settings = useSettings();
  const debouncedSource = useDebouncedValue(source, 260);
  const deferredSource = useDeferredValue(debouncedSource);
  const renderFeatures = useMemo(
    () => detectMarkdownRenderFeatures(deferredSource),
    [deferredSource],
  );
  const preset = useMemo(
    () => getPreset(settings.exportPresetId, settings.customExportPresets),
    [settings.customExportPresets, settings.exportPresetId],
  );
  const presets = useMemo(
    () => listPresets(settings.customExportPresets),
    [settings.customExportPresets],
  );
  const style = useMemo(() => {
    const pageWidthPx = preset.page.width * CSS_PX_PER_CM;
    const pageHeightPx = preset.page.height * CSS_PX_PER_CM;
    const contentHeightPx = Math.max(
      120,
      (preset.page.height - preset.page.margin_top - preset.page.margin_bottom) * CSS_PX_PER_CM,
    );
    const availableWidth = Math.max(320, previewWidth - PREVIEW_HORIZONTAL_PADDING);
    const scale = Math.min(1, Math.max(0.42, availableWidth / pageWidthPx));
    return {
      ...createWordPreviewStyle(preset),
      '--word-preview-scale': scale.toFixed(3),
      '--word-page-width-px': `${pageWidthPx}px`,
      '--word-page-height-px': `${pageHeightPx}px`,
      '--word-page-scaled-width': `${pageWidthPx * scale}px`,
      '--word-page-scaled-height': `${pageHeightPx * scale}px`,
      '--word-page-content-height': `${contentHeightPx}px`,
    };
  }, [preset, previewWidth]);

  useEffect(() => {
    const measureEl = measureRef.current;
    const pagesEl = pagesRef.current;
    if (!measureEl || !pagesEl) return;

    if (deferredSource.trim() === '') {
      measureEl.replaceChildren();
      pagesEl.replaceChildren();
      makePage(pagesEl, 1);
      return;
    }

    let cancelled = false;
    void Promise.all([
      import('vditor/dist/index.css'),
      import('vditor'),
    ]).then(async ([, { default: Vditor }]) => {
      if (cancelled || !measureRef.current || !pagesRef.current) return;
      await Vditor.preview(measureRef.current, deferredSource, {
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
      });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (cancelled || !measureRef.current || !pagesRef.current) return;
          const contentHeight = Number.parseFloat(String(style['--word-page-content-height'])) || 900;
          paginateRenderedContent(measureRef.current, pagesRef.current, contentHeight);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [deferredSource, renderFeatures.hasHighlightableCode, style]);

  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setExportPreset(event.currentTarget.value as PresetId);
  };

  return (
    <aside className="word-preview-panel" aria-label="Word 预览">
      <div className="word-preview-header">
        <select
          className="word-preview-preset-select"
          aria-label="Word 导出预设"
          value={settings.exportPresetId}
          onChange={handlePresetChange}
        >
          {presets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="word-preview-export-button"
          onClick={onExportWord}
          disabled={!canExport}
          title="导出 Word (Cmd+Shift+E)"
          aria-label="导出 Word"
        >
          <FileOutput size={15} />
          导出 Word
        </button>
        <button type="button" className="word-preview-close-button" onClick={onClose} title="关闭" aria-label="关闭预览">
          <X size={15} />
        </button>
      </div>
      <div className="word-preview-scroll">
        <div className="word-preview-stage" style={style as React.CSSProperties}>
          <div ref={pagesRef} className="word-preview-pages" />
          <div className="word-preview-measure word-paper" aria-hidden="true">
            <div ref={measureRef} className="vditor-reset word-paper-content" />
          </div>
        </div>
      </div>
    </aside>
  );
}
