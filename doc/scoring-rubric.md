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

输出：
- `matchedSkills[]`
- `missingSkills[]`
- `transferableSkills[]`
- `cultureSignals[]`
- `growthReasons[]`
- 可选 `personaReasons[]`

特点：
- 使用 Gemini `responseSchema`。
- 客户端二次校验。
- 不输出最终总分。

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

扩展不做爬虫，不批量自动打开详情页。

扩展阶段只提供两类输入：
- `JobCardSnapshot`：当前搜索结果页已经加载的卡片，用于 `triage`。
- `JobDetail`：用户主动点开详情后捕获的完整 JD，用于 `audit`。

这保证 Tianming 的省时价值来自“已加载内容的智能筛选”，而不是高风险自动化抓取。
