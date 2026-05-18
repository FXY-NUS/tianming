# Agent Workflow SOP

> 每次接手 Tianming 开发前都要先读本文件，再读 `doc/HANDOFF.md` 和当前 Phase notes。

## 1. GitHub / 本地同步

本项目采用 GitHub PR 合并，`main` 始终代表最新稳定线。

每次开始写代码前先执行：

```powershell
git status --short --branch
git fetch origin
git checkout main
git merge --ff-only origin/main
git status --short --branch
```

如果用户说「GitHub 已 merge」：

1. 不要继续在旧 feature branch 上开发。
2. 先执行上面的同步流程。
3. 确认 `main...origin/main` 干净同步后，再从最新 `main` 开新分支。

如果 `merge --ff-only` 不能快进，说明本地和 GitHub 出现分叉，先停下来说明情况，不要强行 merge/rebase/reset。

## 2. SSH 规则

远端应走 SSH：

```powershell
git remote -v
git config core.sshCommand
```

当前期望形态：

```text
origin ssh://git@github.com/FXY-NUS/tianming.git
core.sshCommand C:/Windows/System32/OpenSSH/ssh.exe
```

重要安全规则：

- 不要把 SSH private key、API key、token、`.env.local` 内容写进 repo 或文档。
- 文档里只记录「使用 SSH remote」和「如何检查配置」，不记录任何密钥值。
- 如果 push/fetch 被沙箱网络拦截，按工具提示请求授权重试。

## 3. Branch / PR 工作流

1. 从最新 `main` 开分支：`codex/phase-x-short-name`。
2. 每个 Phase 或明确子任务单独分支。
3. commit 使用 conventional commits，例如 `feat:` / `fix:` / `docs:` / `test:`。
4. push 后如果本机没有 `gh` CLI，就把 GitHub 提供的 PR 创建链接发给用户。
5. 用户在 GitHub merge 后，下一轮由助手主动同步本地 `main`，不要求用户手动处理本地同步。

## 4. Windows 命令约定

Windows PowerShell 下使用：

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

避免直接用 `npm`，防止 `npm.ps1` 执行策略问题。

## 5. 提交前验证

每次提交前跑：

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

当前已知 lint baseline：允许 warning，但不能有 error。新增代码尽量不要增加新的 lint warning。

Vitest / Vite 在沙箱内可能因为读取 `vite.config.ts` 被拦截；如果出现 `Cannot read directory "../../.."` 或无法解析 Vite config，按工具规则请求授权后重跑。

## 6. 隐私和产品红线

- 不硬编码 Gemini API key。
- 不 commit `.env.local`。
- 简历原文件默认不上云。
- 浏览器扩展未来不直连 Gemini。
- 扩展不做爬虫，不自动批量打开 JD 详情页。
- LLM 只抽证据和生成解释，最终分数由代码评分引擎计算。
