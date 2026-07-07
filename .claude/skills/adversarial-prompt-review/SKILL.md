---
name: adversarial-prompt-review
description: 对 Gemini prompt（PRO_AUDIT_PROMPT / Pass B 抽证据 prompt / persona promptFragment 等）做对抗性行为预测 review——预判 Gemini 会不会绕过 schema、偷出分数、输出空话、漏标来源。当用户改了 prompt、新增 schema 字段、或说"帮我 review 这个 prompt"、"以前这活儿是 Grok 干的"时使用。产出报告落 doc/briefs/grok-replies/。
---

# Adversarial Prompt Review · Prompt 行为预测对抗审查

云端替代 Super Grok 的"prompt 设计行为预测 review"（HANDOFF §10.2）。核心问题永远是：
**"Gemini 拿到这个 prompt + schema，最坏会干出什么？"**

## 步骤

1. **定位标的**：默认审 `constants.tsx` 里的 `PRO_AUDIT_PROMPT`（含 `buildResumeUnionSection`
   拼装结果）和 `services/jobEvidenceExtractor.ts` 的 Pass B prompt/schema；用户指定了就审指定的。
   先读 `doc/scoring-rubric.md` §1（6 条铁律）作为判据。
2. **并行派 ≥3 个对抗性 subagent**（用 Agent 工具，各带独立视角，prompt 里要求"证明它会出问题"）：
   - **越狱视角**：schema 里有没有能藏最终分/结论的缝（`overall`、`judgment`、任何 0-100 数字字段、
     reasoning 里夹带"总分"字样）？约束语气够不够硬？
   - **空话/退化视角**：哪些字段会退化成放之四海皆准的废话（edits_suggestion 不具体、reasoning 不
     引用具体 skill/project）？union 场景会不会通胀吹分、漏标 `sourceResumeIds` 来源？
   - **边界视角**：无简历 / 单简历 / 字段缺失 / 超长 JD / 非英文 JD 时，退化分支是否仍守铁律？
     `unknown` 会不会被当 0？
3. **代码级自检**（对抗结论落地前先跑，写进报告）：
   ```bash
   grep -nE '"overall"|"judgment"' constants.tsx services/*.ts   # 期望：schema 定义中 0 命中
   grep -n "scoringVersion\|rubricVersion" src/core/*.ts types.ts # prompt 结构变了必须已 bump
   ```
4. **汇总报告**写入 `doc/briefs/grok-replies/<日期>-<标的>.md`：
   - 每个风险点：P0/P1/P2 分级 + 触发场景 + **可直接粘贴的 prompt 修改片段**
   - 结尾一节"未发现问题的检查项"（防止只报忧不报平安，读者无法判断覆盖面）
   - 文末版本行
5. **只报告，不直接改 prompt**——修改由用户拍板后另行执行（沿用 Grok 时代的写权隔离，防 scope creep）。
