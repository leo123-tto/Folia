# Folia 任务清单

> 待处理任务、缺陷修复、技术债清理和未归属 Roadmap 的工作项。
> 已完成的任务归档到下方进度日志，并在 CHANGELOG.md 记录变更。

## 执行策略说明

基于 `parallel-agent-workflow` Skill 的三级路由：

| 层级 | 策略 | 适用场景 | 说明 |
|------|------|----------|------|
| L1 | `subagent` | 单文件修改、CSS 微调（≤15 分钟） | 直接修复，无需 Issue/PR |
| L2 | `worktree` | 多文件联动、需独立 git branch（>15 分钟） | Issue → Branch → PR → Review → Merge |
| L3 | `tmux-session` | 复杂功能开发、需独立上下文窗口 + 独立模型选择 | tmux 启动独立 Agent Session |

> **L1 不需要 Issue/PR 流程**，直接在 main 分支修复并提交即可。
> **L2/L3 必须走 Issue → PR → Code Review → Merge 闭环。**

### Issue 分组策略

启动 Batch 修复前，按三维度评估可组合性：

| 维度 | 说明 | 判定规则 |
|------|------|----------|
| 文件重叠度 | 涉及相同文件/组件 | 重叠 → 必须同分支处理 |
| 依赖链 | B 需要 A 的产出 | 有依赖 → 同分支顺序完成 |
| 并行安全度 | 文件集完全不重叠 | 无重叠 → 可并行 worktree |

---

## 待处理

## 进度日志

- **2026-05-20** 完成 ISS-044/048：GitHub Actions 全平台发布工作流（macOS ARM + Intel DMG、Windows EXE/MSI）+ Gitee 同步。关键修复：bun/npm 跨平台 native binding 缺失 → 改用 pnpm；`tauri-action@v0` + `pnpm install` 在每个 CI runner 上正确解析平台依赖
- **2026-05-19** 归档 ISS-042/043/045/046/047：`createUpdaterArtifacts` → true、endpoint → `latest.json`、identifier → `com.folia.reader`、`.gitignore` 排除 `*.key`、`docs/icon.png` 添加圆角。版本升级到 0.3.7
- **2026-05-19** 新增 ISS-048：国内 Gitee 备用更新源。已配置 Gitee endpoint（优先于 GitHub）、GitHub Secrets（`GITEE_TOKEN`/`GITEE_OWNER`/`TAURI_SIGNING_PRIVATE_KEY`）
- **2026-05-19** 推进 ISS-044：创建 `.github/workflows/release.yml`（tag 触发 → 构建 → 签名 → 生成 latest.json → GitHub Release → Gitee 同步）；更新 `create-updater-manifest.mjs` 输出 `latest.json` + `latest-gitee.json`
- **2026-05-18** 归档 ISS-041：Word 预览从单张长页面升级为多页 A4 纸张栈，导出按钮和预设选择跟随 Word 预览面板显示
- **2026-05-18** 归档 ISS-040：源码模式 CodeMirror wrapper 高度链路修复并补充 E2E 测试
- **2026-05-18** 归档 ISS-039：Toolbar 非交互区域新增 `startDragging()` fallback 和 `toggleMaximize()`
- **2026-05-18** 归档 ISS-037/038：原生 HTML 表格走稳定阅读预览；大纲栏尺度放大
- **2026-05-18** 归档 ISS-036：参考 Funes 接入自动更新、Settings / 关于页、签名打包和 manifest 生成
- **2026-05-18** 归档 ISS-035：Toolbar 图标换成统一文件流转语义
- **2026-05-18** 归档 ISS-034：标题栏拖动、拖拽打开、WYSIWYG 背景、Word A4 缩放预览和窗口尺寸修正
- **2026-05-17** 归档 ISS-022 ~ ISS-033：构建/lint/安全/设置/设计/图标/标题栏/视图切换等稳定性修复
- **2026-05-16** ISS-021（Settings 预设选择器 + 图片嵌入导出）通过 PR #3/#4 完成
- **2026-05-16** ISS-001 ~ ISS-020：v0.6 Word 导出与预览功能全部完成
