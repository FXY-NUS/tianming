# Codex Workflow

> Codex 运行在用户本地 Windows workspace。把它视为“本地开发模式”，必须主动保持本地仓库与 GitHub 一致。

## 1. 接手检查

开始写代码前先读：

1. `doc/agent-workflow.md`
2. `doc/codex-workflow.md`
3. `doc/HANDOFF.md`
4. 当前 Phase notes，例如 `doc/scoring-rubric.md` 和 `doc/phase-4-notes.md`

然后检查本地仓库：

```powershell
git status --short --branch
git log --oneline --decorate -5
```

如果看到未提交改动，先阅读受影响文件，不要覆盖本地已有工作。

## 2. GitHub Merge 后同步本地

如果用户说 GitHub PR 已经 merge，Codex 应主动同步本地，不要求用户手动处理：

```powershell
git status --short --branch
git fetch origin
git checkout main
git merge --ff-only origin/main
git status --short --branch
```

如果 `merge --ff-only` 失败，说明本地和 GitHub 已分叉。此时先停下来说明情况，不要擅自 merge、rebase、reset 或删除分支。

本地 `main` 与 `origin/main` 对齐后，再从最新 `main` 创建下一条开发分支。

## 3. Branch / PR 规则

- 默认分支名前缀使用 `codex/`，例如 `codex/phase-x-short-name`。
- 每个 Phase 或明确子任务独立分支。
- commit 使用 conventional commits。
- 本地验证通过后 push 到 GitHub。
- 如果本机没有 `gh` CLI，就把 GitHub PR 创建链接发给用户。
- 用户在 GitHub merge 后，下一轮由 Codex 执行第 2 节的本地同步。

## 4. SSH 规则

本 repo 远端优先使用 SSH。只记录检查方法，不记录任何密钥值：

```powershell
git remote -v
git config core.sshCommand
```

期望形态：

```text
origin ssh://git@github.com/FXY-NUS/tianming.git
core.sshCommand C:/Windows/System32/OpenSSH/ssh.exe
```

安全规则：文档可以写“使用 SSH remote”和“如何检查配置”，但绝不能写入 SSH private key、API key、access token 或 `.env.local` 内容。

如果 `fetch` 或 `push` 被 Codex 沙箱或网络限制拦截，按工具提示请求授权后重试同一条 Git 命令。

## 5. Windows 命令

PowerShell 下统一使用：

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

避免直接使用 `npm`，防止 `npm.ps1` 执行策略问题。

## 6. 提交前验证

代码变更提交前运行：

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

当前 lint baseline 允许 warning，但不能有 error。新增代码尽量不要增加新的 warning。

已知 Codex 本地问题：Vitest / Vite 可能因为沙箱读取 `vite.config.ts` 失败，常见表现包括 `Cannot read directory "../../.."` 或无法解析 Vite config。解决方式是按工具规则授权后，重跑同一条 `npm.cmd run test`。

文档-only 变更至少运行 `git diff --check`。如果本轮包含代码变更，仍要跑完整 test / lint / build。

## 7. 本地与云端一致性

Codex 对用户本地 workspace 的一致性负责：

- GitHub 端已经 merge 后，先同步本地 `main`，再继续新工作。
- 不在已经 merge 的旧 feature branch 上继续开发。
- 除非出现分叉需要决策，不要求用户手动处理本地同步。
- 不为了“方便同步”把任何密钥或本地环境文件写入 repo。
