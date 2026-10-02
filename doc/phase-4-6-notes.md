# Phase 4.6 Notes · Pro Audit Resume Union + Recommended Resume

> 本文档记录 Phase 4.6 的落地决策、实现细节、smoke 测试记录。**当前状态：数据/评分/prompt 层（2a–2e）已合 main（PR #31）；UI 层（2f–2g 推荐简历 banner）尚未做**——`recommended_resume` 已被 `matchEngine` 解析进结果，但 `App.tsx` / `ResumeMatchBreakdownCard.tsx` 未渲染。smoke 测试记录待 Codex 本地跑完补。

> **配套**：HANDOFF v1.8 §4 D12 · §5 Phase 4.6 · `doc/scoring-rubric.md` §2 Pass B · `doc/briefs/codex-phase-4-6-pro-audit-union.md`

---

## 0. 触发背景

Phase 4.5（PR #27）在 `scoringEngine.computeResumeBreakdown` 做了简历 union 跑分（skills + projects.tech），但 **LLM prompt 层未跟上**：

- `constants.tsx` `buildActiveResumeSection(ctx)` 仍只装配 active resume
- `services/jobEvidenceExtractor.ts` Pass B 同样只喂 active resume

后果：Pass C 算分基于 union evidence，但 Gemini 看到的 narrative 基于单份简历——**评分和叙事的证据池不一致**。Phase 4.6 修复这个分歧，并顺手补一个 "用哪份简历投" 的推荐机制（North Star 命中）。

---

## 1. 决策回顾（Q1-Q4 拍板）

**用户在 session 内拍板，HANDOFF §4 D12 已记录为不可回退架构决策**：

### Q1. Union 粒度

| 字段 | union? | 理由 |
|---|---|---|
| skills（hard / soft / tools / languages）| ✅ | 单份简历 skills 列表是 curated subset，union 反映真实能力面 |
| projects（含 tech）| ✅ | 同一个项目可能在不同简历里强调不同切面，union 让 Gemini 看到全貌 |
| education | ✅ | 学历背景客观存在，union 无歧义 |
| experience（含 bullets）| ❌ **保持 active** | 同一段经历不同简历的 bullets 不同（针对岗位包装）。union 会出现时间冲突 / bullet 重复 / 自相矛盾，prompt 装配脏 |
| basic（name / email / location）| ❌ **保持 active** | PII 字段无 union 价值 |
| piiPolicy | ❌ **保持 active** | 是简历级元数据，跟内容无关 |

### Q2. 来源标注

每条 evidence（pros / cons / matchedSkills）尾部允许标 `（来源: <resume label>）`，让用户知道这个 pro/con 是基于哪份简历的事实。

实现：`SkillEvidence.sourceResumeIds?: string[]`（可选数组）；Gemini responseSchema 同步加；客户端二次校验容错（缺失时 `undefined`，不抛错）。

### Q3. 防通胀约束

**问题**：union 后 Gemini 看到的能力面变宽，naive 实现下大部分 JD 的 skill 维度分数会上扬——犹豫型用户会觉得"什么 JD 都很匹配"，反而失去筛选价值。

**解法**：某 skill 只在非 active 简历出现时，`scoringEngine` 把该条对 skill 维度的贡献 ×0.5。理由：

- active 简历是用户当前主投策略；它包含的 skill 是"打过包装的核心能力"
- 其他简历包含的独有 skill 是"潜在但非主推的能力"
- 完全等权重会让"什么都会的备份简历"过度抬高所有 JD 分数 → 反 North Star

**不影响 confidence**：confidence 仍按证据完整度决定，跟权重打折正交。

### Q4. 推荐简历

Pro 深审输出新字段：
```ts
recommended_resume: {
  resumeId: string;
  label: string;
  reasoning: string;          // 1-3 句话，必须显式提到至少一个 skill/project
  edits_suggestion: string[]; // 具体可执行 bullet，不是"加强经验"空话
}
```

- 仅 Pro 深审输出，Triage 不出（信息密度不够）
- 单份简历时仍输出（resumeId 等于唯一简历，edits_suggestion 可有）
- UI 在 banner 显示，用户点[切换]改 `activeResumeId`，[看建议]折叠展示 edits

**铁律守门**：D12 升级后 6 条铁律全部保留：

1. LLM 仍不出 `overall` / `judgment` 数字（铁律 1）
2. `unknown !== 0` 不变（铁律 2）
3. `hardFail` 默认 false 不变（铁律 3）
4. **`scoringVersion` bump 到 `phase4-scoring-v2.0` + `rubricVersion` bump 到 `rubric-v1.1`**（铁律 4 · Q3 算规则变动）
5. Persona ≤15% 不变（铁律 5）
6. Triage vs Audit 两层不变（铁律 6 · Q4 只影响 Audit）

---

## 2. 实现拆解

详见 `doc/briefs/codex-phase-4-6-pro-audit-union.md` §4 阶段 2a-2g。

简表：

| 子任务 | 文件 | 状态 |
|---|---|---|
| 2a `buildResumeUnionSection` | `constants.tsx` | ✅ Done · PR #31 |
| 2b `PRO_AUDIT_PROMPT` schema 扩展 | `constants.tsx` | ✅ Done · PR #31 |
| 2c Pass B 喂 union | `services/jobEvidenceExtractor.ts` | ✅ Done · PR #31 |
| 2d types + scoringVersion bump | `types.ts` / `src/core/matchTypes.ts` | ✅ Done · PR #31（v2.0 / rubric-v1.1）|
| 2e `applyUnionWeightPenalty` Q3 | `src/core/scoringEngine.ts` | ✅ Done · PR #31 |
| 2f 推荐简历 banner | `App.tsx` | ⏸ 未做（等 Claude Design 设计稿；`recommended_resume` 已算出但未渲染）|
| 2g BreakdownCard 对齐 | `src/components/ResumeMatchBreakdownCard.tsx` | ⏸ 未做（跟 2f 一起）|

---

## 3. 协作支线（并行）

- **Codex**：阶段 2a-2e 代码（不依赖外部）；阶段 2f-2g 等 Claude Design 设计稿
- **Claude Design**（1 天会员窗口紧急）：推荐简历 banner + ResumeMatchBreakdownCard 接入位置 + 视觉规范（brief 见 `doc/briefs/claude-design-phase-4-6-recommended-resume.md`）
- **Super Grok**（3 天会员窗口）：Day 1 prompt review + Phase 8.x ML RFC（brief 见 `doc/briefs/grok-day-1-prompt-review-ml-rfc.md`）；Day 2-3 六爻 plugin / scoring-rubric 盲点审计 / HANDOFF 跨章节校对
- **Claude Code**（我）：守门 6 条铁律 + 文档同步 + PR review
- **用户**：决策 / 本地 smoke 验收 / 拍板合 main

---

## 4. Smoke 测试记录（待补 · Codex 本地跑完后填）

### 4.1 反通胀关键测试

**测试场景**：
- 简历 A：技术岗版（专精 ML / Python / AWS）
- 简历 B：咨询版（专精 strategic analysis / business writing / Excel modeling）
- 简历 C：什么都会版（合并 A+B 的所有 skills + 加了一些 marketing / sales 关键词）

**JD**：一个明确的 Senior ML Engineer 职位（需要 ML / Python / AWS / Kubernetes）

**期望**：
- active = A → audit 分数最高，因为是 1:1 匹配
- active = C → 分数**不应该**显著高于 A（Q3 约束生效：C 独有的 marketing / sales 关键词对该 ML JD 的 skill 维度贡献减半）
- active = B → 分数明显低于 A 和 C，因为 B 跟 ML JD 是 transferable 而非直接匹配

**反例**（说明 Q3 没生效，必须返工）：
- C 分数 ≥ A → union 通胀，权重约束失效
- C 跟 A 完全等分 → 来源标注未生效，Gemini 没看到 sourceResumeIds

**实测记录**（2026-10-02 · 代码侧自动化 `src/core/unionInflation.smoke.test.ts`，Gemini 证据用手写夹具代替，评分走真实引擎）：

| 激活简历 | overall | skill 维度 | breakdown bestResumeId |
|---|---|---|---|
| A · ML 技术版 | 71.3 | 71.3 | C |
| B · 咨询版 | 42.6 | 42.6 | C |
| C · 什么都会版 | **78.7** | **78.7** | C |

- ✅ A > B：成立，B 激活时 ML / Python / AWS 全部减半。
- ❌ **C > A：命中反例，Q3 没能挡住。** 原因：×0.5 只打折"来自非激活简历"的 skill，C 本身就是所有 skill 的来源，激活 C 时没有一条被打折；transferable 里多出来的咨询 / marketing 关键词全额计入。
- ❌ **breakdown 把 C 排第一**：`collectJdSkills` 把 transferable 也算成"JD 技能"，技能最多的简历必然 coverage 最高。
- 两条失败预期以 `it.fails` 留在测试里，修复后改回 `it`。

**候选修法（待拍板）**：
1. 代码侧：transferable 对分子的贡献封顶（例如不超过 missing 权重的一半），且 breakdown 只按 matched + missing 算 JD 技能；bump scoringVersion / rubricVersion。
2. prompt 侧：Pass B 明确 transferable 只能是"JD 要求但简历只沾边"的项，一条 JD 要求最多一条；跑 `/adversarial-prompt-review`。
3. 两者都做（推荐：prompt 约束 Gemini 少塞，代码封顶兜底）。

### 4.2 退化分支测试

**场景 1 · 0 简历**：跑 audit
- 期望：`recommended_resume` 字段不出现 / 为 null；narrative 不出现"建议用 XXX 简历"
- 实测：⏳

**场景 2 · 1 简历**：跑 audit
- 期望：`recommended_resume.resumeId` = 该简历 id；`reasoning` 不画蛇添足；`edits_suggestion` 仍可有具体内容
- 实测：⏳

### 4.3 切换简历持久化测试

**步骤**：
1. 跑 audit，banner 出现
2. 点[切换]
3. 关 tab，重开
4. 检查 `activeResumeId` 是否仍是切换后的值

**期望**：Dexie 持久化生效，重开后 activeResumeId 不丢
**实测**：⏳

---

## 5. PR 信息

- 代码 PR（2a–2e 数据/评分/prompt 层）：✅ **PR #31 已合 main**（`feat: add pro audit resume union scoring`）
- 文档 PR：✅ HANDOFF v1.8（PR #28 已合）+ 本次进度同步
- UI PR（2f–2g 推荐简历 banner）：⏳ 未发，等 Claude Design 设计稿
- 设计稿 PR：⏳ Claude Design 出稿后用户上传

---

## 6. 后续遗留 / 待 Phase 4.6+ 处理

- **UI banner 视觉细节**：等 Claude Design 出稿后再定（透明度、配色、动画进入方式）
- **手动撤销/锁定推荐**：用户如果坚持用 active，能不能"本 JD 永久关闭推荐"？暂时不做，看用户反馈
- **`edits_suggestion` 一键应用**：UI 上能不能"点一下就改简历"？这是 Phase 8 范畴（自动改简历），本 Phase 不做
- **Persona 维度跟 Q3 的关系**：Persona 权重 ≤15% cap 仍守住，但 persona evidence 是否也有"非 active 简历"概念？目前 persona 跟简历无关，不动；如果未来 persona 跟简历绑定再讨论

---

## 7. 跟其他 Phase 的边界

- 跟 Phase 4.5：4.5 做了 scoring 层 union，4.6 做 prompt 层 union + UI banner；scoringVersion 从 v1.1 → v2.0
- 跟 Phase 5：Dexie 已合 main，4.6 切换简历直接用 Dexie 持久化，**不需要**本 Phase 做存储改动
- 跟 Phase 5.5（Apply Assistant L2）：5.5 排在 4.6 后启动；4.6 的 UI banner **不**包含一键复制功能（那是 5.5 的 modal）
- 跟 Phase 7（UI 整体焕新）：4.6 banner 是 audit card 内的局部加法；Phase 7 时整体焕新 banner 也要焕新，但本 Phase 不焕
- 跟 Phase 8（Cover Letter）：8 是基于 audit + 简历生成可投递文本，跟 4.6 的"推荐用哪份"是不同抽象层；4.6 不涉及文本生成
- 跟 Phase 8.x（ML 学权重）：Q3 的 ×0.5 是工程经验值；未来 8.x ML 训练后可能调整这个系数，但 fallback 仍是 ×0.5

---

*Phase notes 版本 v1.0 · 2026-05-20 · 骨架版 · 待 Codex 实施后补落地细节 · Claude Code 出*
