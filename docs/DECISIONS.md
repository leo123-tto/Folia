# Folia 决策记录与工作日志

## 第一部分：决策记录

### [DEC-008] - 2026-05-18 - 自动更新：从 GitHub Releases 拉取

**背景**
ISS-036 已接入 `tauri-plugin-updater` / `tauri-plugin-process` 和前端 `updateService.ts`，但目前无法实际触发更新——缺少构建签名产物和发布流程。

**现状盘点**

| 组件 | 状态 | 说明 |
|------|------|------|
| `tauri-plugin-updater` (Rust) | ✅ 已安装 | Cargo.toml v2.10.1 |
| `plugins.updater` (tauri.conf.json) | ⚠️ 需修正 | pubkey 已有，但 endpoint URL 格式错误 |
| `updater:default` (capabilities) | ✅ 已配置 | |
| `updateService.ts` (前端) | ✅ 已实现 | check → downloadAndInstall → relaunch |
| `tauri-plugin-process` | ✅ 已安装 | 用于更新后 relaunch |
| 签名密钥 `~/.tauri/folia.key` | ✅ 已生成 | 公钥已写入 tauri.conf.json |
| `createUpdaterArtifacts` | ❌ 当前 false | 需改为 true 才会生成 .tar.gz + .sig |
| GitHub Actions 发布工作流 | ❌ 不存在 | 需要新建 |
| `latest.json` manifest | ❌ 不存在 | 需要在 Release 时生成并上传 |

**需要修正的 3 个问题**

1. **`createUpdaterArtifacts: false` → `true`**
   构建时才会生成 `Folia.app.tar.gz`（更新包）和 `Folia.app.tar.gz.sig`（签名文件）

2. **Endpoint URL 修正**
   当前：`https://github.com/cat-xierluo/Folia/releases/latest/download/{{target}}-{{arch}}.json`
   正确：`https://github.com/cat-xierluo/Folia/releases/latest/download/latest.json`
   Tauri updater 期望一个统一的 `latest.json` manifest，内含所有平台的签名和下载 URL

3. **新建 GitHub Actions 发布工作流**
   - 触发：推送版本 tag（如 `v0.2.0`）
   - 步骤：安装依赖 → `npm run tauri build`（设 `TAURI_SIGNING_PRIVATE_KEY` 环境变量）
   - 产物：`Folia.app.tar.gz` + `.sig`（macOS）、`.msi` + `.sig`（Windows）
   - 生成 `latest.json` manifest（包含 version、notes、pub_date、platforms 签名和 URL）
   - 创建 GitHub Release 并上传所有产物

**`latest.json` 格式**

```json
{
  "version": "0.2.0",
  "notes": "更新说明",
  "pub_date": "2026-05-18T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://github.com/cat-xierluo/Folia/releases/download/v0.2.0/Folia.app.tar.gz",
      "signature": "（Folia.app.tar.gz.sig 文件内容）"
    },
    "windows-x86_64": {
      "url": "https://github.com/cat-xierluo/Folia/releases/download/v0.2.0/Folia_0.2.0_x64-setup.nsis.zip",
      "signature": "（.sig 文件内容）"
    }
  }
}
```

**更新流程（端到端）**

1. 推送 `v0.2.0` tag → GitHub Actions 触发
2. 构建并签名 → 生成 `Folia.app.tar.gz` + `.sig`
3. 生成 `latest.json` → 创建 GitHub Release → 上传所有文件
4. 用户端 App 调用 `check()` → 请求 `latest.json`
5. 比对版本 → 下载 `.tar.gz` → 验签 → 安装 → `relaunch()`

**跳过项（暂不处理）**

- Apple Developer 签名 / 公证（macOS Gatekeeper 会提示"无法验证开发者"，但更新机制本身不受影响）
- Windows 代码签名

**影响**

- 需修改 `tauri.conf.json`：`createUpdaterArtifacts: true` + 修正 endpoint
- 需新建 `.github/workflows/release.yml`
- 需将 `TAURI_SIGNING_PRIVATE_KEY` 添加为 GitHub repo secret
- 本地构建时需设置环境变量：`TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/folia.key)`

### [DEC-007] - 2026-05-17 - v0.3 产品形态：所见即所得编辑 + Word 纸张预览

**背景**
用户希望 Folia 不再只是左侧 Markdown 源码、右侧普通渲染预览，而是向 Typora 的所见即所得体验靠近；同时希望右侧区域变成“导出 Word 文件前的预览”，并参考独立 `md2word` 项目的代码和方式。

当前 Folia 已具备：
- CodeMirror 源码编辑
- Vditor.preview() Markdown 预览
- 纯 TypeScript Word 导出链路（`docx`）
- `.docx` 文件预览链路（`mammoth`）
- 以启动速度为优先的按需加载策略

`md2word` 当前可复用价值主要集中在 Word 版式规则与转换经验：A4 页面、法律文书页边距、图片宽度策略、模板查找、复杂 HTML 表格的 rowspan/colspan 处理。其 Python sidecar 架构不适合作为 Folia 默认链路，否则会明显增加包体、启动路径和跨语言维护成本。

**选项**
1. 直接接入 Vditor 完整编辑器，并保留当前 Markdown 预览。优点是实现快；缺点是编辑器较重，产品形态仍然是 Markdown 预览，不解决 Word 导出前确认的问题。
2. 引入 Milkdown/ProseMirror 做完整 WYSIWYG 文档模型。优点是现代、可扩展；缺点是复杂 HTML table 与 Markdown round-trip 风险较高，容易偏离轻量阅读器定位。
3. 以 Markdown 源码为唯一可信数据源，分阶段实现 Typora-like 编辑外壳，并将右侧重构为基于 Word 导出配置的 A4 纸张预览。优点是兼顾启动速度、可逆性和 Word 导出一致性；缺点是需要逐步完善编辑交互，不是一轮即可达到完整 Typora 能力。

**决策**
选择方案 3。

v0.3 的产品形态改为：
- 默认显示 Typora-like 所见即所得编辑区
- 保留源码编辑模式作为复杂 HTML 表格、调试和兼容性 fallback
- 右侧预览从“普通 Markdown HTML 预览”调整为“Word 导出纸张预览”
- Word 预览复用 Folia 现有 `PresetConfig` 与 `src/services/word/` 配置，不默认引入 `md2word` 的 Python sidecar
- `md2word` 仅作为版式和转换策略参考，优先吸收 A4、页边距、图片、表格和模板规则

**理由**
Folia 的核心目标仍是轻量、快启动和稳定处理法律文档。所见即所得不应牺牲 Markdown 源码可逆性，也不应让用户理解“极速模式 / 完整模式”等额外设置。右侧 Word 纸张预览如果基于同一套导出配置渲染，可以在导出前给出更接近最终文件的视觉反馈，同时避免每次输入都生成真实 `.docx` 带来的性能压力。

**影响**
- 需要重构 `PaneMode` 语义：右侧“预览”将代表 Word 纸张预览，而不是普通 Markdown HTML 预览
- 需要新增 Word 纸张预览组件，按需渲染 A4 画布和导出样式
- 需要调研 WYSIWYG 实现方案并做启动体积评估
- 需要增加复杂 HTML table 的编辑、预览、导出一致性回归样例

### [DEC-008] - 2026-05-17 - Word 预览按需打开，HTML 表格能力优先

**背景**
用户进一步明确：主界面应是完整的所见即所得 Markdown 编辑页面，Word 预览不是默认打开区域，而是用户专门点击按钮后才显示。同时，Folia 最重要的目标仍是稳定渲染原生 HTML，尤其是带 `rowspan` / `colspan` 的复杂法律文档表格。

**决策**
v0.3 第一阶段采用以下落地方式：
- 默认加载 Vditor WYSIWYG 编辑器，占满内容区
- 源码模式通过工具栏按钮切换，继续使用 CodeMirror 懒加载
- Word 纸张预览通过工具栏按钮按需打开为右侧可拖拽面板
- 普通 Markdown HTML 预览组件不再参与主界面
- 所见即所得和 Word 纸张预览都必须通过复杂 HTML table 回归测试

**理由**
默认右侧预览会削弱轻量写作体验，也会让用户误以为需要一直维护两个视图。按需打开 Word 预览可以保持 Typora-like 主体验，同时在导出前提供足够接近 Word 的纸张效果。HTML table 是项目成立原因，因此它的渲染能力优先级高于任何编辑器替换。

**影响**
- `AppLayout` 使用 `editorMode` 与 `wordPreviewVisible` 两个状态替代旧的三段式视图模式
- `Toolbar` 改为源码模式按钮 + Word 预览按钮
- 新增 WYSIWYG 编辑器组件和 Word 纸张预览组件
- E2E 覆盖 raw HTML table 在 WYSIWYG 中可见、Word 纸张预览不横向溢出

### [DEC-009] - 2026-05-18 - 桌面壳保持安静，Word 预览采用真实 A4 缩放

**背景**
用户在实际编译后反馈：overlay 标题栏仍有部分区域无法拖动，工具栏图标语义不够清晰，拖入 Markdown 文件不能打开，WYSIWYG 中间白色画布突兀，Word 预览不像 `md2word` 的 Word 版式，默认窗口偏大，且主界面不希望显示 Folia 名称。

**决策**
- 主界面 Toolbar 不显示应用名，只保留文件操作、源码、Word 预览、大纲和设置图标。
- Toolbar 的控件间空白和背景层都作为 Tauri 拖动区域，按钮仍保持可点击。
- 拖拽打开文件使用 Tauri 原生 `onDragDropEvent` 获取路径，浏览器 HTML5 drop 仅作为开发环境 fallback。
- WYSIWYG 默认写作区使用统一暖底，不再模拟白色纸张；白色纸张只用于 Word 预览。
- Word 预览保留真实 A4 CSS 尺寸，再按右侧面板宽度整体缩放，而不是把页面宽度压缩为 `100%`。
- 默认窗口尺寸改为 `980×680`，更符合轻量阅读器的初始体量。

**理由**
Folia 的主体验应接近 Typora 的安静编辑界面：内容优先，品牌文本和复杂模式不应占据首屏。Word 预览是导出前的版式确认工具，应尽量接近 `md2word` / Word 的纸张模型；保留真实 A4 后整体缩放能让页边距、字号、表格和图片比例一致变化，比压缩版心更可靠。

**影响**
- 需要维护 `Toolbar` 与 CSS 拖动层的 pointer-events 关系，避免后续改样式时再次遮挡拖拽区域。
- Word 预览在窄面板中会整体缩小，视觉上更像 Word 的缩放预览；最终 `.docx` 仍由导出链路生成。
- 拖拽打开路径过滤集中在 `fileDrop.ts`，后续扩展格式应在该服务和 fileService 中同步。

### [DEC-010] - 2026-05-18 - 自动更新采用 Tauri updater，默认延迟检查

**背景**
用户希望 Folia 参考 Funes 增加自动更新能力，并顺带吸收 Funes 中较成熟的设置页组织方式。Funes 的实现路径是 `@tauri-apps/plugin-updater` 检查更新，用户确认后 `downloadAndInstall()`，再通过 process 插件 relaunch。

**决策**
- Folia 使用 Tauri 官方 updater / process 插件，不自建更新下载器。
- 自动检查更新默认开启，但延迟到启动后执行，避免进入冷启动关键路径。
- Settings 增加“关于”页，承载版本号、自动检查开关、手动检查更新和 GitHub Releases 更新源信息。
- 普通本地打包不默认生成 updater artifact；发布更新时用 `npm run tauri:build:update` 和签名私钥生成。
- 新增 manifest 脚本生成 `darwin-aarch64.json`，与 endpoint `{{target}}-{{arch}}.json` 对齐。

**理由**
自动更新是桌面发布能力，应该走 Tauri 官方签名和校验链路。对 Folia 这种轻量阅读器来说，更新检查不应拖慢打开文件；同时用户不需要理解复杂发布配置，因此设置页只暴露自动检查和手动检查两个入口。

**影响**
- 需要保护 `~/.tauri/folia.key` 私钥，不能提交到仓库。
- GitHub Release 需要上传 `.tar.gz`、`.sig` 和对应 JSON manifest 后，客户端才能检查到新版本。
- `npm run tauri -- build` 仍可无私钥通过；发布更新用专门脚本。

### [DEC-011] - 2026-05-18 - 原生 HTML 表格默认阅读优先，不强制 WYSIWYG

**背景**
用户反馈 `260512 证据目录.md` 这类原生 HTML 表格文档在默认 WYSIWYG 区域中被压成极窄列，单元格内容接近逐字换行；同时用户明确表示 HTML 表格不一定要求所见即所得编辑，但必须稳定阅读和正常预览。

**决策**
- 普通 Markdown 继续默认进入 Vditor WYSIWYG。
- 检测到原生 `<table>` 或打开 `.html` 文件时，主内容区自动切到基于 `Vditor.preview()` 的稳定阅读预览。
- 源码模式继续作为 HTML 表格文档的编辑入口，避免 WYSIWYG 对复杂 HTML table 做不可控 round-trip。
- Word 预览仍作为按需打开的右侧导出版式预览，不替代主阅读预览。

**理由**
Folia 的成立原因是稳定阅读法律文档中的复杂 HTML 表格。WYSIWYG 编辑器需要处理光标、选区和 HTML 回写，天然比纯预览更容易破坏 `rowspan`、`colspan`、空单元格和长文本结构。对这类文档应把“读得稳定”放在“直接编辑表格”之前，同时保持源码编辑不丢能力。

**影响**
- 新增 `documentViewMode.ts` 作为内部文档视图判断，不向用户暴露“极速/完整/兼容”等额外模式。
- `PreviewPane` 恢复为复杂 HTML 表格的主阅读路径，并继续复用 Vditor 本地资源与 Folia 预览样式。
- E2E 回归从“HTML table 必须在 WYSIWYG 中渲染”调整为“HTML table 必须自动进入稳定阅读预览且保持宽表可读”。

### [DEC-012] - 2026-05-18 - overlay 顶部栏采用手动拖动 fallback

**背景**
用户反馈顶部“标题栏/工具栏”区域点击或拖动时窗口仍无响应。此前只依赖 `data-tauri-drag-region`，但在 overlay 标题栏 + 自定义 Toolbar 组合下，部分区域的原生拖动行为不稳定。

**决策**
- 保留 `data-tauri-drag-region` 作为原生拖动声明。
- 在 Toolbar 根节点增加手动 mouse down fallback：非按钮/链接/输入等交互目标上按下左键时调用 `getCurrentWindow().startDragging()`。
- 双击顶部栏空白区域时调用 `toggleMaximize()`，模拟 macOS 标题栏常见行为。
- 按钮、链接、输入框和显式 `data-no-window-drag` 元素不触发拖动。

**理由**
Tauri 官方窗口自定义文档建议在自定义标题栏上用 `startDragging()` 处理拖动、用 `toggleMaximize()` 处理双击。对 Folia 来说，顶部栏必须像原生标题栏一样可靠；保留原生 drag-region 再加 JS fallback，可以覆盖 overlay 标题栏的边缘区域问题。

**影响**
- 新增 `titlebarDrag.ts`，将目标过滤和 Tauri window 调用逻辑隔离，方便单元测试。
- Toolbar 会动态加载 `@tauri-apps/api/window`；仅在 Tauri 运行时触发，不影响浏览器开发预览。
- 后续新增 Toolbar 输入框、菜单或其他交互元素时，应使用真实交互标签或 `data-no-window-drag="true"`，避免被当作拖动区域。

### [DEC-006] - 2026-05-16 - Word 导出与预览：纯 JS/TS 方案

**背景**
用户希望将现有 md2word 项目（独立 Tauri 桌面应用，Python + python-docx 转换引擎 + React 配置前端）的 Word 导出能力集成到 Folia 中，同时增加 .docx 文件预览能力。

md2word 独立项目包含：
- 完整配置系统（30+ 字段的 flat config schema：中英文字体、逐级标题样式、页边距、图片比例、表格行高等）
- 4 个内置预设（modern/academic/legal/business）+ 用户自定义预设
- 可搜索字体选择器、逐级标题配置组件、A4 模拟预览
- i18n（中英文）
- Rust 后端管理配置持久化、Python sidecar 编排

**选项**
1. Python sidecar — 复用 md2word.py 作为 Tauri sidecar。优点：直接复用 1967 行转换代码。缺点：引入跨语言复杂度，包体积增加 50MB+，需管理 Python 进程。
2. 纯 JS/TS（docx npm + mammoth）— 用 TypeScript 重写转换逻辑。优点：全部在 WebView 内运行，零外部依赖。缺点：需移植转换代码。
3. Rust 原生 — 用 Rust crate 生成 docx。优点：性能最好。缺点：Rust docx 生态不成熟。

**决策**
选择方案 2：纯 JS/TS。

**理由**
npm `docx` 包与 python-docx 功能完全对等（rowspan/CJK 字体 API 更好）。`mammoth` 可做 .docx → HTML 预览。所有逻辑在 WebView 内完成。

**配置系统集成策略**
采用 md2word 独立项目的 flat config schema 模式（`font_size_h1`、`margin_top` 等），但遵循 Folia 的 UI 克制原则：
- v0.6 只暴露**预设选择**作为主 UI（5 个预设：legal/academic/report/service-plan/minimal）
- 完整的 30+ 字段配置 schema 在代码中定义，但 UI 上只通过「高级设置」折叠面板暴露
- 不做独立的样式管理视图，只在 Settings 页面中增加一个"导出"分组
- 不引入 md2word 的 Glassmorphism 风格，保持 Folia 的透明/极简视觉系统

**影响**
- 新增 npm 依赖：`docx`（~200KB）、`mammoth`（~140KB）
- 新建 `src/services/word/` 目录（转换引擎 ~1300 行 TS）
- 新建 `src/config/exportConfig.ts`（flat config schema，30+ 字段）
- 需要添加 Tauri 二进制文件读写权限
- Mermaid 图表在 Word 导出中降级为文本

### [DEC-001] - 2026-05-15 - 桌面框架选型：Tauri v2

**背景**
需要选择一个轻量桌面框架来构建 Markdown 阅读器。核心需求是 WebView 渲染 HTML 表格（法律文档场景）。

**选项**
1. Electron — 生态成熟，但包体积大（100MB+），内存占用高
2. Tauri v2 — Rust 后端更轻，macOS 原生 WebView 渲染，包体小

**决策**
选择 Tauri v2。

**理由**
项目定位是轻量工具，不需要 Node.js 后端能力。Tauri 的系统 WebView 天然适合 HTML 表格渲染，且内存和包体都远小于 Electron。

**影响**
前端只能使用浏览器标准 API + Tauri 插件桥接，不能使用 Node.js 模块。

---

### [DEC-002] - 2026-05-15 - Markdown 渲染：markdown-it + DOMPurify

**背景**
需要渲染含原生 HTML 的 Markdown 文件，且要防止 XSS。

**选项**
1. marked — 轻量，但 HTML 处理能力较弱
2. markdown-it — 插件生态好，html: true 配置稳定支持原生 HTML
3. remark/rehype — 统一生态，但配置复杂

**决策**
markdown-it + DOMPurify。

**理由**
markdown-it 的 `html: true` 模式能稳定透传 HTML table（rowspan/colspan/thead/tbody），这在法律文档中是刚需。DOMPurify 在渲染后清洗危险标签，两层分离，各司其职。

**影响**
渲染链路固定为：Markdown → markdown-it → DOMPurify → DOM。后续任何编辑器替换（如 Milkdown）都需要遵守这个安全链路。

---

### [DEC-003] - 2026-05-15 - 产品形态简化：去掉提交模式和打印

**背景**
原始规格包含提交模式（隐藏备注列）和打印功能。用户反馈后决定简化。

**决策**
v0.1 不实现提交模式和打印，专注核心阅读编辑体验。

**理由**
提交模式是特定法律场景功能，MVP 阶段不应增加复杂度。打印可通过系统打印实现（未来可选）。

**影响**
`submitModeService.ts`、`printService.ts`、`ModeSwitcher.tsx` 已移除。未来如需可通过 `data-` 属性配置恢复。

---

### [DEC-004] - 2026-05-15 - 固定分屏布局，去掉视图模式切换

**背景**
原始设计有三种视图模式（阅读/编辑/分屏）。用户希望简化为固定分屏。

**决策**
只保留左右固定分屏（编辑 + 预览），去掉视图模式切换。

**理由**
法律文档维护场景的核心需求就是「改了立刻看到效果」，分屏是最直接的方式。多模式切换增加了不必要的 UI 复杂度。

**影响**
移除 `ViewMode` 类型和模式切换按钮。`AppLayout.tsx` 简化为纯分屏布局。

---

### [DEC-005] - 2026-05-15 - 渲染引擎选型：Vditor.preview() 替换 markdown-it

**背景**
v0.1 使用 markdown-it + DOMPurify 渲染 Markdown + HTML，功能可用但缺少 Mermaid 图表、KaTeX 公式、代码高亮等常见 Markdown 特性。v0.2 需要增强渲染能力。

**选项**
1. 继续用 markdown-it + 插件 — 需要逐一集成 Mermaid/KaTeX/highlight.js，维护成本高
2. Vditor.preview() — 静态渲染方法，独立于编辑器使用，自带 Lute 引擎 + 所有高级渲染
3. Milkdown（ProseMirror）— 所见即所得编辑器，但当前只需渲染不需要编辑

**决策**
采用 Vditor.preview()（方案 2）。

**理由**
Vditor.preview() 是纯渲染方法，不需要引入完整编辑器。实测可渲染 HTML table（rowspan/colspan），自带 Mermaid/ECharts/KaTeX/highlight.js/outline。MIT 协议。保留自己的布局和 CodeMirror 编辑器，只替换渲染层，改动最小。静态资源本地化到 `public/vditor/dist/`，桌面应用不依赖外部 CDN。

**影响**
- `PreviewPane.tsx` 改用 `Vditor.preview()` 替换 markdown-it + DOMPurify
- `markdownService.ts` 不再使用（Vditor 自带 Lute 引擎）
- `sanitizeService.ts` 不再直接调用（Vditor 内置 sanitize: true）
- CSS 选择器从 `.preview-document` 改为 `.preview-content`
- CSP 需保留 `'unsafe-eval'`（Vditor 动态加载资源需要）

## 第二部分：工作日志

### 2026-05-18 18:52 (Codex)

- **目标:** 修复源码模式长文档无法滚动的问题
- **操作:**
  1. 新增 E2E 回归测试：源码模式插入 140 行内容后，`.cm-scroller` 必须可滚动到底部
  2. 复现问题：CodeMirror 的滚动层高度随内容增长到 2554px，`scrollHeight === clientHeight`，外层被裁剪导致用户只能看到开头
  3. 修复 `EditorPane` CSS：为 `.editor-pane`、CodeMirror wrapper 和 `.cm-editor` 补齐 `min-height: 0` / flex 高度约束，并让 `.cm-scroller` 承担内部滚动
- **结果:** ISS-040 已修复并归档，目标 E2E 已由失败转为通过。
- **下一步:** 后续调整源码模式布局时，必须保留 `.cm-scroller` 作为唯一纵向滚动容器。

### 2026-05-18 18:42 (Codex)

- **目标:** 修复顶部 overlay 标题栏/工具栏区域无法可靠拖动窗口的问题
- **操作:**
  1. 新增 `titlebarDrag` 单元测试，覆盖空白区域拖动、双击最大化和按钮点击不触发拖动
  2. 实现 `handleTitlebarMouseDown()`，过滤交互元素后调用 Tauri window `startDragging()` / `toggleMaximize()`
  3. 将 fallback 接入 `Toolbar` 根节点，并保留原有 `data-tauri-drag-region`
  4. 更新 E2E 标记检查，确认 Toolbar 有手动拖动 fallback
- **结果:** ISS-039 已修复并归档。顶部栏空白区域现在有原生 drag-region + JS fallback 两条路径。
- **下一步:** 打包后在真实 macOS 窗口中手动验证拖动手感；如仍有局部问题，优先检查具体命中区域是否为交互元素。

### 2026-05-18 18:32 (Codex)

- **目标:** 修复大纲栏过小和原生 HTML 表格在默认 WYSIWYG 中阅读退化的问题
- **操作:**
  1. 先补 `documentViewMode` 单元测试，覆盖普通 Markdown、Markdown pipe table、原生 HTML table、fenced HTML 示例和 `.html` 文件
  2. 新增 E2E：原生 HTML table 必须自动进入稳定阅读预览且表格宽度不被压窄；大纲栏默认宽度、字号和行距必须达到新尺度
  3. 新增 `documentViewMode.ts`，检测原生 `<table>` 和 `.html` 文件，决定是否阅读优先
  4. 恢复 `PreviewPane` 作为复杂 HTML 文档的主阅读路径，使用 `Vditor.preview()`、本地 `/vditor` 资源和 Folia 预览样式
  5. 调整大纲栏宽度、标题字号、条目字号、行距和缩进
- **结果:** ISS-037 / ISS-038 已修复并归档。普通 Markdown 仍默认 WYSIWYG；复杂 HTML 表格默认稳定阅读预览，源码模式负责编辑。
- **下一步:** 后续如继续增强 HTML 表格编辑，应做专门的表格编辑工具，不再依赖通用 WYSIWYG round-trip。

### 2026-05-18 18:05 (Codex)

- **目标:** 记录用户对当前默认 WYSIWYG 界面和大纲栏的回归反馈
- **操作:**
  1. 通过桌面观察当前已打开的 Folia 窗口，确认大纲栏默认宽度和字号偏小
  2. 观察 `260512 证据目录.md` 的 HTML 表格在默认 WYSIWYG 区域中被压成极窄列，单元格内容接近逐字换行
  3. 按 `docs/ISSUES.md` 约定只记录、不直接修复，新增 ISS-037 与 ISS-038
- **结果:** 已将大纲视觉尺度问题和 HTML 表格预览回归登记到待处理 issue。ISS-038 标为高优先级，因为它影响 Folia 最核心的复杂 HTML 表格阅读场景。
- **下一步:** 用户确认进入修复后，优先恢复稳定 HTML 预览路径，再统一调整 WYSIWYG、源码模式、Word 预览和大纲栏的职责与视觉比例。

### 2026-05-18 17:48 (Codex)

- **目标:** 参考 Funes 为 Folia 接入自动更新和更完整的 Settings / 关于入口
- **操作:**
  1. 对照 Funes 的 updater 实现，接入 Tauri updater / process 插件和权限
  2. 新增 `updateService`，封装检查更新、下载、安装和 relaunch，浏览器预览下返回 unsupported
  3. `AppLayout` 启动后延迟自动检查更新，并在发现新版本时显示安装对话框
  4. Settings 新增“关于”页面，提供版本、自动检查更新开关、手动检查更新和 GitHub Releases 信息
  5. 生成 Folia updater 公钥配置，私钥保存在 `~/.tauri/folia.key`
  6. 新增 `tauri:build:update` 与 `updater:manifest` 发布脚本，生成签名 artifact 和 `darwin-aarch64.json`
- **结果:** 自动更新模块、设置入口和发布产物生成链路已接入。普通 Tauri 打包和签名 updater 打包均验证通过。
- **下一步:** 发布到 GitHub Release 时上传 `Folia.app.tar.gz`、`Folia.app.tar.gz.sig` 和 `darwin-aarch64.json`。

### 2026-05-18 16:04 (Codex)

- **目标:** 改善 Toolbar 图标的设计感和语义区分度
- **操作:** 在不新增图标库的前提下，改用 lucide 中更统一的文件流转图标：file input、file check、files、file output、square code、file search、list collapse、sliders，并将按钮容器调整为 34px、图标调整为 19px，微调 hover 与 active 边框反馈。
- **结果:** 顶部工具栏不再依赖书本、齿轮、代码标签等普通符号，文件操作和视图操作的视觉语言更统一。
- **下一步:** 如继续打磨，可考虑为打开/保存/导出增加短暂状态反馈，但不应常驻文字标签。

### 2026-05-18 15:56 (Codex)

- **目标:** 修复用户编译后反馈的桌面壳、拖拽打开和 Word 预览还原度问题
- **操作:**
  1. Toolbar 去掉 Folia 应用名，文件操作图标替换为更明确的打开、保存、另存为、导出 Word 语义
  2. 调整 Toolbar 拖动层和 pointer-events，让控件之间的空白区域可拖动窗口
  3. 新增 `fileDrop.ts`，并在 Tauri 环境下使用原生拖放事件打开 Markdown / HTML / Word 文件
  4. 将 WYSIWYG 内部白色画布改为透明暖底，保留 Word 预览中的白色 A4 纸张
  5. Word 预览改为真实 A4 页面整体缩放，并读取更多导出预设样式（标题、段落、表格、图片）
  6. 默认窗口尺寸调整为 `980×680`，并补充单元测试、E2E 与文档记录
- **结果:** 用户反馈的桌面体验问题已修复，`npm run build`、`npm run lint`、`npm test`、`npm run test:e2e` 均通过。
- **下一步:** 后续可继续完善 WYSIWYG 表格编辑交互和复杂 HTML 块的编辑提示。

### 2026-05-17 22:25 (Codex)

- **目标:** 实现 v0.3 第一阶段：默认所见即所得编辑 + 按需 Word 纸张预览
- **操作:**
  1. 新增 Vditor WYSIWYG 编辑器组件，默认占满主内容区，Markdown 源码仍通过输入回调同步到应用状态
  2. 保留 CodeMirror 源码编辑器作为工具栏 fallback，切换时不丢失内容
  3. 新增 Word 纸张预览组件，按需打开右侧可拖拽面板，基于导出预设渲染 A4、页边距、字体、图片宽度和表格样式
  4. 移除主界面对普通 Markdown 预览组件的依赖，避免默认分屏心智负担
  5. 增加单元测试和 E2E：验证默认不显示 Word 预览、源码切换、Word 预览按需加载、复杂 HTML table 在 WYSIWYG 和 Word 预览中正常渲染
- **结果:** v0.3 第一阶段功能已实现，HTML 表格核心能力保留。
- **下一步:** 继续优化 WYSIWYG 内部工具体验和复杂 HTML 块的编辑提示。

### 2026-05-17 22:05 (Codex)

- **目标:** 评估 Typora-like 所见即所得编辑与右侧 Word 导出预览的新产品方向
- **操作:**
  1. 对照 `docs/ROADMAP.md` 中 v0.3 所见即所得任务和 v0.6 Word 导出链路现状
  2. 检查 `md2word` 项目，确认可复用重点是 A4/页边距/图片/表格/模板等 Word 版式规则，而不是旧 Python sidecar 前端架构
  3. 明确 v0.3 改造方向：Markdown 源码为可信数据源，默认所见即所得，源码模式 fallback，右侧改为 Word 纸张预览
  4. 更新 `docs/ROADMAP.md` 与本决策记录
- **结果:** 新方向已进入 Roadmap，并明确不默认引入 Python sidecar，继续保护 Folia 的轻量启动目标。
- **下一步:** 先做 WYSIWYG 技术选型 spike，再实现 Word 纸张预览组件与复杂表格一致性测试。

### 2026-05-17 21:42 (Codex)

- **目标:** 修正应用图标四角圆角不完整
- **操作:**
  1. 重新检查 `docs/icon.png` 与 `src-tauri/icons/icon.png` 的四角像素，确认上一版只有左上角透明，其余三角仍是实色奶油背景
  2. 全局移除外层背景色，生成四角均为透明 alpha 的 1024px 源图
  3. 用 `tauri icon` 重新生成 PNG、ICNS、ICO 和 Windows tile 图标，并移除未使用的 Android/iOS 生成目录
  4. 提取 `icon.icns` 内所有尺寸 PNG，验证四个角均为透明 alpha
- **结果:** 应用图标的四个外角现在全部透明，Dock / Finder 中应显示完整圆角而不是单角圆角。
- **下一步:** 若 macOS 仍显示旧图标，重新安装 DMG 或清理系统图标缓存。

### 2026-05-17 21:38 (Codex)

- **目标:** 修复 macOS 原生标题栏与 Folia 主界面不融合的问题
- **操作:**
  1. 将 Tauri 主窗口改为 `titleBarStyle: Overlay`，隐藏原生标题，设置红黄绿窗口按钮位置和窗口背景色
  2. 在前端启动时标记 Tauri/macOS 运行环境，浏览器预览不受 macOS 标题栏适配影响
  3. Toolbar 增加 `data-tauri-drag-region` 透明拖拽层，并在 Tauri + macOS 下为系统窗口按钮预留 92px 左侧空间
  4. 重新打包并实际打开生成的 `Folia.app` 检查窗口外观
- **结果:** 独立黑色系统标题栏已消失，红黄绿窗口按钮浮在 Folia 顶部工具区内，顶部背景与主界面融合。
- **下一步:** 如果后续调整 Toolbar 高度，需要同步检查 `trafficLightPosition` 的 y 坐标。

### 2026-05-17 21:26 (Codex)

- **目标:** 修复用户反馈的主界面与 Settings 视觉/交互问题
- **操作:**
  1. 放大 Toolbar 高度、按钮容器、lucide 图标与 wordmark，补齐只看编辑 / 分屏 / 只看预览三种视图按钮
  2. 在 `AppLayout` 中新增面板模式状态和中间 resizer 拖拽逻辑，拖拽范围限制在 28%–72%，双击恢复默认比例
  3. 将 Settings 弹窗改为固定宽高，放大导航与表单层级，并用自定义 select 样式替代 macOS 原生渐变光泽
  4. 覆盖 Vditor 默认表格 `nowrap` 样式，让长 HTML 证据目录在预览区内自动压缩换行
  5. 新增 Playwright 布局回归测试，覆盖视图切换、分栏拖拽、Settings 固定尺寸与长表格换行
- **结果:** 用户反馈的四类 UI 问题已修复，且不影响已有冷启动按需加载策略。
- **下一步:** 后续如继续优化桌面质感，可优先微调 Settings 空白比例和大纲面板归属。

### 2026-05-17 21:14 (Codex)

- **目标:** 收尾图标修复并稳定验证链路
- **操作:**
  1. 重新检查打包后的 `Folia.app/Contents/Resources/icon.icns`，确认所有尺寸角落均为透明 alpha
  2. 修复 Node 25 测试环境中全局 `localStorage` 干扰 jsdom 的问题，新增 Vitest jsdom 配置与测试专用内存存储
  3. 将 `src-tauri/target`、`src-tauri/gen`、Playwright 报告目录等生成物加入 ESLint 全局忽略，避免打包后 lint 扫描二进制/压缩资产
  4. 重新运行 build、lint、unit test、e2e 与 diff 检查
- **结果:** 图标圆角资产已进入最终 App 包；验证链路在打包后仍可重复运行。
- **下一步:** 如本机 Dock 仍显示旧图标，优先重新安装新 DMG 或清理 macOS 图标缓存。

### 2026-05-17 21:05 (Codex)

- **目标:** 修复应用图标圆角未生效
- **操作:**
  1. 检查 `src-tauri/icons/icon.png`，确认图标虽然画有圆角白色底板，但最外层角落是实色奶油背景而非透明 alpha
  2. 用 ImageMagick 将外层连续背景转为透明，生成透明圆角源图
  3. 用 `tauri icon` 重新生成 macOS `.icns`、Windows `.ico`、Tauri PNG 与 Windows tile 图标
  4. 同步更新 README 使用的 `docs/icon.png`
  5. 更新 DESIGN / CHANGELOG
- **结果:** `icon.icns` 提取出的各尺寸 PNG 角落均为透明 alpha；Dock / Finder 应显示为圆角图标而不是方形奶油底。
- **下一步:** 打包后如 macOS 仍显示旧图标，需要清理系统图标缓存或换 bundle 版本重新安装。

### 2026-05-17 19:32 (Codex)

- **目标:** 完成 ISS-028 的端到端回归保护
- **操作:**
  1. 新增 `@playwright/test` 开发依赖与 `npm run test:e2e` 脚本
  2. 新增 `playwright.config.ts`，由 Playwright 自动启动 Vite 测试服务器
  3. 新增 `e2e/preview-resources.spec.ts`，覆盖空文档冷启动、普通 Markdown、Mermaid-only、普通代码块四类资源加载场景
  4. 更新 ARCHITECTURE / CHANGELOG / ISSUES
- **结果:** ISS-028 已完成并归档。资源加载策略已有自动化回归保护：空文档不加载 CodeMirror/Vditor；普通 Markdown 不加载 Vditor i18n/icon/content-theme/highlight 主脚本；Mermaid-only 不加载 highlight.js；普通代码块仍加载 highlight.js。
- **下一步:** 后续若再裁剪 MathJax、Graphviz、Markmap 等高级资源，应先新增对应 E2E 样例，再做资源取舍。

### 2026-05-17 19:19 (Codex)

- **目标:** 继续推进 ISS-028，减少纯预览链路的 Vditor 附加请求
- **操作:**
  1. 审计 Vditor.preview 的 i18n、icon 和 content-theme 加载逻辑
  2. 新增 `vditorPreviewConfig`，将中文预览文案作为按需加载的小 chunk 提供给 Vditor，避免请求 `/vditor/dist/js/i18n/zh_CN.js`
  3. 在 `PreviewPane` 中传入 `icon: undefined`，让 Vditor 使用内置 SVG fallback，避免请求 `/vditor/dist/js/icons/ant.js`
  4. 将 Vditor content theme path 置空，由 Folia 自有 `preview.css` 接管预览视觉，避免请求 `/vditor/dist/css/content-theme/light.css`
  5. 用 Playwright 验证普通 Markdown 和 Mermaid 文档不再加载 i18n/icon/content-theme 资源；Mermaid 与基础预览仍正常触发
- **结果:** 非空预览的固定 Vditor 资源请求进一步减少。空文档冷启动仍不加载 Vditor、CodeMirror 或预览配置；普通代码高亮主题 CSS 暂时保留，因为 Vditor 内部会无条件注入该样式，绕过它需要更侵入的渲染链路改造。
- **下一步:** 若继续推进 ISS-028，优先补 Playwright 自动回归测试，而不是继续裁剪高级渲染资源。

### 2026-05-17 18:21 (Codex)

- **目标:** 推进 ISS-028 的第一阶段资源触发优化
- **操作:**
  1. 审计 Vditor.preview 的资源加载逻辑，确认 Mermaid、KaTeX、Graphviz、Markmap 等高级渲染器本身会在 DOM 中存在对应语法时才加载资源
  2. 新增 `markdownFeatureDetector`，扫描 Markdown fenced code 类型，区分普通代码块与 Vditor 自渲染代码块
  3. `PreviewPane` 根据探测结果启用或禁用普通 `highlight.js` 脚本；仅包含 Mermaid/math/Graphviz/Markmap 等自渲染块时不加载普通高亮脚本，普通代码块仍保持高亮
  4. 新增 Vitest 覆盖普通文档、普通代码块、Mermaid/math 块、混合代码块
  5. 用 Playwright 验证 Mermaid-only 文档加载 Mermaid 但不加载 `highlight.min.js`，普通 `ts` 代码块仍加载 `highlight.min.js`
- **结果:** ISS-028 进入进行中状态，已完成内部动态判断的第一步；没有新增用户设置，也不牺牲内容完整性。
- **下一步:** 继续评估 Vditor preview 是否可安全跳过 i18n/icon 脚本，或补充端到端回归样例后再考虑安装包资源裁剪。

### 2026-05-17 18:14 (Codex)

- **目标:** 记录后续高级 Markdown 资源优化方向
- **操作:** 在 `docs/ISSUES.md` 新增 ISS-028，明确不向用户暴露“极速/完整”模式，后续通过内部内容探测和按需加载推进，同时默认保护完整渲染能力。
- **结果:** 后续优化有明确边界：优先动态判断，避免增加用户心智负担；只有在不影响启动速度或内容完整性的前提下才裁剪资源。
- **下一步:** 推进 ISS-028 时先审计 Vditor 各高级资源的触发条件，再用包含 Mermaid、KaTeX、MathJax、Graphviz、Markmap、代码高亮的样例验证。

### 2026-05-17 18:08 (Codex)

- **目标:** 完善 Folia 启动加速收尾
- **操作:**
  1. 将 `fileService` 从主入口静态依赖改为事件触发时动态导入，打开、保存和自动保存时才加载 Tauri dialog/fs 相关代码
  2. 将 `.docx` 预览组件拆为懒加载，普通 Markdown 首屏不加载 Word 预览 UI
  3. 空文档不再自动预热 CodeMirror，改为打开非 docx 文件或用户点击/聚焦编辑区时加载编辑器
  4. 精简 `public/vditor/dist/`，移除运行时不引用的 TS/type 声明和未压缩 Vditor 构建文件，保留 Mermaid/KaTeX/highlight.js 等阅读能力资源
  5. 用 Playwright 验证空文档首屏不加载 CodeMirror/Vditor，点击编辑区后才加载编辑器，输入内容后才加载 Vditor 预览资源
  6. 更新 ARCHITECTURE / CHANGELOG
- **结果:** 主入口 JS chunk 维持约 206KB，Vditor 本地静态资源从约 23MB 降到约 21MB。`npm run build`、`npm run lint`、`npm test`、`cargo check --manifest-path src-tauri/Cargo.toml`、`npm audit --audit-level=moderate`、`git diff --check` 均通过。Vite 仍提示 `EditorPane` chunk 超过 500KB，但该 chunk 已不在空文档冷启动路径中。
- **下一步:** 若继续追求安装包体积，可在确认取舍后按功能开关进一步裁剪 Vditor 的 MathJax、Graphviz、Markmap 等高级预览资源。

### 2026-05-17 17:42 (Codex)

- **目标:** 继续优化 Folia 冷启动速度
- **操作:**
  1. `PreviewPane` 空内容时跳过 Vditor 加载，并用 `useDeferredValue` 降低预览更新优先级
  2. Vditor JS/CSS 改为内容非空时动态加载，首屏 CSS 从 44KB 降到约 10KB
  3. `EditorPane` 与 `SettingsPage` 改为 `React.lazy()`，CodeMirror 编辑器从首屏路径移出，用户点击编辑区可立即加载
  4. “重新打开上次文件”延迟到启动后的空闲时段，避免大文件读取/转换阻塞 shell
  5. 移除遗留 `markdown-it` / `@types/markdown-it` 依赖和 `markdownService.ts`
  6. 更新 ARCHITECTURE / CHANGELOG
- **结果:** 主入口 JS chunk 从优化前约 834KB 降到约 212KB；首屏 CSS 从约 44KB 降到约 10KB。构建仍提示 `EditorPane` chunk 超过 500KB，但该 chunk 已移出冷启动关键路径。`npm run build`、`npm run lint`、`npm test`、`cargo check`、`npm audit --json` 均通过。
- **下一步:** 如需继续降低安装包体积，可精简 `public/vditor/dist/` 的未用静态资源；如需继续降低编辑器 chunk，可评估 CodeMirror extension 细分或阅读优先模式。

### 2026-05-17 17:21 (Codex)

- **目标:** 修复稳定性问题并现代化主界面设计
- **操作:**
  1. 新增 Vitest 与服务层测试，覆盖 HTML 清洗、设置读取/迁移/持久化
  2. 修复 `npm run build` 类型错误：`docx` 类型、未使用导入、图片与表格类型、`markdown-it` 类型声明
  3. 修复 `npm run lint`：忽略 `public/vditor/dist/` 第三方资源，调整 React Hooks 规则问题
  4. `.docx` 预览接入 DOMPurify，避免 Mammoth HTML 直接注入
  5. Settings 接入运行时行为：自动保存、重新打开上次文件、默认编码、编辑器字体/拼写检查、预览字体/宽度
  6. Toolbar 改为 lucide 图标按钮，预览 CSS 统一使用 DESIGN.md 变量；Word 导出、docx 预览、Vditor 改为按需加载
  7. 新增 `package-lock.json` 固定依赖版本，更新 CHANGELOG 与 ISSUES 状态
- **结果:** ISS-022 ~ ISS-027 已修复归档；`npm run build`、`npm run lint`、`npm test`、`cargo check`、`npm audit --json` 均通过。Vite 仍提示主入口 chunk 超过 500KB，当前已通过按需加载拆出 Vditor、Word 导出和 docx 预览，剩余主要来自首屏编辑器依赖。
- **下一步:** 可继续做包体精细拆分或补充端到端测试覆盖打开/保存/导出完整流程

### 2026-05-17 17:01 (Codex)

- **目标:** 审查项目稳定性、可优化点和现代化设计空间
- **操作:**
  1. 查阅 ROADMAP / ISSUES / DESIGN，确认当前阶段和设计约束
  2. 检查核心路径：文件打开保存、Vditor 预览、CodeMirror 编辑、Settings、Word 导出与 docx 预览
  3. 执行验证：`npm run build`、`npm run lint`、`npm audit --json`、`npm outdated --json`、`cargo check`
  4. 启动 Vite 本地界面，用 Playwright 检查主界面与 Settings 弹窗视觉表现
  5. 将审查发现录入 `docs/ISSUES.md`：ISS-022 ~ ISS-027
- **结果:** Rust 侧 `cargo check` 通过，npm audit 无漏洞；前端 build 与 lint 当前失败，且存在 docx 预览安全边界、设置项未接入运行时、设计系统实现落差、缺少锁文件与自动化测试等问题
- **下一步:** 建议先处理 Group A（ISS-022/ISS-023）恢复构建与 lint，再处理 ISS-024 的 docx HTML 清洗，最后分批补齐 Settings 行为和 UI 现代化

### 2026-05-16 18:30 (Claude)

- **目标:** 修复测试发现的 Bug + Settings 弹窗化 + 补充设置项
- **操作:**
  1. 修复 CSS 设计系统不渲染（main.tsx 缺少 app.css import）
  2. 移除 parser.ts/chart-handler.ts 中未使用的 BorderType 导入
  3. 图标 RGBA 转换 + 奶油色背景（修复 Tauri 构建失败）
  4. 创建 Issue #7 + PR #8：Settings 从全屏页面改为弹窗浮层，补充 General/编辑器/预览设置项
  5. Settings 弹窗：半透明遮罩 + ESC/点击关闭 + 640px 宽 + 5px 圆角
  6. 新增设置：Auto-save、Default encoding、Reopen last file、Font family、Spell check、Preview font、Preview width
- **结果:** PR #8 squash 合并，Issue #7 关闭

### 2026-05-16 (Claude)

- **目标:** v0.6 后续优化 — 图片嵌入导出 + Settings 预设选择器
- **操作:**
  1. 创建 GitHub Issue #1（图片嵌入）和 #2（Settings 预设选择器）
  2. 并行启动两个 worktree agent，各自创建 feature branch + PR
  3. PR #3（Settings 预设选择器）：新增 SettingsPage + ExportSection，遵循 DESIGN.md 规范，code review 后 squash 合并
  4. PR #4（图片嵌入）：重写 addImage 为 async，支持本地路径（Tauri readFile）、Data URI（base64 解码）、HTTP 降级，JPEG/PNG/GIF/BMP 二进制头解析获取原始尺寸，code review 后 squash 合并
- **结果:** 全部 v0.6 任务完成，无剩余 issue

### 2026-05-16 (Claude)

- **目标:** 规划 v0.6 Word 导出与预览功能
- **操作:**
  1. 调研 md2word Skill 项目（Python 模块结构、配置体系、5 个预设）
  2. 调研 npm `docx` 包和 `mammoth` 包的 JS 生态能力
  3. 确认纯 JS/TS 方案可行性（docx npm 与 python-docx 功能对等）
  4. 设计四阶段实现方案（转换引擎 → 导出 UI → Word 预览 → 预设设置）
  5. 更新 ROADMAP / DECISIONS / ISSUES 上下文文件
- **结果:** v0.6 方案确定，全部任务已记录到 ISSUES.md
- **下一步:** 按阶段执行，阶段一（转换引擎）为后续所有阶段的前置依赖

### 2026-05-15 21:30 (Claude)

- **目标:** v0.2 渲染引擎升级 — 用 Vditor.preview() 替换 markdown-it + DOMPurify
- **操作:**
  1. 调研 Vditor 项目，确认 Vditor.preview() 静态方法可独立于编辑器使用
  2. 创建 VditorTest.tsx 测试组件，验证 HTML table（rowspan/colspan）渲染、三种编辑模式、静态预览
  3. 复制 Vditor 静态资源（node_modules/vditor/dist/）到 public/vditor/dist/，实现本地 CDN
  4. 改写 PreviewPane.tsx，用 Vditor.preview() 替换 markdown-it → DOMPurify → dangerouslySetInnerHTML 链路
  5. 更新 preview.css 选择器适配 Vditor DOM 结构
  6. 收紧 CSP 配置（移除 https: 通配，保留 unsafe-eval）
  7. 清理测试代码，恢复 App.tsx 指向 AppLayout
  8. 更新 ROADMAP / DECISIONS / CHANGELOG / ARCHITECTURE / CLAUDE.md
- **结果:** v0.2 完成。TypeScript 类型检查通过，应用启动正常，标题/列表/代码高亮/表格/大纲均验证通过
- **下一步:** v0.3 所见即所得编辑体验（方案待定）

### 2026-05-15 16:30 (Claude)

- **目标:** 基于 HTML Markdown Reader 开发规格创建项目
- **操作:**
  1. 用 Vite 脚手架创建 React + TS 项目，再用 `tauri init` 加入 Tauri v2
  2. 安装 markdown-it, DOMPurify, CodeMirror 6, Tauri 插件（dialog/fs/opener）
  3. 按规格实现服务层（markdownService, sanitizeService, fileService, printService, submitModeService）
  4. 实现 UI 组件（Toolbar, EditorPane, PreviewPane, ModeSwitcher, StatusBar）
  5. 配置样式（法律文档表格 CSS, 打印 CSS, 应用布局 CSS）
- **结果:** TypeScript + Rust 编译通过，应用可启动
- **下一步:** 等待用户反馈

### 2026-05-15 17:00 (Claude)

- **目标:** 根据用户反馈简化项目
- **操作:**
  1. 移除提交模式、打印功能、视图模式切换
  2. 固定为左右分屏布局
  3. 添加 TOC 大纲面板
  4. 添加文件拖拽打开
  5. 重命名为 Folia
  6. 更新为 Typora 风格简洁样式
  7. 创建 README，初始化 git，推送到 GitHub
- **结果:** 项目简化完成，仓库 https://github.com/cat-xierluo/Folia 已上线
- **下一步:** 补全项目文档（ROADMAP, ARCHITECTURE, DECISIONS）
