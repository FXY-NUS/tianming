---
name: brief-writer
description: 按 HANDOFF §10.4 模板为指定 agent（Codex / Claude Design / Super Grok / 其他）撰写 Phase 启动任务 brief。当用户说"写 brief"、"给 Codex/Design/Grok 派任务"、"启动 Phase N"需要任务包时使用。
---

# Brief Writer · 任务分发 brief 撰写

为 Tianming 项目的某个 agent 生成一份任务 brief，落盘 `doc/briefs/<agent>-<phase-or-topic>.md`。

## 步骤

1. **先读三处**（不要凭记忆写）：
   - `doc/HANDOFF.md` §10.4 —— 模板全文和 4 条强制规则（模板以该处为唯一权威版本，本技能不复述）
   - `doc/HANDOFF.md` §1.5 —— North Star 原句 + 三层产品叙事
   - 本次任务对应的 HANDOFF §5 Phase 章节 + §4 相关决策（D1–D12）
2. **确认输入**：接收 agent 是谁、任务范围、紧急度/会员窗口。用户没说清就先问，不要猜。
3. **按 §10.4 模板写**，硬性自检（少一项不落盘）：
   - [ ] North Star check / 边界（明确不要做）/ 验收清单 三段齐全
   - [ ] ≤300 行（超了 = 任务太大，先向用户建议拆 Phase）
   - [ ] 输入 schema 给了完整 ts 类型或文件路径，agent 不需要翻别的文档就能动手
   - [ ] 边界段包含"违反 6 条评分铁律的事项"具体化（哪几条跟本任务相关就点名哪几条）
   - [ ] 文末版本行：`*Brief v1.0 · <日期> · Claude Code*`
4. **落盘并提醒回流**：commit 后提醒用户——agent 的产出报告必须当天 commit 回
   `doc/briefs/`（Grok 类进 `grok-replies/`），**产出不入库 = 没发生**。

## 注意

- brief 是给"读不到本仓库"的外部 agent 看的：所有引用要么内联，要么给出用户可复制的原文。
- 给 Claude Design 的 brief 额外遵守 §10.3（单屏粒度 + 视觉锚点 + 已有 Design System token）。
- 给 Super Grok 的 brief 额外注明硬约束：不写代码、不改 prompt/rubric，只出 markdown 报告。
