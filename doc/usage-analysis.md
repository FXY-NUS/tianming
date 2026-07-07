# Tianming · Agent 使用效率分析报告

> 分析对象：本仓库全部 git/PR 历史 + 交接文档体系。
> 触发：用户要求"总结我的使用类型 + 将来怎么提升使用效率"。
> 方法：3 个并行 subagent 分别扫描 ①容器内 session 残留 ②git/PR 历史 ③文档协作模式，再汇总。
> 注：claude.ai 历史对话窗口本身不可读（云端容器无残留），本报告基于仓库痕迹重建。

---

## 1. 使用画像：「编排者 / 总监型」

用户不把 AI 当结对程序员，而是自任总监，运营五方 agent 团队（HANDOFF §10.2）：
用户拍板/验收 · Claude Code 云端规划/守门/文档 · Codex 本地执行/集成 · Claude Design 视觉 ·
Super Grok 对抗性 review。

### 量化特征（2026-05-13 → 2026-06-15）

| 维度 | 数据 |
|---|---|
| 总量 | 115 commits · 34 merged PRs · 29 分支 · 约 5 周 |
| 作者分布 | Claude 56（49%）· 人工 49（43%，绝大多数为 merge + 网页小编辑）· Codex 11（10%） |
| 节奏 | 两次爆发：5/13–14（38c）+ 5/18–21（70c，占 61%，单日最多合 10 PR）；之后 3 次 1–3 周间歇 |
| 时间分布 | 全部在周一至周四 10:00–24:00（+0800）；周五至周日零 commit |
| 任务粒度 | 中位 PR ≈ 9 文件 / 500 行；大 PR 1.4–2k 行；Claude 分支 3–7 个粒度 commit，Codex 恒为 1 个 squash |
| 固定闭环 | feature PR → review 修复 PR → 文档同步 PR |
| 文档占比 | Claude commit 中约 23% 为纯文档（HANDOFF 版本、notes、briefs） |

### 任务类型（按 briefs + commit 归类）

功能开发（最大宗）> prompt 工程 > 评分/算法设计 > prompt 行为预测 review（独特高级用法）
> UI 设计与设计稿 review > 文档沉淀/同步 > PR 守门 > smoke 测试。

### 核心方法论

"文档即共享内存"：North Star + 6 条铁律当宪法，brief 当 RPC 契约，HANDOFF 当状态机，
phase notes 当范式库。个人开发者中相当前沿的多 agent 工程化编排。

## 2. 已发生的摩擦（全部有 git 实证）

1. **人肉总线丢包**：所有 agent 间通信靠用户复制粘贴。Grok Day-1 产出从未回流入库
   （HANDOFF 引用的 `grok-replies/` 目录曾不存在）；Claude Design 拿了 brief 仍破 3 条 P0
   约束，需整轮 review-revise；4.6 UI 因等设计稿阻塞，最终靠"最简文字 banner"绕过。
2. **启动税重**：每 session 必读 942 行 HANDOFF 全文 + 4–5 份配套文档。
3. **状态多处复述 → 漂移**：同一决策要在 5–6 处保持一致；已有专门纠偏 commit
   （`docs: sync Phase 4.6 status to actual state`、紫微/八字措辞对照 PR）。
4. **分支被遗忘**：`claude/amazing-archimedes-qelbP`（HANDOFF v1.9 + Phase 5.5 brief，5/27）
   从未合并，主干文档停在 v1.8 达 40 天，而 PR #34 实际按该 brief 实现。
5. **缺陷成批爆发**：云端开发 + 本地 smoke 的时差 → Phase 4 一次 smoke 暴出 A1–A5 五连
   （含数据全丢的 A1）；全仓库长期仅 1 个 test commit，smoke 是唯一防线。
6. **会员窗口倒逼调度**：Claude Design"限时 1 天"、Grok"限时 3 天"成为硬 deadline。

## 3. 建议与落地状态

| # | 建议 | 状态 |
|---|---|---|
| 1 | 文档分层：宪法（铁律/North Star，低频）/ 状态（`doc/STATE.md` 单点，高频）/ 档案（notes） | ✅ 已落地：STATE.md v1.0 + CLAUDE.md/HANDOFF §11 接入；重复接手不再强制全文重读 |
| 2 | 建 `.claude/skills/` 把仪式固化为可调用技能（任何 Claude 模型 session 通用，含 Opus） | ✅ 已落地：`brief-writer` / `adversarial-prompt-review` / `iron-rules-review` / `handoff-sync` |
| 3 | Grok 类对抗 review 内化到云端 session（subagent 并行互攻），产出直接 commit | ✅ 技能已建；§10.2 增加备选路径，不再依赖会员窗口 |
| 4 | 还旧账：v1.9 分支吸收入库 + grok-replies 目录补建 | ✅ 已落地（HANDOFF v2.0；该分支可删） |
| 5 | 给 Dexie 持久化路径补 Vitest；用云端预装 Playwright 跑无头 smoke（写→刷新→读回） | ⏳ 建议下个 sprint 第一个任务 |
| 6 | 冬眠前"重入锚点"仪式：最后一个 commit 把 STATE.md 下一步写到"第一个具体动作"粒度 | ✅ 规则已写进 STATE.md + `/handoff-sync` 冬眠模式 |
| 7 | PR 看护用订阅（云端 session 可订阅 PR 事件自动响应 review/CI），减少人工盯梳 | ⏳ 下次开 PR 时按需启用 |

## 4. 一句话结论

用法已是多 agent 编排的高阶形态；瓶颈不在 agent 能力，而在**人肉总线 + 状态冗余**。
状态收敛到 STATE.md 单点、仪式固化成 skills、对抗 review 内化进 session 后，
预期显著降低：每 session 启动税（~1500 行 → ~200 行首读）、漂移纠偏成本、外部产出丢失率。

---
*Usage Analysis v1.0 · 2026-07-07 · Claude Code 云端 session（3 subagent 并行取证）*
