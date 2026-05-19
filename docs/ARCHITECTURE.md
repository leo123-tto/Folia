# Folia 架构文档

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 桌面框架 | Tauri v2 | 2.11.1 |
| 前端框架 | React + TypeScript | React 19, TS 6 |
| 构建工具 | Vite | 8 |
| Markdown 编辑/渲染 | Vditor WYSIWYG + Vditor.preview() | 3.11.2（Lute 引擎） |
| 源码编辑器 | CodeMirror 6 | @uiw/react-codemirror 4.25 |
| 文件操作 | Tauri plugin-dialog / plugin-fs | |
| 自动更新 | Tauri plugin-updater / plugin-process | 检查更新、安装后重启 |

## 系统架构

```
┌──────────────────────────────────────────────┐
│  Tauri v2 (Rust)                             │
│  ┌────────────────────────────────────────┐  │
│  │  WebView (React App)                   │  │
│  │  ┌──────────────────────────────────┐   │  │
│  │  │ Toolbar: 文件 / 源码 / Word 预览  │   │  │
│  │  ├──────────────────────┬───────────┤   │  │
│  │  │ WYSIWYG / HTML Read  │ Word      │   │  │
│  │  │ Vditor or Preview    │ Preview   │   │  │
│  │  │ Source fallback(CM6) │ on demand │   │  │
│  │  ├──────────────────────┴───────────┤   │  │
│  │  │ StatusBar                        │   │  │
│  │  └──────────────────────────────────┘   │  │
│  └────────────────────────────────────────┘  │
│  Tauri Plugins: dialog / fs / opener / updater│
└──────────────────────────────────────────────┘
```

## 数据流

```
用户打开文件
  ↓
通过对话框、快捷键或 Tauri 原生文件拖放事件取得路径
  ↓
按需加载 fileService，再通过 Tauri plugin-fs 读取文本
  ↓
写入 React state (OpenedFile.content)
  ↓
documentViewMode 检测文件类型与原生 HTML table
  ↓
┌─ WysiwygEditorPane: 普通 Markdown 默认懒加载 Vditor WYSIWYG，input(value) 更新 state
│
├─ PreviewPane: 原生 HTML table / .html 文件使用 Vditor.preview() 稳定阅读预览
│
├─ EditorPane: 用户点击“源码模式”后才懒加载 CodeMirror，onChange 更新 state
│
└─ WordPaperPreviewPane:
     用户点击“Word 预览”后才懒加载
     ↓
     读取 settings.exportPresetId + customExportPresets，合并内置/用户导入预设
     ↓
     探测代码块类型，普通代码块才启用 highlight.js
     ↓
     动态加载 Vditor 预览配置（中文文案、关闭 icon 脚本、跳过 content-theme）
     ↓
     Vditor.preview(measureEl, source, options)
     ↓
     Lute 引擎解析 Markdown + HTML
     ↓
     内置 XSS 过滤（sanitize: true）
     ↓
     按 Word 导出 PresetConfig 映射真实 A4、页边距、标题、正文、表格和图片宽度
     ↓
     将渲染结果按 A4 内容高度分页，生成第 1 页 / 第 2 页纸张栈
     ↓
     保留 A4 CSS 尺寸并按右侧面板宽度整体缩放；导出按钮和预设选择器仅在面板内显示
```

## 核心模块

### services/

| 文件 | 职责 |
|------|------|
| `fileService.ts` | 封装 Tauri dialog + fs，提供 openFile / saveFile / saveFileAs |
| `fileDrop.ts` | 过滤可拖入打开的 Markdown / HTML / Word 文件路径 |
| `documentViewMode.ts` | 内部判断文档是否应使用稳定 HTML 阅读预览，避免复杂 HTML table 被 WYSIWYG 压窄或破坏 |
| `titlebarDrag.ts` | 自定义 overlay Toolbar 的拖动 fallback，过滤按钮后调用 Tauri `startDragging()` / `toggleMaximize()` |
| `markdownFeatureDetector.ts` | 轻量扫描 Markdown fenced code 类型，为 Vditor 预览提供内部资源触发判断 |
| `vditorPreviewConfig.ts` | 按需提供 Vditor.preview 所需中文文案，避免纯预览链路额外请求 i18n 脚本 |
| `word/presetImport.ts` | 解析和校验用户导入的 JSON 导出预设，基于内置预设做深合并并生成自定义预设 ID |
| `wordPreviewStyle.ts` | 将 Word 导出 `PresetConfig` 映射为 A4 纸张预览 CSS 变量 |
| `updateService.ts` | 封装 Tauri updater 检查、下载、安装和重启；浏览器预览下返回 unsupported |
| `settingsService.ts` | 管理 localStorage 设置、旧配置迁移、用户导入导出预设、设置变更广播、上次打开文件路径 |
| `sanitizeService.ts` | DOMPurify HTML 清洗；当前用于 docx 预览 HTML 安全边界 |
| `docxPreviewService.ts` | 按需加载 mammoth，将 docx 转换为已清洗 HTML |
| `wordExportService.ts` | 按需加载 Word 导出转换链路并写入 .docx 文件 |

### components/

| 文件 | 职责 |
|------|------|
| `EditorPane.tsx` | CodeMirror 6 编辑器，Markdown 语言模式 |
| `WysiwygEditorPane.tsx` | Vditor WYSIWYG 编辑器，普通 Markdown 的默认主编辑体验 |
| `PreviewPane.tsx` | `Vditor.preview()` 稳定阅读预览，原生 HTML table 和 `.html` 文件默认使用 |
| `WordPaperPreviewPane.tsx` | 按需打开的 Word 多页纸张预览，包含预设选择、面板内导出按钮、A4 分页和整体缩放 |
| `UpdateDialog.tsx` | 发现新版本后的安装确认与下载进度对话框 |
| `Toolbar.tsx` | 工具栏：打开 / 保存 / 另存为 / 源码模式 / Word 预览 / 大纲切换 / 设置 |
| `StatusBar.tsx` | 底部状态栏：文件路径 + dirty 标记 |

### app/

| 文件 | 职责 |
|------|------|
| `AppLayout.tsx` | 主布局，管理文件状态、TOC 提取、拖拽打开、快捷键、WYSIWYG/稳定 HTML 预览/源码切换与 Word 预览面板 |
| `App.tsx` | 入口组件 |

## 启动性能策略

- 首屏只加载应用 shell、Toolbar、StatusBar、WYSIWYG 外壳和少量设置逻辑。
- Tauri 文件服务从主入口移出，打开、保存、自动保存时才动态加载 dialog/fs 相关代码。
- CodeMirror 编辑器通过 `React.lazy()` 拆分，仅在用户点击“源码模式”时加载。
- 源码模式布局要求 CodeMirror wrapper 被主内容区高度约束，滚动只发生在 `.cm-scroller`，避免长文档把编辑器撑高后被外层裁剪。
- 稳定 HTML 阅读预览通过 `React.lazy()` 拆分，仅在检测到原生 HTML table、`.html` 文件或后续明确需要阅读预览时加载。
- Word 纸张预览组件通过 `React.lazy()` 拆分，仅在用户点击“Word 预览”时加载；输入内容使用 debounce 更新预览，A4 页面使用真实 CSS 尺寸后分页，并整体缩放到右侧面板。
- 自定义导出预设只保存在 localStorage 中，Settings / 导出按需导入 JSON；应用启动仅读取轻量设置对象，不加载 Word 导出转换链路。
- Word 预览前通过 `markdownFeatureDetector` 做内部特征探测：当文档只包含 Mermaid、math、Graphviz、Markmap 等由 Vditor 自渲染的 fenced code 时，禁用普通代码高亮脚本加载；检测到普通代码块时仍启用 highlight.js。
- Vditor preview 使用内联中文文案并禁用 icon 脚本加载；内容主题由 Folia 样式接管，跳过 `content-theme/light.css` 请求。
- Settings 页面、Word 导出链路、docx 预览组件与转换链路均按需加载。
- “重新打开上次文件”延迟到启动后的空闲时段执行，避免大文件读取/转换阻塞冷启动。
- 自动更新检查延迟到启动后约 2.6 秒执行，并且仅在 Tauri 桌面运行时启用；手动检查入口放在 Settings / 关于，不影响首屏加载。

## 自动更新

- 运行时：`AppLayout` 根据 `autoUpdateCheck` 设置延迟调用 `updateService.checkForAppUpdate()`；发现更新后显示 `UpdateDialog`，用户确认后 `downloadAndInstall()` 并 `relaunch()`。
- 更新源：`src-tauri/tauri.conf.json` 使用 GitHub Releases endpoint `https://github.com/cat-xierluo/Folia/releases/latest/download/{{target}}-{{arch}}.json`。
- 签名：公钥写入 Tauri updater 配置；私钥位于本机 `~/.tauri/folia.key`，不得提交到仓库。
- 本地普通打包：`npm run tauri -- build` 不生成 updater artifact，避免没有私钥时失败。
- 发布更新：设置 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 后运行 `npm run tauri:build:update`，再运行 `npm run updater:manifest` 生成 `darwin-aarch64.json`。
- 需要上传到 GitHub Release 的 macOS 更新文件：`Folia.app.tar.gz`、`Folia.app.tar.gz.sig`、`darwin-aarch64.json`。

### 静态资源

| 路径 | 职责 |
|------|------|
| `public/vditor/dist/` | Vditor 本地 CDN 运行时资源（Lute、Mermaid、KaTeX、highlight.js 等）；已移除运行时不引用的 TS/type 声明和未压缩构建文件 |

## 测试策略

- `npm test`：Vitest 单元测试，覆盖设置迁移、HTML 清洗、Markdown 渲染特征探测。
- `npm run test:e2e`：Playwright 端到端回归测试，启动 Vite 后验证冷启动、编辑切换、稳定 HTML 阅读预览、Word 预览和 HTML 表格渲染。
- E2E 重点覆盖：普通 Markdown 默认显示 WYSIWYG、源码编辑器按需加载且长文档可滚动、原生 HTML table 自动进入稳定阅读预览、Word 预览按需加载、右侧面板拖拽、Settings 固定尺寸、大纲栏尺度和复杂 HTML table 不横向溢出。

## Tauri 配置

- 窗口：980×680，可调整大小
- macOS 标题栏：`titleBarStyle: Overlay` + `hiddenTitle: true`，系统红黄绿按钮覆盖在 WebView 顶部，前端 Toolbar 预留左侧空间，并通过透明拖拽层、控件间空白和 JS `startDragging()` fallback 提供窗口拖动区域；双击空白区域调用 `toggleMaximize()`
- CSP：`default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'`
- 插件权限：dialog:allow-open, dialog:allow-save, fs:allow-read-text-file, fs:allow-write-text-file, updater:default
