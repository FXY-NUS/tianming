---
name: iron-rules-review
description: 对 PR 或当前 diff 做 Tianming 守门 review——6 条评分铁律 + 版本 bump + 隐私红线 + 文档代码对齐四查。当用户说"review 这个 PR"、"守门"、"检查铁律"、合并前 sign-off 时使用。
---

# Iron Rules Review · 铁律守门审查

Claude Code 的 PR sign-off 职责（HANDOFF §10.2）。判据的唯一权威版本：
`doc/scoring-rubric.md` §1 + `CLAUDE.md` §五（评分 6 条铁律）+ `CLAUDE.md` §六（隐私红线）。
先读这两处再审，本技能只固化**操作步骤**，不复述规则原文。

## 四查清单

**① 评分铁律（对 diff 逐条过）**
```bash
grep -nE '"overall"|"judgment"' constants.tsx services/*.ts        # 铁律 1：期望 schema 中 0 命中
grep -n "personaWeightCap" src/core/scoringEngine.ts               # 铁律 5：clamp 还在且 ≤0.15
grep -n "hardFail" src/core/*.ts                                   # 铁律 3：默认仍为 false
```
- 铁律 2：diff 里任何"缺失数据"路径，确认走 `confidence: 'unknown'` 且不进加权分母
- 铁律 6：改动区分 `'triage'` vs `'audit'` 目标，没有把两层评分混用

**② 版本 bump（铁律 4）**
- 评分结构 / rubric / prompt schema 任何变动 → `scoringVersion` + `rubricVersion` 必须 bump
- 只重构不改语义 → 不 bump（bump 反而是错，会污染 feedbackRecords 的可比性）

**③ 隐私红线**
```bash
git diff <base> --name-only | grep -iE '\.env|apikey|secret'       # 期望 0 命中
grep -rn "GEMINI_API_KEY" --include="*.ts" --include="*.tsx" . | grep -v "import.meta.env\|localStorage"
```
- 简历原文件不出浏览器；结构化数据上云路径必须有 PII 脱敏

**④ 文档-代码对齐**
- 功能状态变了 → `doc/STATE.md` + `CLAUDE.md` 当前焦点/Phase 表是否同步（不同步就地补，或用 `/handoff-sync`）
- 决策级变动 → HANDOFF 对应章节 + changelog 是否有记录

## 输出

- 代码改动跑 `npm test` / `npm run lint` / `npm run build` 三验（文档-only 免）
- 报告按 P0（阻断合并）/ P1（合并前修）/ P2（记账后续）分级；**每条给文件:行号 + 一句修法**
- 结论只有两种：`✅ sign-off` 或 `❌ P0 阻断 + 清单`——不要"基本没问题"这类含糊话
