# Brief · Codex · Phase 4.6 Pro Audit Resume Union（阶段 2a-2g）

> **接收者**：Codex（本地 Windows workspace · 主力执行）
> **发出者**：Claude Code（总监助手 · 守门）经用户拍板
> **分支**：`feat/phase-4-6-pro-audit-union`（基于最新 main HEAD）
> **配套文档**：HANDOFF §4 D12 · §5 Phase 4.6 章节 · `doc/phase-4-6-notes.md` 骨架

---

## 1. North Star check

> **"帮一个怕错的人按下投递键。"**

本次任务要解决的具体卡点：**用户有多份简历时，Pro 深审只看到 active 那一份，输出的 pros/cons 评估面太窄；犹豫型用户看完 audit 还是不知道"该用哪份投"**——继续 freeze。

成功标志：Pro 深审完成后，UI 弹一个非阻塞 banner，用户能 1 秒决定"用 XX 简历投 / 顺便改这两处" → 不再回去对比简历。

---

## 2. 背景

- **Phase 4.5 ✅ 已合 main**（PR #27）：`computeResumeBreakdown` 在 scoring engine 做了 skills/projects.tech 层 union，`ResumeMatchBreakdownCard` UI 已接入 App.tsx
- **Phase 5 ✅ 已合 main**（PR #26）：Dexie 存储完整迁移，`activeResumeId` 切换走 Dexie 持久化
- **Phase 4.6 ⏳ 本任务**：把 Pro 深审 prompt 层也升级为 union，补齐 4.5 留下的"评分层 union 但 prompt 层单份简历"分歧；同时输出 `recommended_resume`

---

## 3. Q1-Q4 决策（不可回退 · 见 HANDOFF §4 D12）

| # | 决策 | 实施位置 |
|---|---|---|
| Q1 | Union 粒度 = skills + projects + education；**experience 仍按 active** | 2a `buildResumeUnionSection` |
| Q2 | 每条 evidence 尾部允许标 `（来源: <resume label>）`；`SkillEvidence.sourceResumeIds?: string[]` | 2b prompt + 2c Pass B + 2d types |
| Q3 | 某 skill 只在非 active 简历出现时，scoring engine 把贡献 ×0.5（防 union 通胀） | 2e scoringEngine |
| Q4 | Pro 深审输出 `recommended_resume = { resumeId, label, reasoning, edits_suggestion: string[] }` | 2b prompt + 2d types + 2f UI |

**铁律守门**：D12 升级后 6 条评分铁律全部保留——Gemini 仍**不输出 overall / judgment**，只出 evidence + source + recommended_resume narrative。

---

## 4. 实现拆解（7 个子任务 · 一个 PR · 每个 sub-task 1-3 commit）

### 2a. `constants.tsx`：新增 `buildResumeUnionSection`

**目标**：替代 `buildActiveResumeSection(ctx)` 在 `PRO_AUDIT_PROMPT` 里的位置。

- Union skills（hard / soft / tools / languages）+ projects + education；每条 markdown bullet 末尾标 source resume label
- Experience 段仍只取 active resume，section 标题加 "（当前激活简历）"
- 单 resume 退化：等价于 active section，行为不变
- 无 resume 退化：保留现有"用户未上传简历"占位
- **复用** `collectResumeSkills(resume)` 已有 helper（在 `src/core/scoringEngine.ts`），别重写

**单测**：`tests/constants.spec.ts` 加 3 cases：
1. 0 简历 → 占位字符串
2. 1 简历 → markdown 等价于 `buildActiveResumeSection`
3. 3 简历（active = A，B 有独有 skill X，C 有独有 project Y）→ markdown 含来自 B/C 的标注

### 2b. `PRO_AUDIT_PROMPT` schema 扩展（同 `constants.tsx`）

**输出 JSON 新增字段**：
```json
{
  "recommended_resume": {
    "resumeId": "string",
    "label": "string",
    "reasoning": "string (1-3 sentences)",
    "edits_suggestion": ["string (e.g. '在 Project 2 加 TypeScript 关键词')"]
  }
}
```

**prompt 文本约束新增**：
- 【审计维度】加 F. 简历选择建议
- 【约束】末尾重复一次："不输出 `overall` 数字 / `judgment` 字段——评分由代码计算，你只出 evidence + narrative"
- 【约束】加："`edits_suggestion` 必须是具体可执行的 bullet（'加 X 到 Project Y' / '把 Skills 段第 3 条改为 Z'），不要写'建议加强经验'这种空话"
- 【约束】加："`recommended_resume.reasoning` 必须显式提到至少一个 skill / project 名称作为依据，不要写'该简历更符合岗位'这种泛泛之谈"
- 【约束】加："仅 1 份简历时，`recommended_resume.resumeId` 等于该简历 id，`edits_suggestion` 仍可有内容（针对该 JD 的具体修改建议），但不要画蛇添足说'用唯一简历'"

**Grok prompt review** 会预测 Gemini 会不会绕过这些约束（见 `doc/briefs/grok-day-1-prompt-review-ml-rfc.md`）；Codex 先出草稿，等 Grok review 完再合 PR。

### 2c. `services/jobEvidenceExtractor.ts` Pass B 改造

- `buildEvidencePrompt(job, ctx)` 喂 union markdown，**不再** `JSON.stringify(activeResume.structured)`
- Gemini `responseSchema`：`SkillEvidence` 加 `sourceResumeIds?: string[]`（可选数组）
- 客户端二次校验同步加 source 字段；**容错降级**：Gemini 没标 source 时 `undefined`，不当错误抛
- 现有 `temperature: 0.1` 不动

### 2d. `types.ts` / `src/core/matchTypes.ts` 字段扩充

`types.ts`：
```ts
interface JobAnalysis {
  // ...现有字段
  recommended_resume?: {
    resumeId: string;
    label: string;
    reasoning: string;
    edits_suggestion: string[];
  };
}
```

`src/core/matchTypes.ts`：
```ts
interface SkillEvidence {
  // ...现有字段
  sourceResumeIds?: string[];
}
```

**版本号 bump**：
- `scoringVersion`: `phase4-scoring-v1.1` → `phase4-scoring-v2.0`
- `rubricVersion`: `rubric-v1` → `rubric-v1.1`（Q3 权重约束属规则变动）

### 2e. `src/core/scoringEngine.ts`：Q3 权重约束

新增 `applyUnionWeightPenalty(matchedSkills, activeResumeId, allResumes)`：
- 对每条 `SkillEvidence`：若 `sourceResumeIds` 只含非 `activeResumeId` 的简历 → 该条对 skill 维度的贡献 ×0.5
- 若 `sourceResumeIds` 含 active resume → 不打折
- 若 `sourceResumeIds` 缺失 → 不打折（容错，避免误伤）

**单测**：`tests/scoringEngine.spec.ts` 加 case：
- 3 份简历下 active=A，skill X 的 evidence `sourceResumeIds: ['B']` → skill 维度该条贡献减半
- skill Y `sourceResumeIds: ['A','B']` → 不减半
- skill Z 缺 `sourceResumeIds` → 不减半（容错）

### 2f. `App.tsx`：推荐简历 banner

> **依赖**：等 Claude Design 出推荐简历 banner 设计稿（`doc/design/streaming-flow-mock-v2/` 或 `doc/design/phase-4-6/`）再实施。**先不动，等设计稿合并 main 后启动。**

- `handleDeepAudit` 完成后，如果 `analysis.recommended_resume.resumeId !== activeResumeId` → 显示非阻塞 banner
- 内容：「建议用『XXX 简历』投这个职位」+ reasoning + [切换] [看建议]
- [切换]：直接改 `userCtx.activeResumeId` → Dexie 自动持久化（Phase 5b 已支持）
- [看建议]：折叠展示 `edits_suggestion` 列表
- [忽略]：本次 audit 不再显示（不持久化，下次 audit 还会出）

### 2g. `src/components/ResumeMatchBreakdownCard.tsx` 顺手对齐

- 在 best resume 卡片下方（如存在）展示 `recommended_resume.reasoning` 一句话
- props 类型扩展同步
- **依赖**：跟 2f 一起做（同一波 UI 改动）

---

## 5. 验收清单

### 5.1 自动化（Codex 本地 + 云端 CI）

- [ ] `npm run test` 全过（当前 112 tests + 新增 union prompt builder 3 cases + Q3 权重约束 3 cases）
- [ ] `npm run lint` 干净
- [ ] `npm run build` 干净
- [ ] **6 条铁律 self-check**：`grep -E '"overall"|"judgment"' constants.tsx services/` 应该只出现在「禁止 LLM 输出」的约束文本里，**不出现在 responseSchema 字段定义里**

### 5.2 本地手动 smoke（Codex 本地 + 用户）

- [ ] 准备 3 份真实简历（技术岗版 / 咨询版 / 产品版），上传到 IndexedDB
- [ ] 跑同一个 JD 的 Pro 深审，console.log Gemini payload，能看到 union 字段 + 各 skill 来源标注
- [ ] Gemini 输出 `recommended_resume` 字段，`reasoning` 显式提到 skill / project 名称
- [ ] `edits_suggestion` 是具体可执行的 bullet（不是"建议加强经验"空话）
- [ ] **关键反通胀测试**：
  - 构造一份"什么都会"的简历 + 一份单一方向简历，对一个特定 JD 跑 audit
  - **期望**：什么都会的简历**不**自动拿高分
  - **反例**：union 后分数普遍上扬 → Q3 约束没生效，必须返工
- [ ] 退化分支：只有 1 份简历时，union 等价于 active，行为不变（分数 / narrative 跟 4.5 一致）
- [ ] 切换简历：UI banner 上点切换 → `activeResumeId` 变化 → Dexie 持久化（关 tab 重开仍是新值）

### 5.3 PR review by Claude Code

Claude Code 在 PR diff 上验三件事：
1. 6 条铁律是否被破坏（最关键：Gemini 没拿到打 overall 的权 · responseSchema 里没有 overall/judgment 字段）
2. `scoringVersion` / `rubricVersion` bump 是否正确
3. 文档 PR（HANDOFF v1.8 已合）跟代码 PR 是否对齐（D12 文字描述跟代码实现一致）

---

## 6. 边界（明确不要做）

- ❌ **不要真的把 `experience.bullets` 也 union**（Q1 已拍板拒绝 · 时间冲突太脏 · bullet 来源 ambiguity）
- ❌ **不要在审计层让 Gemini 出"切换简历后预测的新分数"**（评分铁律 1 · LLM 不出分）
- ❌ **不要自动改简历**（Phase 8 范畴 · 且学校项目组在做，非 unique value）
- ❌ **不要触碰 Phase 8.x ML 反向赋能逻辑**（那是另一个 Phase 不同 Track）
- ❌ **不要在本 PR 启动 Phase 5.5 Apply Assistant L2**（等 4.6 合 main 再启）
- ❌ **不要先合 2f / 2g 的 UI 部分**（等 Claude Design 出推荐简历 banner 设计稿后再合）

---

## 7. 输入材料

| 文件 | 重点 |
|---|---|
| `doc/HANDOFF.md` v1.8 | §1.5 North Star · §4 D12 · §5 Phase 4.6 · §11 6 条评分铁律 |
| `doc/scoring-rubric.md` | §1 核心原则 · §2 Pass B 改造说明 · §3 v1 rubric 表 |
| `doc/phase-4-6-notes.md` | 决策回顾 + 待补落地细节 |
| `constants.tsx` L36-57, L75-134 | 现有 `buildActiveResumeSection` + `PRO_AUDIT_PROMPT` |
| `services/jobEvidenceExtractor.ts` L86-113 | 现有 Pass B |
| `src/core/scoringEngine.ts` L20, L63-116 | 现有 `computeResumeBreakdown` + `collectResumeSkills` |
| `src/core/matchTypes.ts` L50-66 | 现有 `SkillEvidence` |
| `types.ts` L23-39 | 现有 `JobAnalysis` |
| `App.tsx` L312-330 | 现有 `handleDeepAudit` |
| `doc/briefs/claude-design-phase-4-6-recommended-resume.md` | UI 设计稿任务包（参考用） |
| `doc/briefs/grok-day-1-prompt-review-ml-rfc.md` | Grok prompt review 任务包（参考用） |

---

## 8. 协作时序

```
[T+0]  Codex 起 feat/phase-4-6-pro-audit-union 分支
       做 2a + 2b（prompt 草稿不立刻 push）
       做 2c + 2d + 2e（独立于 UI · 可先合）
  ↓
[T+半天] Codex 出 PRO_AUDIT_PROMPT 草稿 → 推给 Super Grok review
       Grok 回 prompt 改进建议 → Codex 修
  ↓
[T+1d]  Claude Design 交推荐简历 banner 设计稿 → 用户上传到 doc/design/phase-4-6/
       Codex 做 2f + 2g（按设计稿实现）
  ↓
[T+1.5d] Codex 本地 smoke 跑通 5.2 验收清单 → 发 PR
       Claude Code 云端 review 6 条铁律 + 文档一致性
       用户拍板合 main
```

---

*Brief 版本 v1.0 · 2026-05-20 · Claude Code 出 · 配套 HANDOFF v1.8 D12 + Phase 4.6 章节*
