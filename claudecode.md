# Claude Code Workflow

> Claude Code 运行在云端 GitHub workspace。把它视为“云端开发模式”，以 GitHub 仓库状态为准，不依赖用户本地机器。

## 1. 接手检查

开始写代码前先读：

1. `doc/agent-workflow.md`
2. `claudecode.md`
3. `doc/HANDOFF.md`
4. 当前 Phase notes，例如 `doc/scoring-rubric.md` 和 `doc/phase-4-notes.md`

Claude Code 应以云端 workspace 当前可见的 GitHub 仓库状态作为 source of truth。

## 2. Claude Code 不应假设

Claude Code 不应假设自己能读取：

- 用户本地 Windows 文件系统。
- 用户本地未提交改动。
- 用户本地 SSH key 文件或 ssh-agent。
- 用户本地 `.env.local`。
- 本地浏览器状态、本地 dev server 或 Codex desktop sandbox 授权状态。

不要为了 Claude Code 开发要求用户同步本地文件。本地同步是 Codex 的职责，不是 Claude Code 的职责。

## 3. GitHub 工作流

- 从云端 workspace 可见的最新 GitHub 分支状态开始。
- 每个 Phase 或明确子任务使用独立 feature branch。
- commit 使用 conventional commits，例如 `feat:`、`fix:`、`docs:`、`refactor:`、`test:`。
- 在云端环境创建或更新 GitHub PR。
- PR 在 GitHub merge 后，Claude Code 可以直接从更新后的 GitHub 状态继续；它不需要更新用户本地 checkout。

## 4. 验证

在云端环境运行仓库常规验证：

```bash
npm run test
npm run lint
npm run build
```

如果云端环境实际是 Windows PowerShell，再使用 `doc/codex-workflow.md` 中的 `npm.cmd run ...` 写法；否则普通 `npm run ...` 即可。

## 5. 密钥与隐私规则

- 不硬编码 Gemini API key。
- 不 commit `.env.local`。
- 不把 SSH private key、API key、token 或任何密钥值写入 repo 或文档。
- 简历原文件默认私有，不应上传或提交。
- 浏览器扩展不直连 Gemini。
- 浏览器扩展不自动爬取或批量打开 JD 详情页。

## 6. 与 Codex 的边界

Claude Code 和 Codex 可以共同开发同一个 GitHub repo，但不能共享本地假设：

- Claude Code 负责云端 GitHub 修改和 PR。
- Codex 负责用户本地 workspace，以及 GitHub merge 后的本地同步。
- 如果从 Claude Code 切换到 Codex，Codex 应先 fetch 并快进本地 `main`，再从最新 `main` 开新分支。
- 如果从 Codex 切换到 Claude Code，Claude Code 应从已 push 的 GitHub 分支或最新 GitHub `main` 开始。
