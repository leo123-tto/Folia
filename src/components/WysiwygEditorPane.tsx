import { useCallback, useEffect, useRef } from 'react';
import { VDITOR_PREVIEW_I18N } from '../services/vditorPreviewConfig';
import {
  classifyHtmlTableBlocks,
  replaceHtmlTableBlock as serviceReplaceHtmlTableBlock,
  type HtmlTableBlock,
} from '../services/htmlTableBlockService';
import { useSettings } from '../hooks/useSettings';
import { translate } from '../services/i18n';
import { resolveLocalImages } from '../services/localImageResolver';

type WysiwygEditorPaneProps = {
  source: string;
  onChange: (value: string) => void;
  onViewComplexTable?: (block: HtmlTableBlock, anchor: HTMLElement) => void;
  filePath?: string;
};

// 复用 IR 模式展开 → 自动折叠的"停顿"延迟（ISS-151）
// Vditor IR 默认在编辑时让 `**` / `*` 等 marker 始终可见（vditor-ir__node--expand），
// 用户视角下加粗 / 斜体看上去未生效。监听 keydown 重置定时器，输入停顿后强制折叠。
const IR_MARKER_COLLAPSE_DELAY_MS = 220;
const FOLIA_LOCKED_ATTR = 'data-folia-locked';
const FOLIA_LOCKED_VALUE = 'table';
const FOLIA_TRIGGER_ATTR = 'data-folia-viewer-bound';
const ICON_SIZE = 14;
const ICON_STROKE_WIDTH = 1.6;

function getIrElement(editor: import('vditor').default): HTMLElement | null {
  // vditor.ir 是运行期挂载的 IR 视图容器；通过 unknown 转换避免依赖内部类型
  const vditor = (editor as unknown as { vditor?: { ir?: { element?: HTMLElement } } }).vditor;
  return vditor?.ir?.element ?? null;
}

function collapseExpandedMarkers(editor: import('vditor').default | null): void {
  if (!editor) return;
  const ir = getIrElement(editor);
  if (!ir) return;
  ir.querySelectorAll('.vditor-ir__node--expand').forEach((node) => {
    node.classList.remove('vditor-ir__node--expand');
  });
}

export function WysiwygEditorPane({ source, onChange, onViewComplexTable, filePath }: WysiwygEditorPaneProps) {
  const settings = useSettings();
  const t = useCallback(
    (key: Parameters<typeof translate>[1]) => translate(settings.locale, key),
    [settings.locale],
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import('vditor').default | null>(null);
  const applyingExternalValue = useRef(false);
  const latestSource = useRef(source);
  const collapseTimerRef = useRef<number | null>(null);
  const lastComplexBlocksRef = useRef<HtmlTableBlock[]>([]);

  useEffect(() => {
    latestSource.current = source;
  }, [source]);

  const lockComplexTables = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const host = hostRef.current;
    if (!host) return;

    const irRoot = host.querySelector<HTMLElement>('.vditor-ir') ?? host;
    const tables = irRoot.querySelectorAll<HTMLTableElement>('table');
    if (tables.length === 0) return;

    const currentValue = editor.getValue();
    const complex = classifyHtmlTableBlocks(currentValue).complex;
    lastComplexBlocksRef.current = complex;
    let complexCursor = 0;

    tables.forEach((table) => {
      const hasMerge = table.querySelector('[rowspan], [colspan]');
      if (!hasMerge) {
        return;
      }
      const block = complex[complexCursor++];
      table.setAttribute(FOLIA_LOCKED_ATTR, FOLIA_LOCKED_VALUE);
      table.setAttribute('contenteditable', 'false');
      if (block) {
        table.setAttribute('data-folia-locked-index', String(block.index));
      }
      table.classList.add('folia-locked-table');
    });
  }, []);

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current !== null) {
        window.clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    void Promise.all([
      import('vditor/dist/index.css'),
      import('vditor'),
    ]).then(([, { default: Vditor }]) => {
      if (cancelled || !hostRef.current) return;

      const editor = new Vditor(hostRef.current, {
        value: latestSource.current,
        mode: 'ir',
        height: '100%',
        width: '100%',
        cdn: '/vditor',
        lang: 'zh_CN',
        i18n: VDITOR_PREVIEW_I18N,
        toolbar: [],
        resize: { enable: false },
        counter: { enable: false },
        cache: { enable: false },
        preview: {
          markdown: {
            sanitize: true,
          },
          theme: {
            current: 'light',
            path: '',
          },
          hljs: {
            enable: true,
            style: 'github',
            lineNumber: false,
          },
        },
        after() {
          const initial = classifyHtmlTableBlocks(latestSource.current);
          lastComplexBlocksRef.current = initial.complex;
          /* setValue already triggers after() once internally, but the first
             build may run before our ref is set. Locking here is idempotent. */
          queueMicrotask(() => {
            lockComplexTables();
            const host = hostRef.current;
            if (host) void resolveLocalImages(host, filePath);
          });
        },
        input(value) {
          if (applyingExternalValue.current) return;

          // ISS-151: 每次 input 后安排折叠定时器。
          // 粘贴（insertText）不触发 keydown，所以需要在 input 中也安排折叠，
          // 避免粘贴 `**foo**` 后 marker 一直保持展开。
          if (collapseTimerRef.current !== null) {
            window.clearTimeout(collapseTimerRef.current);
          }
          collapseTimerRef.current = window.setTimeout(() => {
            collapseTimerRef.current = null;
            collapseExpandedMarkers(editorRef.current);
          }, IR_MARKER_COLLAPSE_DELAY_MS);

          const complex = lastComplexBlocksRef.current;
          if (complex.length === 0) {
            onChange(value);
            return;
          }

          const nextBlocks = classifyHtmlTableBlocks(value);
          let restored = value;
          let touched = false;

          complex.forEach((original) => {
            const next = nextBlocks.complex.find((candidate) => candidate.index === original.index)
              ?? nextBlocks.simple.find((candidate) => candidate.index === original.index);
            if (!next) {
              touched = true;
              restored = serviceReplaceHtmlTableBlock(restored, original.index, original.html);
              return;
            }
            if (next.html !== original.html) {
              touched = true;
              restored = serviceReplaceHtmlTableBlock(restored, original.index, original.html);
            }
          });

          if (touched) {
            applyingExternalValue.current = true;
            editor.setValue(restored, true);
            window.requestAnimationFrame(() => {
              applyingExternalValue.current = false;
              lockComplexTables();
            });
            onChange(restored);
            return;
          }

          /* No complex table was touched, but the simple-table bucket may
             have changed structure (Lute may also normalize locked-table
             text). Refresh our cache from the actual current value to
             avoid drifting. */
          lastComplexBlocksRef.current = nextBlocks.complex;
          onChange(value);
        },
        keydown() {
          // 每次按键重置折叠定时器，避免编辑过程中误折叠正在编辑的 IR 节点
          if (collapseTimerRef.current !== null) {
            window.clearTimeout(collapseTimerRef.current);
          }
          collapseTimerRef.current = window.setTimeout(() => {
            collapseTimerRef.current = null;
            collapseExpandedMarkers(editorRef.current);
          }, IR_MARKER_COLLAPSE_DELAY_MS);
        },
        blur() {
          if (collapseTimerRef.current !== null) {
            window.clearTimeout(collapseTimerRef.current);
            collapseTimerRef.current = null;
          }
          collapseExpandedMarkers(editorRef.current);
        },
      });

      editorRef.current = editor;
    });

    return () => {
      cancelled = true;
      if (collapseTimerRef.current !== null) {
        window.clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
      editorRef.current?.destroy();
      editorRef.current = null;
      lastComplexBlocksRef.current = [];
    };
  }, [filePath, lockComplexTables, onChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = editor.getValue();
    if (currentValue === source) return;

    applyingExternalValue.current = true;
    lastComplexBlocksRef.current = classifyHtmlTableBlocks(source).complex;
    editor.setValue(source, true);
    window.requestAnimationFrame(() => {
      applyingExternalValue.current = false;
      lockComplexTables();
    });
  }, [source, lockComplexTables]);

  /* Hover layer: when the user hovers a complex table, inject a small "view
     original" button at the top-right corner. The button is removed on
     mouseleave so it does not interfere with normal editing. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!onViewComplexTable) return;

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const table = target.closest<HTMLTableElement>(`table[${FOLIA_LOCKED_ATTR}="${FOLIA_LOCKED_VALUE}"]`);
      if (!table) return;
      if (table.getAttribute(FOLIA_TRIGGER_ATTR) === 'true') return;

      table.setAttribute(FOLIA_TRIGGER_ATTR, 'true');
      table.classList.add('folia-locked-table--hover-bound');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'folia-html-table-viewer-trigger';
      button.title = t('htmlTableViewerTriggerTitle');
      button.setAttribute('aria-label', t('htmlTableViewerTriggerTitle'));
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${ICON_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
      button.addEventListener('mousedown', (mouseEvent) => {
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
      });
      button.addEventListener('click', (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        const currentValue = editorRef.current?.getValue() ?? source;
        const live = classifyHtmlTableBlocks(currentValue).complex;
        const fallbackIndex = Number(table.getAttribute('data-folia-locked-index') ?? '-1');
        const block = live.find((candidate) => candidate.index === fallbackIndex)
          ?? live[0]
          ?? lastComplexBlocksRef.current[0];
        if (block) {
          onViewComplexTable(block, table);
        }
      });
      table.style.position = table.style.position || 'relative';
      table.appendChild(button);
    };

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const table = target.closest<HTMLTableElement>(`table[${FOLIA_LOCKED_ATTR}="${FOLIA_LOCKED_VALUE}"]`);
      if (!table) return;
      const next = event.relatedTarget;
      if (next instanceof Node && table.contains(next)) return;
      const trigger = table.querySelector<HTMLButtonElement>('.folia-html-table-viewer-trigger');
      trigger?.remove();
      table.removeAttribute(FOLIA_TRIGGER_ATTR);
      table.classList.remove('folia-locked-table--hover-bound');
    };

    host.addEventListener('mouseover', handleMouseOver);
    host.addEventListener('mouseout', handleMouseOut);
    return () => {
      host.removeEventListener('mouseover', handleMouseOver);
      host.removeEventListener('mouseout', handleMouseOut);
      host.querySelectorAll(`.folia-html-table-viewer-trigger`).forEach((node) => node.remove());
    };
  }, [onViewComplexTable, source, t]);

  return (
    <div className="wysiwyg-editor-pane" aria-label="即时渲染编辑器">
      <div ref={hostRef} className="wysiwyg-editor-host" />
    </div>
  );
}
