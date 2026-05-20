# Phase 2.8 落地总结 · MBTI / RIASEC plugin polish

> 本文档是 Phase 2.8 的实施记录，对应 HANDOFF.md §5 Phase 2.8。
> 目的：把刚做完的 MBTI / RIASEC 设计抉择钉死，让将来改这两个 plugin 的人（或者补六爻 / 八字 / 命格新 plugin 的人）不用重新踩坑。
> Branch: `feat/phase-2-8-mbti-riasec-polish` · Commits: `ed3e0b7` (MBTI) + `1270034` (RIASEC)

---

## 1. Phase 2.8 目标与实际范围

**HANDOFF §Phase 2.8 原计划**：
- MBTI promptFragment 去刻板印象（不输出"INTJ 适合 X"），改成只输出人格 dimension 倾向；description 引 Pittenger 1993 critique
- RIASEC schema 加可选 `scores: {R,I,A,S,E,C: number}` 完整量表；未填完整时按 3:2:1 权重映射主/次/三主导

**实际落地范围**：
- ✅ MBTI：替换 `MBTI_DESCRIPTIONS` 16 个职业刻板 label 为 4 维 dimension 展开；promptFragment 改输出 4 个 dimension 倾向 + Pittenger 1993 critique 注脚；plugin.description 加"非职业诊断"框定
- ✅ RIASEC：schema 加可选 `scores`；`deriveHollandRawScores()` + `hollandPercentages()` 两段式归一化；promptFragment 输出"6 维强度（占比）"+ 来源标注；HollandForm 加可折叠 6 输入区
- ✅ 测试同步更新：MBTI 8 个新增 / 重写 case；Holland 17 个新增 / 重写 case；全套 199/199 pass
- ⚠️ **不在范围**：MBTI dimension strength sliders（留 backlog，见 §8）；RIASEC 6 维 slider UI（同上）；form UX 的 raw / percent 实时回显（同上）

**接口签名 0 变化**：constants.tsx 的 `mbtiPromptFragment(data: MbtiData)` / `hollandPromptFragment(data: HollandData)` 调用方完全没动，只是输出更丰富。外部消费者 0 影响。

---

## 2. MBTI 的核心抉择

### 2.1 问题不是"INTJ 适合 X"，问题是 `MBTI_DESCRIPTIONS` 自身

HANDOFF §Phase 2.8 措辞是"不输出 INTJ 适合 X"，但实际看 v1 代码：

```ts
// 旧 promptFragment（已删）
lines.push(`- 类型: **${data.type}** (${MBTI_DESCRIPTIONS[data.type]})`);
// 旧 MBTI_DESCRIPTIONS
INTJ: '建筑师 · 战略思考者',
ENFP: '竞选者 · 热情的创造者',
```

输出实例：`类型: **INTJ** (建筑师 · 战略思考者)`。**没有显式"适合 X 职业"，但"建筑师 · 战略思考者"这种职业拟人化标签会 prime Gemini 反推"既然你是建筑师型，岗位 X 比 Y 合适"**——本质是同一类污染。

修复路径：

| 方案 | 评估 |
|---|---|
| A. 删 MBTI_DESCRIPTIONS 整个常量 | dropdown 失去 hint，用户 picking 体验变差 |
| B. 保留旧 cliché label 给 dropdown，promptFragment 内部不引用 | 代码层留下"DESCRIPTIONS 但 prompt 不让用"的歧义，后续 contributor 会再加回去 |
| **C. 替换 MBTI_DESCRIPTIONS 内容为中性 dimension 展开**（采用） | dropdown 仍有 hint（INTJ → "内倾 · 直觉 · 思维 · 判断"），prompt 自然走干净通路，常量名跟内容自洽 |

### 2.2 dimension label 两层（短 / 长）

| 用途 | 常量 | 输出例 |
|---|---|---|
| UI dropdown / 紧凑显示 | `MBTI_DIMENSION_LABEL` | `'内倾'` |
| promptFragment / Gemini 上下文 | `MBTI_DIMENSION_DESCRIPTION` | `'内倾 (I) · 能量与注意力优先朝向内省与独处'` |

`MBTI_DESCRIPTIONS[type]` 现在是从 `MBTI_DIMENSION_LABEL` 程序化生成，单一信息源：

```ts
export const MBTI_DESCRIPTIONS = Object.fromEntries(
  MBTI_TYPES.map((t) => [t, mbtiLetters(t).map((l) => MBTI_DIMENSION_LABEL[l]).join(' · ')]),
);
```

将来要改翻译 / 加 i18n / 调维度顺序，只动 `MBTI_DIMENSION_LABEL` 一处。

### 2.3 为什么 prompt 末尾加 Pittenger 1993 注脚

```
> 注：MBTI 仅作 4 个维度的辅助参考，不构成职业诊断；自行结合岗位实际职责权衡（参考 Pittenger, 1993, "Measuring the MBTI… And Coming Up Short"）。
```

不是给用户看的，是**给 Gemini 看的边界声明**：

- 引证学术 critique（Pittenger, J. C., 1993, *Journal of Career Planning*）让 Gemini 在生成 audit 时降低"MBTI 决定职业"的置信度
- "辅助参考 / 不构成诊断"是显式 anti-pattern 标记
- 注脚是 Markdown blockquote 形式，prompt 拼接后 Gemini 能识别"这是元约束，不是内容"

副作用：plugin.description 也加了这段引证，让 UI 副标题能让用户读到"嗯，这工具自己知道自己几斤几两"——降信任阶梯。

### 2.4 没动 schema 的理由

HANDOFF §Phase 2.8 没要求加 dimension strength sliders。延迟决策：
- 加 4 个 0-100 strength 字段 = schema breaking change + form 改造 + 用户回填动作
- 真实痛点是 "Gemini 输出职业刻板印象"，这个不靠 strength sliders 解决
- 借鉴 ziwei 的迭代节奏（先 `mainStars[1..2]`，再 `mainStarStrengths`，再 UI），等用户报告"我是 borderline N/S"再加

---

## 3. RIASEC 的核心抉择

### 3.1 不锁固定 scale，接受任意原始分

用户提了真实痛点："我之前测试结果是 A21, C16, R15, S11, I9, E7，能映射吗？有标准映射操作吗？"

- O*NET Interest Profiler：每维 0-40（8 items × 0-5）
- Self-Directed Search（Holland 原版）：每维 0-50
- 中文常见量表：另一套

**没有"标准映射"**。但有"标准做法"：归一化为总和的百分比。

采用：

```ts
schema: scores?: { R, I, A, S, E, C: int >= 0 }   // 接受任意非负整数，无上限
runtime: deriveHollandRawScores → hollandPercentages   // 总和归一化
prompt:   "A=27% · C=20% · R=19% · S=14% · I=11% · E=9%"
```

跨测试可比，跨用户可比，跨时间（用户复测）可比。

### 3.2 3:2:1 fallback 数学

未填 scores 时，从 primary/secondary/tertiary 派生 raw 权重 `[3, 2, 1]`，然后走相同的百分比归一化通路：

| 填了几位 | raw 权重 | 归一化 |
|---|---|---|
| 仅 primary | `[3, 0, 0]` | `100%` |
| primary + secondary | `[3, 2, 0]` | `60% / 40%` |
| 三位都填 | `[3, 2, 1]` | `50% / 33% / 17%` |

**Why 3:2:1 而不是 1:2:3 / 7:5:3 / 黄金分割**：3:2:1 是 HANDOFF §Phase 2.8 字面要求，且直觉上"主导是次的 1.5 倍 / 第三的 3 倍"符合一般认知；没有学术依据，是工程默认值。如果将来 Phase 8+ ML 反馈说不准，可以个性化学习权重（rubric 系统已经支持，跟 RIASEC fallback 解耦）。

### 3.3 为什么 normaliser 在 promptFragment 调用，不入库

- **入库** = schema 存 `{scores, percentages, rawDerived}` 三份 → 数据冗余 + 校验复杂度爆炸
- **promptFragment 调用** = schema 只存用户实际输入的 `scores`（或空），渲染时按需归一化

代价：每次拼 prompt 重算一遍归一化（6 个 letter 一遍 sum + 6 次除法 + round），对 prompt 装配性能影响 < 1ms，可以忽略。

### 3.4 prompt 输出加来源标注（hasUserScores）

```
用户填了真分数 → "原始分: A=21 · C=16 · ...（来源: 用户提供的 RIASEC 测评分数）"
仅填 primary/secondary/tertiary → "来源: 按 3:2:1 默认权重从主/次/三映射推断"
```

让 Gemini 知道置信度高低——前者是"信号强"，后者是"基本只表达主次序"。Gemini 在 audit narrative 里可以据此调措辞（"你 26.6% 的艺术倾向与岗位 X 的 ..."  vs  "你倾向艺术 / 常规 / 实际方向，但具体 6 维分布信息有限"）。

### 3.5 Form：可折叠 + 默认收起 + 全空清字段

```tsx
<details open={hasAnyScore(value.scores)} ...>
```

- 新用户进来：没分数，区域收起，3 个下拉是默认入口
- 已填过分数：再打开 form 时区域自动展开，让用户看到记录
- 6 个 input 全空 → onChange 把 scores 设为 undefined，schema 自动不存
- 部分填（只填 A 和 C）→ scores 存 `{A: 10, C: 5}`，归一化时 R/I/S/E 默认 0

这样**新用户 0 体感负担**，**老用户的真实分数被尊重**——符合 North Star 的 onboarding 最低门槛原则。

---

## 4. 测试范式延续

继续 Phase 2 §5 的三层结构 + 新增"helper 函数层"：

```ts
describe('xxx schema', () => { /* safeParse happy/sad */ });
describe('xxx helper functions', () => { /* deriveHollandRawScores / hollandPercentages / hasUserScores 各种 case */ });
describe('xxxPromptFragment', () => { /* Markdown 输出 + 关键标记 + 边界 */ });
describe('xxxPlugin definition', () => { /* id / category / emptyData 自洽 */ });
```

**新增模式**：用户提供的真实数据点（A21/C16/R15/S11/I9/E7）写进测试 case 作为锚——既验证 27% / 20% / 19% 等百分比正确，又给后续 reader 一个直观的"用户真实分数大概长这样"。

**新增 anti-pattern 测试**：blocklist 测试确保 `MBTI_DESCRIPTIONS` 永远不会再含 "建筑师 / 指挥官 / 竞选者 / 物流师 / 总经理 / 提倡者 / 逻辑学家" 这些 cliché——防止 Gemini-suggested PR 回滚。

---

## 5. 跟 North Star 的对齐

| North Star | Phase 2.8 如何兑现 |
|---|---|
| "帮一个怕错的人按下投递键" | MBTI / RIASEC 都不替用户做职业判断，只提供 dimension 信号让 Gemini 结合具体 JD 自己说理 |
| 不暴露过滤数字 / 桶 / 漏斗 | Persona 维度的 prompt 输出走"维度倾向 + 量化强度"，不输出"你应该选 X 个 JD" |
| 玄学 / 性格不主导决策 | persona 总权重 cap ≤ 15% 在 scoring engine 里强制（Phase 4 已实现），Phase 2.8 不动 |
| 新用户最低门槛 | Form 改造不引入新必填字段，6 维 input 默认收起 |

---

## 6. 已建立的代码层范式

| 范式 | 位置 | 复用场景 |
|---|---|---|
| **dimension label 两层（短/长）** | `mbti/schema.ts` MBTI_DIMENSION_LABEL / MBTI_DIMENSION_DESCRIPTION | 任何"UI 紧凑 vs prompt 充分"的 plugin 字段；六爻 / 八字未来可参考 |
| **可选 numeric record + 总和归一化** | `holland/schema.ts` HollandScoresSchema + `index.ts` deriveHollandRawScores → hollandPercentages | 任何接受"任意原始分量表"的输入 plugin |
| **来源标注（user vs derived）** | `holland/index.ts` hasUserScores | 任何"有真数据走真数据 / 有空走默认推断"的 plugin 都应在 prompt 明示来源 |
| **Form 可折叠进阶字段** | `holland/HollandForm.tsx` `<details>` + hasAnyScore | 任何"基础必填 + 进阶可选"的 plugin，避免新用户被吓跑 |
| **prompt 末尾元约束（Pittenger 注脚）** | `mbti/index.ts` 末尾 blockquote | 任何"工具有学术争议 / 业界 critique"的 plugin（命理类几乎都需要）|
| **anti-pattern blocklist test** | `mbti/index.test.ts` cliché test | 任何"绝对不允许出现某种 phrase"的 plugin（防止回滚 / Gemini-suggested PR 重新引入污染）|

---

## 7. 未完成 / 后续接手项

下列内容**有意推迟**，不是遗漏：

1. **MBTI dimension strength sliders**：当前只有 type 单字段。用户报告"我是 borderline N/S"再加。改 schema 时参考 ziwei `mainStarStrengths` 的 normaliser 范式。
2. **RIASEC 6 维 slider UI**：当前 number input 直接接受原始分。如果用户报告"我没记住测试分但记得相对强弱"，加 slider 模式（0-100 直接拖）。
3. **promptFragment smoke test**：本 Phase 没有跑真实 Gemini 验证 4 维倾向 prompt 是否让 audit narrative 真的变中性。建议 Phase 4.5 smoke 阶段顺手验证。
4. **MBTI_DESCRIPTIONS 翻译 / i18n**：当前中文硬编码。Phase 7 UI 重做 + i18n 时统一处理。
5. **测试覆盖率不含 form 交互**：HollandForm 的 `<details>` 折叠 / 6 input edit / hasAnyScore 切换没有 React Testing Library 测试。沿用 Phase 2 ZiweiForm 的"form test 暂缺"惯例。

---

## 8. 已知后续风险

- **dimension expansion 翻译准确性**：当前 `T: '思维 (T) · 决策偏向逻辑分析'` / `F: '情感 (F) · 决策偏向价值与关系'` 是常见但有争议的翻译——MBTI 社区对 T/F 是否等价于"理性 vs 感性"有长期辩论。若用户反馈"我是 F 但你说我'决策偏向价值与关系'不准"，改 `MBTI_DIMENSION_DESCRIPTION` 即可，不影响 schema 和 prompt 结构。
- **RIASEC raw 分数无上限**：用户理论上可以填 R=99999，归一化后该维占 100%。这是设计选择（不锁 scale），不是 bug。如果真有人这样填，prompt 输出会显著倾向那一维——Gemini 会得到合理的"这人极端偏 R 型"信号。
- **百分比 sum 可能 ±1-2 漂移**：rounding 累积误差。`hollandPercentages` 测试 case 显式允许 98-102 范围。如果将来要做"严格 sum=100"，需要追加 largest-remainder 修正算法。
- **3:2:1 fallback 数值是工程默认**：没学术依据。Phase 8+ ML 反馈如果发现用户实际偏好不是 3:2:1，可以个性化学习（rubric 系统支持，且 RIASEC fallback 跟 ML 权重正交）。
- **MBTI / RIASEC plugin id 不变**：`'mbti'` / `'holland'` 是持久化键（跟 ziwei 同样规则）。Phase 2.8 没改 id，老用户数据 0 影响。后续如果要做 v2 schema，参考 Phase 1 的 LegacyProfile migration 路径。
