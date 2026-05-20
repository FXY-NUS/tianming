# Phase 4 评分体系设计 · Match Engine / Scoring Engine

> 本文档记录 Phase 4 的评分系统决策。目标是让 Tianming 的分数可解释、可复现、可扩展，而不是让 LLM 直接凭感觉给总分。

---

## 1. 核心原则

1. **LLM 抽证据，代码算分**
   - Gemini 负责从 JD / 简历 / Persona 中抽取结构化证据。
   - `ScoringEngine` 负责按版本化 rubric 计算 `MatchScore.overall`。
   - Pro 深审可以生成更丰富的叙述，但不拥有最终打分权。

2. **unknown 不等于 0**
   - JD 没写薪资，不代表薪资差。
   - 用户没填地点偏好，不代表地点不匹配。
   - 缺失信息进入 `confidence: 'unknown'`，默认不参与加权总分。

3. **降权/标红优先于隐藏**
   - 年限、地点、薪资、avoid keywords 默认只是 warning。
   - 只有用户显式打开“必须满足”硬筛选时，才触发 `hardRejected`。

4. **TriageScore 和 MatchScore 分开**
   - 搜索结果页卡片只能做 `triage`，因为信息不完整。
   - 完整 JD + 简历 + Persona 才能做正式 `audit` 分数。

5. **Persona 是辅助，不是主导**
   - Persona 总权重上限为 10%-15%。
   - 紫微斗数默认只增强叙事；除非用户主动开启，否则不影响正式分。

---

## 2. Pass A / B / C

### Pass A: 规则证据层（代码 only）

输入：JD 标题/正文/薪资/地点 + `UserContext` + active resume。

输出：
- `experience`
- `location`
- `compensation`
- `avoid_keywords`

特点：
- 完全可复现。
- 缺失字段输出 unknown。
- 不调用 LLM。

### Pass B: LLM 证据抽取层

输入：完整 JD + active resume + preferences/personas。
**Phase 4.6 起**：Pass B 证据池升级为**所有简历的 union**（skills + projects + education 维度做并集，experience 仍按 active resume）。每条 evidence 允许尾标 `（来源: <resume label>）`；`SkillEvidence.sourceResumeIds?: string[]` 字段同步。详见 HANDOFF §4 D12 + Phase 4.6 章节。

输出：
- `matchedSkills[]`
- `missingSkills[]`
- `transferableSkills[]`
- `cultureSignals[]`
- `growthReasons[]`
- 可选 `personaReasons[]`
- **Phase 4.6 起** `recommended_resume?: { resumeId, label, reasoning, edits_suggestion: string[] }`（仅 Pro 深审输出，Triage 不出）

特点：
- 使用 Gemini `responseSchema`。
- 客户端二次校验。
- 不输出最终总分（铁律 1 守住——D12 升级后铁律不破）。

### Pass C: 代码聚合层

输入：Pass A + Pass B 的 `DimensionScore[]`。

输出：
- `overall`
- `label`
- `hardRejected`
- `rubricVersion`
- `scoringVersion`

特点：
- 只聚合有具体分数的维度。
- unknown 维度不进入分母。
- hard filter 失败时总分封顶为低分，但仍保留证据给用户查看。

---

## 3. 当前 v1 Rubric

| 维度 | 默认权重 | 来源 | 备注 |
|---|---:|---|---|
| experience | 20% | 代码 | 年限/资深度，缺数据 unknown |
| location | 10% | 代码 | 用户未填 preferredLocations 时 unknown |
| compensation | 10% | 代码 | 用薪资区间重叠度，不默认硬杀 |
| avoid_keywords | 10% | 代码 | 用户未填 avoidKeywords 时 unknown |
| skill | 25% | LLM 证据 + 代码 | matched / transferable / missing 聚合 |
| culture | 10% | LLM | JD 文化信号 |
| growth | 15% | LLM | 对用户阶段的成长价值 |
| persona | 0%-15% | LLM/Persona | 默认不主导；启用后受 cap 约束 |

这些权重是工程默认值，不宣称具有统计学真值。后续可通过用户反馈做个性化学习。

---

## 4. 未来反馈闭环

Phase 4 只预留 `MatchFeedbackRecord`，不训练模型。

未来可以记录：
- 用户给评分 1-5 星
- save / reject / apply / ignore 行为
- 当时的 dimension scores
- `scoringVersion` 与 `rubricVersion`

当单个用户样本量足够时，再用 Ridge / 受限线性回归学习个人偏好权重。少于约 30 条反馈时继续使用默认 rubric。

---

## 5. 与浏览器扩展的关系

扩展不做爬虫，不批量自动打开详情页（HANDOFF D4'）。

扩展阶段只提供两类输入：
- `JobCardSnapshot`：当前搜索结果页已经加载的卡片，用于 `triage`。
- `JobDetail`：用户主动点开详情后捕获的完整 JD，用于 `audit`。

这保证 Tianming 的省时价值来自"已加载内容的智能筛选"，而不是高风险自动化抓取。

---

## 6. Phase 8.x · 反向赋能（ML 反馈闭环）

> **术语澄清（v1.8 起）**：本节专指 **ML 学权重**（Track F · Phase 8.x），跟 Phase 8（Cover Letter / 简历针对性优化建议 · Track D 文案反向赋能）**不是一回事**。详见 HANDOFF §5 Phase 8 / Phase 8.x 章节。


`MatchFeedbackRecord` 类型已经在 `src/core/matchTypes.ts` 定义，并通过 `UserContext.feedbackRecords?: MatchFeedbackRecord[]` 在持久化层预留（v2 storage 自动 back-fill 为 `[]`）。

**v1 rubric 阶段**（当前）：
- `DEFAULT_SCORING_RUBRIC` 用工程经验权重，不宣称统计学真值。
- 所有 `MatchScore` 写入 `rubricVersion: 'rubric-v1'` 和当前 `scoringVersion`。Phase 4.5 的 location / salary fallback 后为 `phase4-scoring-v1.1`。

**Phase 8.x ML 阶段**（未实现）：
- 用户在 UI 给 JD 打 1-5 星或做 `save / reject / apply / ignore` 行为，自动写入 `feedbackRecords`。
- 当一个用户累积 ≥ 30 条反馈，触发**浏览器端** OLS / Ridge 回归：

  ```
  user_rating ≈ w₀ + w₁·skill + w₂·culture + w₃·growth + w₄·experience + ...
  ```

  学到的 `[w₁, ..., wₙ]` 替换 `DEFAULT_SCORING_RUBRIC` 中的权重，生成 `rubric-v2-personalized-<userId>`。
- < 30 条反馈时继续用默认 rubric。
- 学习全部在浏览器内进行，不上云（与 D6 一致）。

**铁律**：
- 训练数据（`feedbackRecords`）跟评分基准（rubric）解耦——任何 rubric 升级都不破坏旧的反馈记录。
- 学到的个性化 rubric 仍按 §1 原则工作（LLM 抽证据，代码算分），ML 只调权重，不让 LLM 算分。
- Persona 维度的总权重 cap 依然 ≤ 15%，ML 学到的 persona 权重也要走 `clampPersonaWeight`。
