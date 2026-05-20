# Brief · Claude Design · Phase 4.6 推荐简历 UI（1 天紧急）

> **会员窗口**：Claude Design 限时 1 天 · 今天必须出稿
> **接收者**：Claude Design（视觉 / UX）
> **发出者**：Claude Code（总监助手 · 守门）经用户拍板

---

## 1. North Star check（必读，决定一切设计取舍）

> **"帮一个怕错的人按下投递键。"**

- 目标用户：犹豫型 / ADHD 求职者
- 反目标：海投型用户（他们用 LinkedIn Easy Apply 就够了）
- 本次设计要解决的具体卡点：**用户有多份简历时，看 Pro 深审结果后不知道"我应该用哪份投这个 JD"** → freeze。

设计成功的标志：**用户看到 banner 1 秒内决定"用 XX 简历投 + 不用改"或"用 XX 简历投 + 改这两处"**，不再回去对比简历。

---

## 2. 背景（已经做完的 / 还在做的）

- **Phase 4.5 ✅ 已完成**：scoring engine 在多份简历上做了 union 评分，UI 组件 `src/components/ResumeMatchBreakdownCard.tsx` 已合 main（PR #27），目前展示 best/active resume 的命中 skills 对比。
- **Phase 4.6 进行中（本 brief 对应的 Phase）**：把 Pro 深审 prompt 也改用 union，并让 Gemini 输出 `recommended_resume = { resumeId, label, reasoning, edits_suggestion }` 字段。代码侧由 Codex 在 `feat/phase-4-6-pro-audit-union` 分支实施。
- **Phase 5 ✅ 已完成**：UserContext / 简历 Blob 走 Dexie/IndexedDB，多 tab 同步。

---

## 3. 字段 schema（设计稿要把这些字段映射到视觉元素）

Pro 深审完成后，`Job.analysis` 上会多出：

```ts
recommended_resume?: {
  resumeId: string;          // 推荐用哪份简历投
  label: string;              // 简历显示名（用户起的，如 "技术岗版"）
  reasoning: string;          // 1-3 句话讲为什么推荐这份
  edits_suggestion: string[]; // 0-N 条具体的"改这里"建议
                              // 例如："Project 2 的标题加 'TypeScript'"
                              // "Skills 段加一行 'AWS Lambda'"
};
```

**关键场景**：
- `recommended_resume.resumeId === activeResumeId` → 用户当前已选就是最优 → banner 可以低调（"当前简历已最匹配"或不显示）
- `recommended_resume.resumeId !== activeResumeId` → **核心场景** → banner 醒目提示 + 提供"切换简历"按钮 + 折叠展示 `edits_suggestion`

---

## 4. 输出（你今天要交付的东西）

### 4.1 设计稿 1：推荐简历 Banner（核心）

位置：Pro 深审结果页（`App.tsx` 现有 audit card 之上 / 之下 / 内嵌——由你判断）

要素清单（不可少）：
1. 一句话标题，例如「建议用『技术岗版』投这个职位」
2. `reasoning` 的展示位（1-3 句话）
3. **切换按钮**：点了改 `userCtx.activeResumeId`（Dexie 自动持久化）
4. **"看建议"折叠**：展开后显示 `edits_suggestion` 列表
5. **关掉/忽略按钮**：用户不想被打扰
6. 视觉状态：未读 / 已查看 / 已采纳

不要做：
- ❌ 模态弹窗（打断用户阅读 audit）
- ❌ 红色警告色（这不是错误，是建议）
- ❌ 强制"必须切换"——用户有权坚持用 active resume

### 4.2 设计稿 2：ResumeMatchBreakdownCard 接入位置

现有 `src/components/ResumeMatchBreakdownCard.tsx` 已写好但还没在 `App.tsx` 接入位置上有定论。请提议：

- 接入在 audit card 的哪个位置（顶 / 中 / 底）？
- 跟新的 Banner（4.1）的视觉关系是什么——是否并排 / 上下 / 共享容器？
- Phase 4.6 让 card 多展示 `recommended_resume.reasoning` 时，怎么不破坏现有视觉？

### 4.3 简短视觉规范（≤ 1 页）

- 用到的配色 token（沿用现有 indigo / emerald / rose / slate）
- 圆角 / 间距 / 字号
- 暗色模式适配点
- **不动 Tailwind config**——只用现有 utility class

---

## 5. 输入材料（你需要看的）

- `doc/HANDOFF.md` §1.5（North Star）+ §4 D11（Apply Assistant 分级铁律）+ §10.3（Claude Design 工作流操作指南）
- 现有视觉系统：用户已跑过"天命导航仪 Design System"（古典神秘风格，京华老宋体 / IM Fell English / LXGW WenKai），见 `doc/design/`
- 现有 audit card 视觉：`App.tsx` 当前 Pro 深审输出区
- ResumeMatchBreakdownCard 当前样式：`src/components/ResumeMatchBreakdownCard.tsx`

---

## 6. 边界（明确不要做）

- ❌ 不要重构 `App.tsx` 整体布局——只在现有 audit card 区域做加法
- ❌ 不要引入新的设计 token / 配色（沿用现有 Tailwind utility）
- ❌ 不要做 Phase 7 整体 UI 焕新（那是 M3 阶段，单独跑）
- ❌ 不要画 Apply Assistant L2 modal（那是 Phase 5.5，单独跑）
- ❌ 不要让 Gemini 输出"切换简历后的预测分数"（评分是代码的事，LLM 不出分数 · 评分铁律 1）

---

## 7. 交付形式

放进 `doc/design/phase-4-6/`：
- `recommended-resume-banner.png` + 可选 `.html` mock
- `breakdown-card-integration.png`
- `visual-spec.md`

或贴 Figma 链接到本 brief 的回复里（让用户存档）。

---

## 8. 验收清单

- [ ] North Star check：用户能 1 秒决定 → 是
- [ ] 字段映射：4 个 schema 字段都在视觉上有归属
- [ ] 暗色模式不破
- [ ] 移动端（≥320px）不破
- [ ] 跟现有 indigo / slate 视觉语言一致

---

*Brief 版本 v1.0 · 2026-05-20 · 配套 `feat/phase-4-6-pro-audit-union` 代码分支 · Claude Code 出*
