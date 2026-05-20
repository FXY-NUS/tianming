# Brief · Super Grok · Day 1（prompt review + ML 反向赋能 RFC）

> **会员窗口**：Super Grok 限时 3 天 · 本 brief 是 Day 1 任务包
> **接收者**：Super Grok（推理 / 行为预测 / 跨章节审计强项）
> **发出者**：Claude Code（总监助手 · 守门）经用户拍板

---

## 1. North Star check（决定一切建议方向）

> **"帮一个怕错的人按下投递键。"**

任何建议必须经过这个过滤器：
- ✅ "这让用户少 freeze 一次了吗？" → 提
- ❌ "这只对海投型用户有价值？" → 不提
- ❌ "这增加用户的认知负担？" → 不提

---

## 2. 任务总览

Day 1 给两个产出：
- **任务 A**：Phase 4.6 `PRO_AUDIT_PROMPT` 草稿行为预测 review（≤1500 字）
- **任务 B**：Phase 8.x 反向赋能（ML 学权重）RFC 草案（≤2000 字）

两个任务输出 **2 份独立 markdown 报告**，放在 `doc/briefs/grok-replies/` 下。

---

## 3. 任务 A · PRO_AUDIT_PROMPT 行为预测 review

### 3.1 背景

Tianming 的 Pro 深审现在装配「单份激活简历」给 Gemini Pro。Phase 4.6 改为装配「所有简历的 union」（skills + projects + education union；experience 仍按 active 避免时间冲突），并要求 Gemini 输出：

```ts
recommended_resume?: {
  resumeId: string;
  label: string;
  reasoning: string;
  edits_suggestion: string[];
}
```

加上 4 个约束（用户拍板）：
- **Q1**：union 粒度只到 skills/projects/education，experience 不 union
- **Q2**：每条 evidence（pros/cons/skill）尾部允许标 "（来源: <resume label>）"
- **Q3**：某 skill 只在 1/N 简历里出现且**不是 active 简历**时，scoring engine 把该条贡献 ×0.5（防 union 通胀）
- **Q4**：审计层用 union 跑分 + narrative，输出 `recommended_resume`

### 3.2 你的任务

拿到 Codex 出的 `PRO_AUDIT_PROMPT` 草稿（用户会单独提供 · 可能是 `constants.tsx` diff 或纯 prompt 文本），**预测 Gemini Pro 的实际行为**：

1. **绕过 schema 的风险**：Gemini 会不会偷偷输出 `overall` 数字 / `judgment` 字段？（评分铁律 1：LLM 不出分）。如果会，提具体改 prompt 的方式（约束词 / 反例 / 重复强调）。
2. **edits_suggestion 质量风险**：Gemini 会不会把 `edits_suggestion` 写成"建议加强技能"这种空话？怎么 prompt 才能逼出"加一条 'AWS Lambda 优化冷启动' 到 Project 2"这种具体 bullet？
3. **source 标注风险**：Gemini 会不会忘了在 evidence 尾标 `（来源: <label>）`？或者把所有都标成 active resume？
4. **Q3 通胀风险（关键）**：即使代码层有 ×0.5 权重约束，narrative 层 Gemini 会不会还是写"你具备 AWS / Kubernetes / Rust"让用户产生"什么 JD 都很匹配"的错觉？怎么 prompt 让 Gemini 明确区分"主力简历的核心技能" vs "其他简历的潜在技能"？
5. **退化场景**：用户只上传 1 份简历时，prompt 是否能优雅退化（recommended_resume 等于唯一那份简历，不画蛇添足）？

### 3.3 输出格式（任务 A）

`doc/briefs/grok-replies/day-1-prompt-review.md`：

```markdown
# Grok Day 1 · PRO_AUDIT_PROMPT 行为预测 review

## 1. 整体诊断（一段话结论）

## 2. 高风险问题（按严重度排序）
| # | 风险 | 触发场景 | 建议 prompt 改法 |

## 3. 低风险但值得改的点

## 4. 我会建议加进 prompt 的具体片段
（直接给可粘贴的中英文片段）

## 5. 测试建议
（如果代码合并前要先验，可以构造哪几个 JD/简历组合做对照）
```

---

## 4. 任务 B · Phase 8.x 反向赋能 ML RFC 草案

### 4.1 背景

`UserContext.feedbackRecords?: MatchFeedbackRecord[]` 字段已在 `src/core/matchTypes.ts` 定义，持久化层 v2 storage 自动 back-fill 为 `[]`。当前 v1 rubric（`DEFAULT_SCORING_RUBRIC`）用工程经验权重，**不宣称统计学真值**。

`doc/scoring-rubric.md` §6 已经写了高层方向：用户累积 ≥30 条反馈 → 浏览器端跑 OLS / Ridge 学个性化权重 → 替换 `DEFAULT_SCORING_RUBRIC` 中的权重，生成 `rubric-v2-personalized-<userId>`。学习全部在浏览器内进行，不上云。

但这段是"方向"，不是 "RFC"。你的任务是出**可被工程实施的 RFC**。

### 4.2 你的任务

出一份 RFC 草案（≤2000 字），覆盖：

1. **算法选择**：OLS vs Ridge vs 在线学习（SGD / passive-aggressive）vs 贝叶斯逻辑回归。**给出推荐 + 理由**（不要"各有优劣"流水账）。
2. **浏览器端复杂度上限**：n 维特征向量（n = 8 个 dimension）× 30-1000 条样本 × 浏览器 main thread / web worker 哪个跑得动；TFJS 还是手写矩阵运算？
3. **冷启动策略**：< 30 条反馈用什么？逐步混合 `DEFAULT_SCORING_RUBRIC` 还是直接用默认？怎么平滑过渡？
4. **训练数据 schema 校验**：用户反馈有几种（1-5 星 / save / reject / apply / ignore），怎么转成统一的回归目标 y？
5. **持久化 + 版本管理**：学到的 weight 怎么存（IndexedDB 哪个表）？`rubricVersion` 怎么命名（`rubric-v2-personalized-<userId>-<hash>`）？什么时候触发重新训练（每 N 条新反馈 / 用户主动触发 / 自动 cron）？
6. **失败处理**：训练 NaN / 权重崩到全 0 / 用户撤销反馈，怎么 fallback？
7. **隐私 + 合规**：数据完全在浏览器（与 D6 一致），但要不要给用户"导出 / 删除我的反馈数据"按钮？
8. **跟现行 6 条评分铁律的兼容性 check**：
   - 学到的 persona 权重还要走 `clampPersonaWeight` 保 ≤15%
   - 学到的 weight 不让 LLM 介入算 overall
   - `rubricVersion` + `scoringVersion` bump 必须严格

### 4.3 输出格式（任务 B）

`doc/briefs/grok-replies/day-1-phase-8x-ml-rfc.md`：

```markdown
# Grok Day 1 · Phase 8.x 反向赋能 ML RFC 草案

## 0. TL;DR（≤100 字结论）

## 1. 推荐算法 + 理由

## 2. 浏览器端实现可行性

## 3. 冷启动 + 数据 schema

## 4. 持久化 + 版本管理

## 5. 失败处理 + 隐私

## 6. 6 条铁律兼容性 check

## 7. 下一步可执行清单
- [ ] 先做 X（最小可验证）
- [ ] 再做 Y
- [ ] 最后做 Z
```

---

## 5. 边界（明确不要做）

- ❌ 不要写代码（不接 codebase · 只出 markdown 报告）
- ❌ 不要改任何现有 prompt / rubric / phase notes
- ❌ 不要建议把 ML 学到的权重上云（D6 + D9 红线）
- ❌ 不要超出 Phase 8.x 范围讨论"如果接 Claude / GPT 怎么算"（那是 D10，预留不实现）
- ❌ 不要建议用 OpenAI Embedding 做 cosine similarity 算 match score（评分铁律 1：LLM 不算分）

---

## 6. 输入材料（你需要读的）

| 文件 | 重点章节 |
|---|---|
| `doc/HANDOFF.md` | §1.5 North Star · §4 D6/D7/D9/D10 · §5 Phase 4 + Phase 8 · §11 接力指令最后 "6 条评分铁律" |
| `doc/scoring-rubric.md` | §1 核心原则 · §3 当前 v1 rubric · §6 ML 反馈闭环段落 |
| `src/core/matchTypes.ts` | `MatchFeedbackRecord` 类型定义 |
| `src/core/scoringEngine.ts` | `DEFAULT_SCORING_RUBRIC` + `clampPersonaWeight` |
| `CLAUDE.md` | §五 评分系统 6 条铁律 |

---

## 7. 验收清单

**任务 A 验收**：
- [ ] 5 个风险点都有具体 prompt 修改建议（不是"应该注意"流水账）
- [ ] §4 有可直接粘贴到 `constants.tsx` 的中英文 prompt 片段

**任务 B 验收**：
- [ ] 算法推荐是单选 + 一段话理由（不是 4 选罗列）
- [ ] §7 下一步清单是 commit 级（不是"先调研"）
- [ ] 6 条铁律兼容性 check 全部 ✅ 或明确解释为何破例

---

*Brief 版本 v1.0 · 2026-05-20 · Day 2-3 任务（六爻 plugin / scoring 盲点审计 / HANDOFF v1.6→v1.8 一致性校对）单独 brief · Claude Code 出*
