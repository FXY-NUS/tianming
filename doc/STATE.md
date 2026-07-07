# STATE · 当前状态快照

> **本文件是所有 agent session 的第一入口**（30 秒重入）。规则：≤50 行；每次合并 PR 后由
> `/handoff-sync` 技能（或手动）更新；只写"现在在哪 + 下一步 + 阻塞"，历史和决策依据一律
> 指向 HANDOFF/notes，不在这里复述。

## 当前位置（2026-07-07 · HANDOFF v2.1）

- **方向拍板（D13）**：**产品化优先**，作品集角色退居其次。手动粘贴一等公民 · 不用第三方爬取 ·
  双语化最晚 M3 · 模型可配置 · 盈利模式后置（配额先行）。
- **Milestone**：M1 收尾阶段。Phase 0–5.5 全部 ✅ Done（最新：PR #34）。
- **隐私措辞已修正（D6 v2.1，盲区 H1）**：文档层完成；**UI 层披露文案还没做**（见下）。
- **安全路线已定**：`doc/security-plan.md` v1.0 三阶段。

## 下一步（重入锚点 · 按优先级）

1. **M1 收尾三件事**：① 简历多版本切换 UX 整理；② 反通胀端到端 smoke（Codex 本地）；
   ③ security-plan §1 三小项（CSP + key 配额引导文案 + 简历上传首次披露弹层）——一个小 PR 的量。
2. **待补欠账**：phase-5-5-notes §4 手动 smoke 四项未勾；最小 CI（security-plan §1.4）。
3. M1 Done 后 → **M2：Phase 6 浏览器扩展 + 后端代理**，先由 Claude Code 写 Codex brief
   （安全验收清单直接从 security-plan §2 抄）。

## 记账（不阻塞，别忘）

- **迁移矩阵约定（盲区 L3）**：storage schema 每加一版，`migration.test.ts` 必须补
  "该历史版本 → 最新版"用例，PR 守门时查（`/iron-rules-review` 已含存储项）。
- **模型选择器（D13.3）**：替换硬编码 preview ID，挂 D10 provider 抽象，M1 后做。
- **数据导出/恢复（盲区 L2）**：设置页加"导出全部数据 JSON / 导入恢复"，Phase 7 顺手做。
- **双语化（D13.2）**：最晚随 M3/Phase 7 UI 重做。

## 阻塞 / 待用户拍板

- 无硬阻塞。

## 冬眠前必做（sprint 结束仪式）

结束一轮冲刺前，最后一个 commit 必须更新本文件的"下一步"为**具体到第一个动作**的描述
（坏例子："继续 Phase 6"；好例子："给 Codex 写 Phase 6 brief，先定 MV3 manifest 权限清单"）。

---
*STATE v1.1 · 2026-07-07 · D13 产品化拍板 + D6 v2.1 隐私措辞修正 + security-plan 引入*
