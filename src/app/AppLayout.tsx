import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OpenedFile, TocItem } from '../types/document';
import { createEmptyFile } from '../types/document';
import { getExportPresetConfig, getLastOpenedPath, setLastOpenedPath } from '../services/settingsService';
import { firstOpenableDocumentPath, isOpenableDocumentPath } from '../services/fileDrop';
import { prefersStableHtmlPreview } from '../services/documentViewMode';
import { useSettings } from '../hooks/useSettings';
import { checkForAppUpdate, type UpdateCheckResult, type UpdateSource } from '../services/updateService';
import { Toolbar, type EditorMode } from '../components/Toolbar';
import { StatusBar } from '../components/StatusBar';
import { UpdateDialog } from '../components/UpdateDialog';

const EditorPane = lazy(() =>
  import('../components/EditorPane').then((module) => ({ default: module.EditorPane })),
);

const WysiwygEditorPane = lazy(() =>
  import('../components/WysiwygEditorPane').then((module) => ({ default: module.WysiwygEditorPane })),
);

const PreviewPane = lazy(() =>
  import('../components/PreviewPane').then((module) => ({ default: module.PreviewPane })),
);

const SettingsPage = lazy(() =>
  import('../components/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);

const DocxPreviewPane = lazy(() =>
  import('../components/DocxPreviewPane').then((module) => ({ default: module.DocxPreviewPane })),
);

const WordPaperPreviewPane = lazy(() =>
  import('../components/WordPaperPreviewPane').then((module) => ({ default: module.WordPaperPreviewPane })),
);

type AvailableUpdate = Extract<UpdateCheckResult, { status: 'available' }>;

function extractToc(content: string): TocItem[] {
  const headings: TocItem[] = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = `toc-${idx++}`;
    headings.push({ level, text, id });
  }
  return headings;
}

export function AppLayout() {
  const settings = useSettings();
  const reopenAttempted = useRef(false);
  const autoUpdateCheckStarted = useRef(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<OpenedFile>(createEmptyFile());
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocVisible, setTocVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('wysiwyg');
  const [wordPreviewVisible, setWordPreviewVisible] = useState(false);
  const [wordPreviewWidth, setWordPreviewWidth] = useState(460);
  const [resizing, setResizing] = useState(false);
  const [updateDialog, setUpdateDialog] = useState<{ source: UpdateSource; update: AvailableUpdate } | null>(null);

  const handleOpen = useCallback(async () => {
    const { openFile } = await import('../services/fileService');
    const opened = await openFile(settings.defaultEncoding);
    if (opened) {
      setFile(opened);
      setToc(extractToc(opened.content));
      if (opened.path) setLastOpenedPath(opened.path);
      if (opened.fileType === 'docx') {
        setWordPreviewVisible(false);
      } else {
        setEditorMode('wysiwyg');
      }
    }
  }, [settings.defaultEncoding]);

  const handleOpenPath = useCallback(async (path: string) => {
    const { openPath } = await import('../services/fileService');
    const opened = await openPath(path, settings.defaultEncoding);
    setFile(opened);
    setToc(opened.fileType === 'docx' ? [] : extractToc(opened.content));
    setLastOpenedPath(path);
    if (opened.fileType === 'docx') {
      setWordPreviewVisible(false);
    } else {
      setEditorMode('wysiwyg');
    }
  }, [settings.defaultEncoding]);

  const handleSave = useCallback(async () => {
    if (file.fileType === 'docx') return;
    const { saveFile } = await import('../services/fileService');
    const updated = await saveFile(file);
    setFile(updated);
    if (updated.path) setLastOpenedPath(updated.path);
  }, [file]);

  const handleSaveAs = useCallback(async () => {
    if (file.fileType === 'docx') return;
    const { saveFileAs } = await import('../services/fileService');
    const updated = await saveFileAs(file);
    setFile(updated);
    if (updated.path) setLastOpenedPath(updated.path);
  }, [file]);

  const handleExportWord = useCallback(async () => {
    if (!file.path || file.fileType === 'docx') return;
    try {
      const { exportToWord } = await import('../services/wordExportService');
      await exportToWord(file.content, file.name, getExportPresetConfig());
    } catch (e) {
      console.error('Export failed:', e);
    }
  }, [file]);

  const handleContentChange = useCallback((value: string) => {
    setFile(prev => ({
      ...prev,
      content: value,
      dirty: value !== prev.lastSavedContent,
    }));
    setToc(extractToc(value));
  }, []);

  const handleToggleEditorMode = useCallback(() => {
    if (file.fileType === 'docx') return;
    setEditorMode((mode) => mode === 'source' ? 'wysiwyg' : 'source');
  }, [file.fileType]);

  const handleToggleWordPreview = useCallback(() => {
    if (file.fileType === 'docx') return;
    setWordPreviewVisible((visible) => !visible);
  }, [file.fileType]);

  const handleWordPreviewResizerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const container = mainContentRef.current;
    if (!container) return;

    event.preventDefault();
    setResizing(true);

    const updateWidth = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const maxWidth = Math.min(760, Math.round(rect.width * 0.62));
      const nextWidth = rect.right - clientX;
      setWordPreviewWidth(Math.min(maxWidth, Math.max(360, nextWidth)));
    };

    updateWidth(event.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateWidth(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      setResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'o') { e.preventDefault(); handleOpen(); }
      if (mod && e.key === 's' && !e.shiftKey) { e.preventDefault(); handleSave(); }
      if (mod && e.key === 's' && e.shiftKey) { e.preventDefault(); handleSaveAs(); }
      if (mod && e.shiftKey && e.key === 'E') { e.preventDefault(); handleExportWord(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleOpen, handleSave, handleSaveAs, handleExportWord]);

  useEffect(() => {
    const handler = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const items = e.dataTransfer?.files;
      if (!items || items.length === 0) return;
      const f = items[0];
      const path = (f as unknown as { path?: string }).path;
      if (path && isOpenableDocumentPath(path)) await handleOpenPath(path);
    };
    const prevent = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', handler);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', handler);
    };
  }, [handleOpenPath]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().onDragDropEvent((event) => {
        if (event.payload.type !== 'drop') return;
        const path = firstOpenableDocumentPath(event.payload.paths);
        if (path) void handleOpenPath(path);
      }))
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((e) => console.warn('Failed to bind Tauri file drop:', e));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [handleOpenPath]);

  useEffect(() => {
    if (!settings.reopenLastFile || file.path || reopenAttempted.current) return;
    const lastPath = getLastOpenedPath();
    if (!lastPath) return;
    reopenAttempted.current = true;
    let idleId: number | undefined;
    const timeout = window.setTimeout(() => {
      const reopen = () => {
        void handleOpenPath(lastPath).catch((e) => {
          console.warn('Failed to reopen last file:', e);
        });
      };

      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(reopen, { timeout: 1500 });
      } else {
        reopen();
      }
    }, 700);

    return () => {
      window.clearTimeout(timeout);
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [file.path, handleOpenPath, settings.reopenLastFile]);

  useEffect(() => {
    if (!settings.autoUpdateCheck || autoUpdateCheckStarted.current || !('__TAURI_INTERNALS__' in window)) return;
    autoUpdateCheckStarted.current = true;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void checkForAppUpdate().then((result) => {
        if (!cancelled && result.status === 'available') {
          setUpdateDialog({ source: 'auto', update: result });
        }
      });
    }, 2600);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [settings.autoUpdateCheck]);

  useEffect(() => {
    if (!settings.autoSave || !file.path || !file.dirty || file.fileType === 'docx') return;
    const timeout = window.setTimeout(() => {
      void import('../services/fileService')
        .then(({ saveFile }) => saveFile(file))
        .then((updated) => setFile(updated))
        .catch((e) => console.error('Auto-save failed:', e));
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [file, settings.autoSave]);

  const tocPane = useMemo(() => {
    if (!tocVisible || toc.length === 0) return null;
    return (
      <div className="toc-pane">
        <div className="toc-header">大纲</div>
        <nav className="toc-list">
          {toc.map((item, i) => (
            <a
              key={i}
              className={`toc-item toc-h${item.level}`}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
    );
  }, [toc, tocVisible]);

  const isDocx = file.fileType === 'docx';
  const shouldUseStableHtmlPreview = prefersStableHtmlPreview(file.content, file.fileType);
  const mainContentClassName = [
    'main-content',
    isDocx ? 'docx-layout' : 'writing-layout',
    shouldUseStableHtmlPreview && !isDocx ? 'html-reading-layout' : '',
    wordPreviewVisible && !isDocx ? 'word-preview-open' : '',
    resizing ? 'is-resizing' : '',
  ].filter(Boolean).join(' ');

  const editorPane = isDocx ? (
    <div className="editor-pane readonly-pane">
      <span>Word 文件为只读</span>
    </div>
  ) : editorMode === 'source' ? (
    <Suspense fallback={<div className="editor-pane lazy-pane"><span>源码编辑器加载中</span></div>}>
      <EditorPane source={file.content} onChange={handleContentChange} />
    </Suspense>
  ) : shouldUseStableHtmlPreview ? (
    <Suspense fallback={<div className="preview-shell html-preview-pane" aria-label="HTML 阅读预览" />}>
      <PreviewPane source={file.content} tocIds={toc} wideTables />
    </Suspense>
  ) : (
    <Suspense fallback={<div className="wysiwyg-editor-pane lazy-pane"><span>所见即所得编辑器加载中</span></div>}>
      <WysiwygEditorPane source={file.content} onChange={handleContentChange} />
    </Suspense>
  );

  const wordPreviewPane = wordPreviewVisible && !isDocx ? (
    <Suspense fallback={<aside className="word-preview-panel" aria-label="Word 预览" />}>
      <WordPaperPreviewPane
        source={file.content}
        previewWidth={wordPreviewWidth}
        canExport={Boolean(file.path)}
        onExportWord={handleExportWord}
        onClose={() => setWordPreviewVisible(false)}
      />
    </Suspense>
  ) : null;

  const docxPane = (
    <div className="docx-preview-area">
      <Suspense fallback={<div className="preview-shell" />}>
        <DocxPreviewPane html={file.docxHtml ?? ''} />
      </Suspense>
    </div>
  );

  return (
    <div className="app-layout" style={{ fontSize: `${settings.zoomLevel}%` }}>
      <Toolbar
        dirty={file.dirty}
        fileName={file.name}
        tocVisible={tocVisible}
        editorMode={editorMode}
        wordPreviewVisible={wordPreviewVisible}
        editingDisabled={isDocx}
        onToggleToc={() => setTocVisible(v => !v)}
        onToggleEditorMode={handleToggleEditorMode}
        onToggleWordPreview={handleToggleWordPreview}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onOpenSettings={() => setSettingsVisible(true)}
      />
      <div
        ref={mainContentRef}
        className={mainContentClassName}
        style={{ '--word-preview-width': `${wordPreviewWidth}px` } as React.CSSProperties}
      >
        {isDocx ? docxPane : (
          <>
            {tocPane}
            {editorPane}
          </>
        )}
        {wordPreviewVisible && !isDocx && (
          <div
            className={`word-preview-resizer ${resizing ? 'dragging' : ''}`}
            role="separator"
            aria-label="调整 Word 预览宽度"
            aria-orientation="vertical"
            aria-valuemin={360}
            aria-valuemax={760}
            aria-valuenow={Math.round(wordPreviewWidth)}
            title="拖动调整 Word 预览宽度"
            onPointerDown={handleWordPreviewResizerPointerDown}
            onDoubleClick={() => setWordPreviewWidth(460)}
          />
        )}
        {wordPreviewPane}
      </div>
      <StatusBar filePath={file.path} dirty={file.dirty} />
      {settingsVisible && (
        <Suspense fallback={<div className="settings-overlay" />}>
          <SettingsPage
            onClose={() => setSettingsVisible(false)}
            onUpdateAvailable={(update) => setUpdateDialog({ source: 'manual', update })}
          />
        </Suspense>
      )}
      {updateDialog && (
        <UpdateDialog
          update={updateDialog.update}
          source={updateDialog.source}
          onClose={() => setUpdateDialog(null)}
        />
      )}
    </div>
  );
}
