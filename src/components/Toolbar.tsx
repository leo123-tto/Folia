import {
  FileCheck2,
  FileInput,
  FileSearch2,
  Files,
  ListCollapse,
  SlidersHorizontal,
  SquareCode,
} from 'lucide-react';
import { handleTitlebarMouseDown } from '../services/titlebarDrag';

export type EditorMode = 'wysiwyg' | 'source';

type ToolbarProps = {
  dirty: boolean;
  fileName: string;
  tocVisible: boolean;
  editorMode: EditorMode;
  wordPreviewVisible: boolean;
  editingDisabled: boolean;
  onToggleToc: () => void;
  onToggleEditorMode: () => void;
  onToggleWordPreview: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenSettings: () => void;
};

export function Toolbar({
  dirty, fileName, tocVisible, onToggleToc,
  editorMode, wordPreviewVisible, editingDisabled, onToggleEditorMode, onToggleWordPreview,
  onOpen, onSave, onSaveAs, onOpenSettings,
}: ToolbarProps) {
  const hasOpenedFile = fileName !== '未命名';
  const iconSize = 19;
  const strokeWidth = 1.75;

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    const nativeEvent = event.nativeEvent;
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => handleTitlebarMouseDown(nativeEvent, getCurrentWindow()))
      .catch((error) => console.warn('Failed to start window drag:', error));
  };

  return (
    <div className="app-toolbar" data-window-drag-fallback="manual" onMouseDown={handleMouseDown}>
      <div className="toolbar-drag-region" data-tauri-drag-region aria-hidden="true" />
      <div className="toolbar-left">
        <button onClick={onOpen} title="打开 Markdown / Word (Cmd+O)" aria-label="打开">
          <FileInput size={iconSize} strokeWidth={strokeWidth} />
        </button>
        <button onClick={onSave} disabled={editingDisabled} title="保存 (Cmd+S)" aria-label="保存">
          <FileCheck2 size={iconSize} strokeWidth={strokeWidth} />
        </button>
        <button onClick={onSaveAs} disabled={editingDisabled} title="另存为 (Cmd+Shift+S)" aria-label="另存为">
          <Files size={iconSize} strokeWidth={strokeWidth} />
        </button>
        <span className={`file-name ${hasOpenedFile || dirty ? 'visible' : ''}`} data-tauri-drag-region>
          {dirty && <span className="dirty-dot" />}
          {fileName}
        </span>
      </div>
      <div className="toolbar-spacer" data-tauri-drag-region aria-hidden="true" />
      <div className="toolbar-right">
        <button
          className={editorMode === 'source' ? 'active' : ''}
          onClick={onToggleEditorMode}
          disabled={editingDisabled}
          title="源码模式"
          aria-label="源码模式"
        >
          <SquareCode size={iconSize} strokeWidth={strokeWidth} />
        </button>
        <button
          className={wordPreviewVisible ? 'active' : ''}
          onClick={onToggleWordPreview}
          disabled={editingDisabled}
          title="Word 预览"
          aria-label="Word 预览"
        >
          <FileSearch2 size={iconSize} strokeWidth={strokeWidth} />
        </button>
        <span className="toolbar-separator" />
        <button className={tocVisible ? 'active' : ''} onClick={onToggleToc} title="大纲" aria-label="大纲">
          <ListCollapse size={iconSize} strokeWidth={strokeWidth} />
        </button>
        <button className="toolbar-settings-btn" onClick={onOpenSettings} title="设置" aria-label="设置">
          <SlidersHorizontal size={iconSize} strokeWidth={strokeWidth} />
        </button>
      </div>
    </div>
  );
}
