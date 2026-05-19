# Changelog

All notable changes to this project will be documented in this file.

## [0.3.7] - 2026-05-19

### Added

- GitHub Actions 全平台自动发布工作流：tag 触发 → macOS ARM/Intel DMG + Windows EXE/MSI → 签名 → `latest.json` → GitHub Release。
- Release 发布后自动同步构建产物到 Gitee，生成 Gitee 专属 `latest.json` 供国内用户自动更新。

### Changed

- Updater 构建配置 `createUpdaterArtifacts` 改为 `true`，构建时生成签名产物。
- Updater endpoint URL 从 `{{target}}-{{arch}}.json` 改为统一的 `latest.json`。
- Bundle identifier 从 `com.folia.app` 改为 `com.folia.reader`，避免 macOS `.app` 扩展名冲突。
- Updater endpoints 增加 Gitee 备用源（国内优先），GitHub 作为 fallback。

### Fixed

- `.gitignore` 添加 `*.key` 排除规则，防止签名密钥意外提交。
- `docs/icon.png` 添加 macOS 标准圆角，GitHub 上显示更自然。

## [0.3.6] - 2026-05-18

### Added

- Word 预览改为多页 A4 纸张栈，显示 `第 1 页`、`第 2 页` 等页标，长文档不再是一张无限长纸。
- Word 预览面板内新增导出预设选择器，切换预设会同步影响预览和后续 `.docx` 导出。
- Settings / 导出支持导入自定义 JSON 预设，并提供 JSON 模板复制入口。

### Changed

- “导出 Word”按钮从顶部一级工具栏移入 Word 预览面板，只有打开 Word 预览时才显示。
- Word 预览拖拽调整宽度时只改变视觉缩放，不改变 A4 页面自身排版宽度。
- 导出预设从纯内置列表扩展为“内置预设 + 用户导入预设”的统一注册表。

## [0.3.5] - 2026-05-18

### Fixed

- 修复原生 HTML 表格文档在默认 WYSIWYG 区域中被压成极窄列、单元格接近逐字换行的问题。
- 修复大纲侧栏默认宽度和字号偏小的问题，提升长文档导航的可读性。
- 修复 macOS overlay 顶部栏部分区域只设置 `data-tauri-drag-region` 但拖动不稳定的问题，增加手动 `startDragging()` fallback；双击顶部栏空白区域会触发窗口最大化切换。
- 修复源码模式中 CodeMirror 容器随内容无限增高、导致长文档无法在窗口内滚动的问题。

### Changed

- 检测到原生 `<table>` 或打开 `.html` 文件时，主内容区自动使用 `Vditor.preview()` 稳定阅读预览；源码模式仍可编辑，普通 Markdown 仍默认进入 WYSIWYG。
- HTML 表格阅读预览使用更宽的内容版心，优先保证法律证据目录类宽表格可读。

## [0.3.4] - 2026-05-18

### Added

- 接入 Tauri updater / process 插件，新增启动后延迟自动检查更新、发现新版本提示、下载进度、安装后重启流程。
- Settings 新增“关于”页面，包含当前版本、自动检查更新开关、手动检查更新按钮和 GitHub Releases 更新源信息。
- 新增 `scripts/create-updater-manifest.mjs` 与 `npm run updater:manifest`，用于生成 GitHub Release 所需的 `darwin-aarch64.json` 更新清单。
- 新增 `npm run tauri:build:update`，用于在发布时生成签名 updater artifact。

### Changed

- 普通 `npm run tauri -- build` 默认不生成 updater artifact，避免本地打包因为缺少私钥失败；发布更新时使用专门脚本并提供签名私钥环境变量。

## [0.3.3] - 2026-05-18

### Changed

- 顶部工具栏图标更换为统一的文件流转语义：打开、保存、另存为、导出、源码、Word 预览、大纲和设置按钮更容易区分。
- 工具栏按钮尺寸、圆角和 hover 反馈微调，减少“标签感”，更接近克制的桌面工具栏。

## [0.3.2] - 2026-05-18

### Fixed

- 修复 macOS overlay 标题栏中工具栏空白区域无法稳定拖动窗口的问题。
- 修复拖拽 Markdown / HTML / Word 文件到窗口后无法稳定打开的问题，桌面端改用 Tauri 原生拖放事件读取文件路径。
- 修复 WYSIWYG 编辑区中央出现突兀白色画布的问题，默认写作背景统一为暖调纸面底色。
- 修复 Word 纸张预览把 A4 页面压缩成面板宽度导致版式不还原的问题，改为真实 A4 页面按比例缩放。

### Changed

- 顶部工具栏不再显示 Folia 名称，文件操作按钮改用更明确的打开、保存、另存为、导出 Word 图标。
- 默认窗口尺寸从 `1280×800` 调整为 `980×680`，更符合轻量阅读器的初始体量。
- Word 纸张预览继续复用 `md2word` 沉淀的 A4、页边距、标题、正文、表格、图片宽度规则，并保持按需加载。

## [0.3.1] - 2026-05-17

### Fixed

- 修复前端生产构建失败和 ESLint 失败，恢复 `npm run build` / `npm run lint` 可用。
- 修复 Tauri 打包后生成目录被 ESLint 扫描导致 `npm run lint` 误报失败的问题。
- 修复 Node 25 测试环境中全局 `localStorage` 干扰 jsdom，导致 Vitest 设置服务测试失败的问题。
- 修复 Settings 在切换二级菜单时因内容高度不同导致弹窗尺寸跳动的问题。
- 修复 Vditor 默认 `nowrap` 表格样式导致长证据目录横向撑出预览区的问题。
- 修复 macOS 原生标题栏显示为独立黑色条的问题，窗口标题栏改为 overlay 并融入 Folia 顶部工具区。
- 修复应用图标仅左上角透明、其余三个角仍为实色背景导致圆角不完整的问题。
- `.docx` 预览接入 DOMPurify 清洗，避免 Mammoth HTML 输出直接注入预览区。
- 修复旧版导出设置迁移的递归读取风险。
- Settings 中的自动保存、重新打开上次文件、默认编码、编辑器字体/拼写检查、预览字体/宽度等选项接入运行时行为。

### Changed

- 主界面默认改为 Vditor 所见即所得 Markdown 编辑器，占满内容区；源码编辑器改为工具栏按钮触发的 fallback。
- Word 纸张预览改为按需打开的右侧可拖拽面板，默认不占用主界面，也不在冷启动时加载。
- Word 纸张预览基于导出预设渲染 A4、页边距、字体、图片最大宽度和表格样式。
- 复杂原生 HTML 表格继续作为核心能力保护：阅读预览与 Word 纸张预览均覆盖 `rowspan` / `colspan` 渲染和长表格换行；源码模式保留为结构安全的编辑入口。
- 明确 v0.3 产品方向：默认 Typora-like 所见即所得编辑，右侧预览改为 Word 导出纸张预览，源码模式保留为复杂 HTML 表格 fallback。
- Toolbar 改为 lucide 图标按钮，并补充 Folia wordmark，整体更贴近 `docs/DESIGN.md` 的克制工具风格。
- Markdown / Word 预览统一使用设计系统变量，修正白底、蓝色链接等硬编码样式。
- Word 导出、docx 预览、Vditor 预览改为按需加载，降低首屏主包压力。
- 启动路径进一步瘦身：空文档不加载 Vditor JS/CSS，CodeMirror 编辑器、Tauri 文件服务、Settings 与 docx 预览均改为按需加载，上次文件恢复延迟到启动后的空闲时段。
- Vditor 预览增加内部内容特征探测：仅包含 Mermaid、数学公式、Graphviz 等由 Vditor 自渲染代码块时，不再加载普通代码高亮脚本；普通代码块仍保持高亮。
- 纯预览链路内联 Vditor 所需中文文案并关闭图标脚本加载，同时复用 Folia 自有预览样式，减少 `i18n`、`icons`、`content-theme` 运行时请求。
- 应用图标改为透明外角的圆角图标资产，修正 Dock / Finder 中显示为方形底色的问题。
- 工具栏按钮、图标和 Settings 信息层级整体放大，去掉选择框的原生渐变光泽。
- 主编辑区从“只看编辑 / 分屏 / 只看预览”改为默认 WYSIWYG 单页编辑；Word 预览作为右侧可拖拽面板按需打开。
- macOS 下为系统红黄绿窗口按钮预留顶部工具栏左侧空间，并设置应用窗口背景色与主界面奶油底一致。

### Added

- 新增 `WysiwygEditorPane`，使用现有 Vditor WYSIWYG 能力，不新增编辑器依赖。
- 新增 `WordPaperPreviewPane` 和 Word 预览样式映射服务。
- 新增 Word 纸张预览样式单元测试，以及 WYSIWYG / Word 预览 / HTML 表格相关 E2E 回归测试。
- 新增 Vitest 测试脚本与服务层测试，覆盖 HTML 清洗和设置持久化/迁移。
- 新增 Markdown 渲染特征探测测试，覆盖普通文档、普通代码块、Mermaid/数学公式等高级块的资源触发判断。
- 新增 Playwright 端到端回归测试，覆盖空文档冷启动、普通 Markdown、Mermaid-only、普通代码块的资源加载策略。
- 新增布局端到端回归测试，覆盖视图切换、分栏拖拽、Settings 固定尺寸和长 HTML 表格换行。
- 新增 `package-lock.json` 固定前端依赖版本。

### Removed

- 移除遗留 `markdown-it` / `@types/markdown-it` 依赖和不再使用的 `markdownService.ts`。
- 精简 `public/vditor/dist/`，移除运行时不引用的 TS/type 声明和未压缩 Vditor 构建文件，保留阅读功能所需的本地资源。

## [0.3.0] - 2026-05-16

### Added

- Word 导出支持嵌入本地图片（JPEG/PNG/GIF/BMP，Tauri readFile + docx ImageRun，自动缩放）
- Settings 页面：导出预设选择器（5 个预设单选列表），选择持久化到 localStorage
- 导出 Word 时使用用户选择的预设（替换原来硬编码的 legal 预设）
- Word 导出功能：Markdown → 格式化 .docx，支持 5 个预设（法律/学术/公文/法律服务方案/简约通用）
- Word 预览功能：打开 .docx 文件，mammoth 转 HTML 在预览区渲染
- 拖拽支持 .docx 文件
- `Cmd+Shift+E` 快捷键触发 Word 导出
- 应用图标：用户设计的字母 F 图标，全平台格式（.icns / .ico / PNG）
- 设计系统文档 `docs/DESIGN.md`
- 任务清单 `docs/TASKS.md`

### Changed

- README.md 技术栈更新为 Vditor + 补充图标
- Tauri capabilities 新增 `fs:allow-read-file` 和 `fs:allow-write-file` 二进制文件权限

## [0.2.0] - 2026-05-15

### Changed

- 渲染引擎从 markdown-it + DOMPurify 替换为 Vditor.preview()
- PreviewPane.tsx 改用 Vditor.preview() 渲染，支持 Mermaid 图表、KaTeX 数学公式、highlight.js 代码高亮
- CSS 选择器从 `.preview-document` 改为 `.preview-content`（Vditor 容器 class）
- CSP 收紧：移除 `https:` 通配，只允许本地资源 + `unsafe-eval`（Vditor 需要）

### Added

- Vditor 静态资源本地化到 `public/vditor/dist/`，不依赖外部 CDN
- 代码块语法高亮（highlight.js，github 主题）
- Mermaid 图表渲染支持
- KaTeX 数学公式渲染支持
- Vditor 内置 XSS 过滤（sanitize: true）

### Removed

- `src/services/markdownService.ts` 不再使用（Vditor 自带 Lute 引擎）
- `src/components/VditorTest.tsx` 测试组件已删除
- `dangerouslySetInnerHTML` 渲染方式已移除

## [0.1.0] - 2026-05-15

### Added

- Markdown + HTML 渲染（markdown-it + DOMPurify）
- 固定左右分屏：CodeMirror 6 编辑 + 实时预览
- TOC 大纲面板，点击跳转到对应标题
- 文件打开（对话框 Cmd+O + 拖拽）
- 保存 / 另存为（Cmd+S / Cmd+Shift+S）
- 法律文档表格样式（rowspan / colspan / thead / tbody）
- DOMPurify 安全清洗，禁止 script / 事件属性 / javascript: 链接
- Tauri v2 桌面应用，macOS 原生 WebView
