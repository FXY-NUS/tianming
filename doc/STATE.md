# STATE · 当前状态快照

> **本文件是所有 agent session 的第一入口**（30 秒重入）。规则：≤50 行；每次合并 PR 后由
> `/handoff-sync` 技能（或手动）更新；只写"现在在哪 + 下一步 + 阻塞"，历史和决策依据一律
> 指向 HANDOFF/notes，不在这里复述。

## 当前位置（2026-07-07 · HANDOFF v2.0）

- **Milestone**：M1 收尾阶段。Phase 0–5.5 全部 ✅ Done（最新：Phase 5.5 Apply Assistant L2 · PR #34 · 零 LLM）。
- **Phase 4.6**：数据层 ✅（PR #31）；最简文字 banner 已随 PR #34 占位；完整视觉 2f/2g 延后 M3。
- **main HEAD**：`d507c72`（PR #34 merge）之后仅有文档/工作流基建 commit。

## 下一步（重入锚点 · 按优先级）

1. **M1 收尾两件事**：① 简历多版本切换 UX 整理；② 反通胀端到端 smoke
   （"什么都会"简历 vs 单一方向简历对同一 JD 跑 audit，验证无 union 通胀 → Codex 本地）。
2. **待补欠账**：`doc/phase-5-5-notes.md` §4 手动 smoke 清单四项未勾。
3. M1 宣告 Done 后 → **M2：Track C 浏览器扩展（Phase 6）启动**，先由 Claude Code 写 Codex brief。

## 阻塞 / 待用户拍板

- 无硬阻塞。4.6 完整视觉（2f/2g）按既定决策等 M3 + Claude Design，无需现在拍板。

## 快速读文指引（重复接手用）

- 状态类变更集中在：HANDOFF §2（状态）/ §5 Phase 4.6 & 5.5 / §11（接力）——v2.0 已同步到 PR #34 后事实。
- 首次接手仍按 `CLAUDE.md` §0 的必读链全量读；重复接手读完本文件 + 上面列的变更章节即可。
- 项目技能（任何 Claude session 可用）：`/brief-writer` `/adversarial-prompt-review` `/iron-rules-review` `/handoff-sync`（见 `.claude/skills/`）。

## 冬眠前必做（sprint 结束仪式）

结束一轮冲刺前，最后一个 commit 必须更新本文件的"下一步"为**具体到第一个动作**的描述
（坏例子："继续 Phase 6"；好例子："给 Codex 写 Phase 6 brief，先定 MV3 manifest 权限清单"）。

---
*STATE v1.0 · 2026-07-07 · 初版，由使用效率分析（`doc/usage-analysis.md`）引入*

## M2 · 浏览器扩展（并行推进中）

- `extension/`：LinkedIn MV3 扩展骨架 + 卡片徽章 + 详情「送进天命」按钮（Phase 6.1–6.3），分支 `feat/linkedin-extension-t85ahi`。
- 粗筛评分只留了 `extension/src/scoring.ts` 一个适配层，等后端代理（Phase 6.4）定接口后接入；在那之前徽章一律「未评分」。
- 用法和结构见 `extension/README.md`。
