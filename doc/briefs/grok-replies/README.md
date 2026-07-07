# grok-replies · 外部 agent 产出回流目录

本目录存放"推理/行为预测 review"类任务的产出报告（markdown），来源有两种：

1. **Super Grok**（人肉搬运链路）：用户把 `doc/briefs/grok-*.md` 复制给 Grok →
   拿回报告 → **必须 commit 到本目录**（命名 `day-N-<topic>.md`，文末带版本行）→
   Claude Code 守门 review 后方可作为决策输入。
2. **Claude Code `/adversarial-prompt-review` 技能**（v2.0 起推荐）：云端 session 内
   派对抗性 subagent 完成同类 review，产出直接写入本目录，无需人肉搬运。

## 历史欠账备注

HANDOFF v1.8 曾引用 `day-1-phase-8x-ml-rfc.md`（Grok Day-1 prompt review + ML RFC，
brief 见 `../grok-day-1-prompt-review-ml-rfc.md`），但该报告**从未被搬运回 repo**，
产出已丢失在会话窗口里。若用户仍能找到原始回复请补录；否则 Phase 8.x 启动前用
`/adversarial-prompt-review` + RFC brief 重做一次。

**教训（已写进 usage-analysis）**：外部 agent 的产出不入库 = 没发生。拿回报告的
当天就 commit，不要攒。
