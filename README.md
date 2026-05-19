<p align="center">
  <img src="docs/icon.png" alt="Folia" width="128" height="128">
</p>

一个轻量的 Markdown 阅读器，支持原生 HTML 渲染。

专为法律文档设计——稳定渲染包含 `rowspan`、`colspan` 等复杂 HTML 表格的 Markdown 文件。

## 功能

- 打开 `.md` / `.markdown` / `.html` 文件（对话框或拖拽）
- 普通 Markdown 默认所见即所得编辑，保留源码模式 fallback
- 原生 HTML 表格文档自动进入稳定阅读预览，完整渲染合并单元格等复杂结构
- 按需打开 Word 多页纸张预览，支持预设选择、自定义 JSON 预设导入和 `.docx` 导出
- 文档大纲（TOC），点击跳转
- 保存 / 另存为
- 启动后延迟自动检查更新，也可在 Settings / 关于中手动检查
- 安全处理：Vditor 内置 XSS 过滤（sanitize: true）

## 技术栈

- Tauri v2
- React 19 + TypeScript
- Vite 8
- Vditor.preview()（Lute 引擎 + 代码高亮 / Mermaid / KaTeX）
- CodeMirror 6
- Tauri updater plugin

## 开发

```bash
cd folia
npm install
npm run tauri dev
```

## 构建

```bash
npm run tauri build
```

发布自动更新产物时，需要提供 Tauri updater 私钥：

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/folia.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri:build:update

npm run updater:manifest
```

## 许可

Apache License 2.0
