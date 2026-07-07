---
name: handoff-sync
description: 合并 PR 后或冲刺结束前的文档同步仪式——更新 STATE.md / CLAUDE.md / HANDOFF changelog，保证状态只有一份真相。当用户说"同步文档"、"合完 PR 了"、"收尾"、"今天到这"时使用。
---

# Handoff Sync · 文档状态同步

解决本项目最大的历史痛点：同一状态散落多处 → 漂移 → 需要专门的纠偏 commit。
**分层原则**：状态只写 `doc/STATE.md`（唯一高频层）；`CLAUDE.md` 只保留一行当前焦点 + Phase 表；
`HANDOFF.md` 只在**决策/结构**变化时才动（低频层）；phase notes 是完工存档（一次性层）。

## 步骤

1. **确定事实**：`git log --oneline -10` + 看最新 merge 的 PR 内容。以 git 为准，不以记忆为准。
2. **更新 `doc/STATE.md`**（每次必做）：
   - "当前位置"：Phase/PR 状态一句话
   - "下一步"：**必须具体到第一个动作**（坏："继续 Phase 6"；好："给 Codex 写 Phase 6 brief，先定 MV3 manifest 权限清单"）
   - "阻塞/待拍板"：没有就写"无"
   - 保持 ≤50 行，挤不下就删旧内容——历史归 HANDOFF changelog，不归 STATE
3. **更新 `CLAUDE.md`**（状态变了才做）：§二"当前焦点"一段 + §四 Phase 表对应行，不新增段落。
4. **更新 `doc/HANDOFF.md`**（仅决策/结构变化时）：
   - 改对应章节（§2 状态列表 / §4 决策 / §5 Phase 章节 / §11 接力）
   - 头部版本号 bump + 底部 changelog **加一行（新版本在最上）**
   - 铁律：HANDOFF 改动统一由 Claude Code 做（§10.2），Codex/其他 agent 不碰
5. **Phase 完工时**：补/建 `doc/phase-N-notes.md`（含"已建立范式"和"有意推迟不是遗漏"两节）。
6. **一致性自检**（commit 前）：
   ```bash
   grep -rn "当前焦点\|当前位置" CLAUDE.md doc/HANDOFF.md doc/STATE.md   # 三处口径一致
   grep -c "文档版本" doc/HANDOFF.md                                     # changelog 行数 = 版本数
   ```
7. **单独一个 docs commit**（`docs(state): ...` 或 `docs(handoff): ...`），不跟功能代码混。

## 冬眠模式（冲刺结束 / 用户说"今天到这"）

额外确认：STATE.md 的"下一步"足够具体到 3 周后冷启动也能直接开工；有未合分支或未回流的
外部 agent 产出（`doc/briefs/grok-replies/`）就在"阻塞/待拍板"里点名——**别再出现 v1.9 分支
被遗忘 40 天那种事**。
