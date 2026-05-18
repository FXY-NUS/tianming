# Agent Workflow Router

> 本文件只负责选择 AI 助手工作流；不要把 Codex 本地规则和 Claude Code 云端规则混在一起。

## 1. 先判断运行环境

- **Codex / 本地 workspace**：读取 `doc/codex-workflow.md`。
- **Claude Code / 云端 GitHub workspace**：读取 `claudecode.md`。
- **不确定运行环境**：先确认运行环境，再读取唯一对应的工作流。

## 2. 为什么要拆分

Codex 和 Claude Code 的工作地点不同：

- Codex 修改用户本地 Windows workspace，所以需要处理本地 `main` 同步、Windows 命令、SSH remote、沙箱授权和本地验证。
- Claude Code 在云端 GitHub workspace 工作，所以直接以 GitHub 仓库状态为准，不应假设能读取用户本地文件、SSH config、本地环境变量或 Windows shell。

项目背景和路线图继续放在 `doc/HANDOFF.md`。环境专属的执行细节只放在对应 workflow 文档里。

## 3. 两种环境共同遵守

- 始终用中文和用户沟通。
- 每个 Phase 或明确子任务使用独立 feature branch。
- commit 使用 conventional commits，例如 `feat:`、`fix:`、`docs:`、`refactor:`、`test:`。
- 不硬编码 API key。
- 不 commit `.env.local`。
- 不把 SSH private key、API key、token 或任何密钥值写入 repo 或文档。
- 简历原文件默认只在本地/私有环境保存，除非用户明确改变该策略。
- 浏览器扩展不直连 Gemini。
- 浏览器扩展不做爬虫，不自动批量打开 JD 详情页。
- LLM 只负责抽取证据和生成解释；最终匹配分数由版本化代码计算。
