# Brief · Codex · Phase 5.5 Apply Assistant L2

> **接收者**：Codex（本地 Windows workspace · 主力执行）
> **发出者**：Claude Code（总监助手 · 守门）经用户拍板
> **建议分支**：`feat/phase-5-5-apply-assistant-l2`（基于最新 main HEAD = `65ba3c2`）
> **配套文档**：HANDOFF §4 D11（Apply L0-L5 分级）· §5 Phase 5.5 章节 · CLAUDE.md §4.3
> **版本**：v1.0 · 2026-05-27

---

## 1. North Star check

> **"帮一个怕错的人按下投递键。"**

本次任务要解决的具体卡点：
**用户决定投这个 JD 之后，最后一公里仍在 freeze**——
- 要去 ATS 表单一格一格手填姓名/电话/LinkedIn（每次重填焦虑）
- "Why interested in this company?" 又要现想（10 分钟没了）
- 是邮箱投递的话还要现场拼措辞 + 签名 → 干脆明天再投 → 永远不投

**成功标志（用户行为可观测）**：
- 用户深审完一个 JD → 点开 "📋 投递助手" → **30 秒内**完成 ATS 表单填写或邮件正文拼装 → 真的按了"提交/发送"。
- 用户回来说"今天投了 3 个"而不是"今天又只看不投"。

---

## 2. 背景（已经做完的 / 还在做的）

- ✅ **Phase 4.5**（PR #27）：`computeResumeBreakdown` + `ResumeMatchBreakdownCard`
- ✅ **Phase 5**（PR #26）：Dexie 存储迁移
- ✅ **Phase 4.6 数据层**（PR #31）：Pro 深审 union prompt + `recommended_resume` 字段 schema 已落 main
  - ⚠️ **Phase 4.6 UI 层延后到 M3**（跟 Claude Design polish 一起做），**本 Phase 只塞一个"最简版纯文字 banner"占位**
- ⏳ **Phase 5.5 本任务**：Apply Assistant L2 = 结构化字段一键复制
- ⏸ **Phase 6.5 L3**（overlay paste-helper）/ **Phase 8 文案反向赋能**：本 Phase **不碰**

**M1 进度**：5.5 落地 + 4.6 banner 占位 + 简历多版本切换 UX 整理 → M1 可宣告 Done，转 M2 浏览器扩展。

---

## 3. Q1-Q5 决策（用户拍板 · 不可回退）

| # | 决策 | 实施位置 |
|---|---|---|
| Q1 | **L2 不调 LLM**——只复制 deterministic 字段 + 用户预存模板 + 复用 Phase 4.6 已生成的 `recommended_resume.edits_suggestion`。LLM 文案生成归 Phase 8 | 全部代码层禁止新增 Gemini 调用 |
| Q2 | 入口位置：**单 JD 深审 modal 底部新增"📋 投递助手"折叠区**（默认收起；用户点开才展开） | `JobDetailModal.tsx`（或同等深审 modal） |
| Q3 | 新建 `UserPreferences.applyProfile?: ApplyProfile` 子段，集中存"投递常用字段" | `types.ts` + 新表单 UI |
| Q4 | 在 `applyProfile.savedAnswers?: SavedAnswer[]` 存 3-5 段**用户手写**的通用回答模板（纯文本） | 同上 |
| Q5 | Phase 4.6 `recommended_resume` UI **塞最简版纯文字 banner**（"推荐用 XX 简历投 · 点击切换 active"）零 design，M3 由 Design 翻 UI | 深审 modal 顶部 |

**铁律守门（6 条评分铁律 + Apply L0-L5 死规则）**：
- Apply 永远不做 L4/L5（自动 autofill / 自动 submit）。L2 是**"显示值 + 复制按钮"**，绝不模拟点击或注入 DOM。
- 不在 `Job.analysis` 里再加字段——本 Phase 不动 Pro audit schema（4.6 刚 bump 完版本）。
- 不调 Gemini → 不影响 `scoringEngine` / `rubricVersion` / `SCORING_VERSION`。

---

## 4. Schema 新增（写代码前对齐到这一版）

```ts
// types.ts 在 UserPreferences 末尾新增（保持向后兼容 → 全部 optional）

export interface ApplyProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  github?: string;
  portfolio?: string;
  workAuthStatus?: string;        // 例: "US Citizen" / "需要 H1B sponsor" / "Singapore PR"
  yearsExperience?: string;       // 字符串 — 用户可写 "1-2 years" / "Fresh grad"
  willingToRelocate?: 'yes' | 'no' | 'depends';
  earliestStartDate?: string;     // ISO date 或自由文本
  signature?: string;             // 邮件签名块（多行字符串，预存"-- \n张三 | NUS CS \n+65 ..."）
  savedAnswers?: SavedAnswer[];
}

export interface SavedAnswer {
  id: string;
  label: string;        // 例: "Why interested in startup?"
  content: string;      // 纯文本，可多段
  updatedAt: string;
}

export interface UserPreferences {
  // ... 现有字段保留不动
  applyProfile?: ApplyProfile;
}
```

**初始化策略**：
- 用户老 context 无 `applyProfile` → UI 显示"未设置投递档案"按钮，跳设置页（不要静默创建空对象）
- 首次进入设置页可**从 `activeResume.structured.basic` 预填** name/email/phone/location（一次性 prefill，提示"已从简历填入，可修改"），但不要每次自动覆盖

---

## 5. 实现拆解（commit 级 · 建议每步一 commit）

### 5a · types + 存储
- `types.ts` 加 `ApplyProfile` + `SavedAnswer` + `UserPreferences.applyProfile`
- 跑 `npm run typecheck`，确认没断现有调用

### 5b · 设置页 UI · 投递档案
- 在现有 "Preferences" / "档案设置" 页加 tab 或子区块 "投递助手 · 档案"
- 表单字段对应 `ApplyProfile`（除 savedAnswers 外）
- "从激活简历预填" 按钮 → 读 `activeResume.structured.basic` 填入
- 保存走现有 `setUserContext` 链路（Dexie 自动持久化）

### 5c · 设置页 UI · savedAnswers 管理
- 列表 + "新增"按钮 → modal 输入 label + content
- 编辑 / 删除 / 拖动排序（拖动可延后）
- **上限 10 条**（防滥用）

### 5d · 深审 modal · "📋 投递助手" 折叠区
- 在深审 modal 底部加 `<details>`（默认收起，节标题"📋 投递助手 · 30 秒投递准备"）
- 展开后**两个 tab**：
  - **"字段复制"**：每行 `[字段标签]   [值]   [📋 复制]`，遍历 `applyProfile` 已填字段
  - **"邮件模式"**：textarea 显示拼装后的邮件正文（见 5e），整块一键复制
- 顶部小字："投递档案未设置 → 点这去设置"（如果 `applyProfile` 为空）

### 5e · 邮件模式拼装逻辑（纯字符串拼接 · 不调 LLM）
```ts
function buildApplyEmail(args: {
  applyProfile: ApplyProfile;
  job: Job;
  selectedAnswerId?: string;   // 用户选用哪段 savedAnswer 作正文
}): string
```
模板：
```
Dear Hiring Team,

I am writing to express my interest in the [job.title] role at [job.company].

[selected savedAnswer.content]

I have attached my resume for your review. Please find my contact below.

Best regards,
[applyProfile.signature || `${fullName}\n${email}\n${phone}`]
```
- 如果没选 savedAnswer 或 savedAnswers 为空 → 中间段省略，**不要硬塞占位文字**
- UI 给一个下拉选哪个 savedAnswer 作正文
- "📋 复制完整邮件" 按钮

### 5f · recommended_resume 最简 banner（Phase 4.6 占位）
- 深审 modal 顶部加一行（**不是卡片，就一行小字 + 一个按钮**）：
  - 条件：`analysis.recommended_resume.resumeId` 存在且 `!== activeResumeId`
  - 内容："💡 推荐用 **[label]** 投这个 JD · [reasoning 截前 80 字]…  [切换为 active]"
  - 点击按钮 → 改 `activeResumeId`（已有 setter），banner 消失
- 如果 `resumeId === activeResumeId` → 显示 "✅ 当前简历已最匹配" 一行灰字（更小）
- **不渲染 edits_suggestion 列表**（推到 M3 Design 做）
- **整段不超过 30 行 JSX**——故意丑，让 Design 后面有重做空间

### 5g · 测试
- `npm run typecheck` + `npm run lint` 全绿
- 给 `buildApplyEmail` 写单测（覆盖：有 savedAnswer / 无 savedAnswer / 无 signature）
- **UI 不要求 E2E**——本地手测 + 截图给用户

---

## 6. 输入材料（Codex 需要读的文件）

| 文件 | 重点章节 |
|---|---|
| `doc/HANDOFF.md` | §1.5 North Star · §4 D11（Apply 分级死规则）· §4 D12（4.6 ` recommended_resume` schema）· §5 Phase 5.5 章节 · §10.2 五方分工 |
| `CLAUDE.md` | §4.3（Apply L0-L5 不可越界）· §4.5（永久不做清单）· §6 用户隐藏 context |
| `types.ts` | `UserPreferences` / `ResumeStructured` / `Job.analysis` 现状 |
| `src/core/matchTypes.ts` | `RecommendedResume` 类型（5f banner 要用）|
| `src/components/ResumeMatchBreakdownCard.tsx` | 现有深审模块结构参考 |
| `App.tsx` | 找深审 modal 渲染入口 + `setUserContext` 调用范式 |
| `services/profileSuggestions.ts` | 现有"profile suggestions"模式参考（不要直接复用，避免耦合）|

---

## 7. 边界（明确不要做）

- ❌ **不调 Gemini / 不调任何 LLM**——本 Phase 全部纯前端 + localStorage/Dexie
- ❌ **不写 autofill / 不模拟 DOM 点击 / 不做 content script**（那是 L4/L5 永久不做）
- ❌ **不动 Pro audit prompt / 不动 scoringEngine / 不 bump rubricVersion**
- ❌ **不渲染 `recommended_resume.edits_suggestion` 详细 UI**——Design 在 M3 做
- ❌ **不要"AI 润色 savedAnswer"按钮**——Phase 8 文案任务，不在本 Phase
- ❌ **不要给 ATS 字段映射做 "smart guess"**（比如读 ATS DOM 自动识别"Years of Experience"字段）——L3 范畴
- ❌ **不在 JD 里提取邮箱**（用户自己从 JD 复制）
- ❌ **不要给 savedAnswers 加版本控制 / 分类 / 标签 / 搜索**——保持最简
- ❌ **不要"投递历史"日志**——`Job.status === 'Applied'` 已经够用

---

## 8. 验收清单（Codex 自检 + Claude Code 守门）

### North Star check
- [ ] 用户本地 smoke：从深审 modal 30 秒内完成 ATS 表单字段填写 or 邮件正文复制
- [ ] savedAnswers 模板真能省"现想 Why interested"的 5-10 分钟
- [ ] 没引入任何"再让用户选一次"的 freeze 点（默认收起 / 字段顺序合理）

### 铁律 check
- [ ] 没新增 Gemini 调用（grep `generateContent` / `GoogleGenAI` 无增量）
- [ ] `SCORING_VERSION` / `rubricVersion` 未改动
- [ ] `Job.analysis` schema 未改动（4.6 刚 bump 完）
- [ ] 没引入 `document.querySelector` / `MutationObserver` / Chrome extension API（确认 L4/L5 红线）

### 边界 check
- [ ] `applyProfile` 全部字段 optional · 老 context 加载不崩
- [ ] `savedAnswers` 上限 10 条强制（UI + 类型层都拦）
- [ ] `recommended_resume` banner 只渲染纯文字 + 1 个按钮，无任何样式投入
- [ ] 邮件模式仅做字符串拼接 · 不调 LLM · 无 savedAnswer 选项时优雅降级

### 字段映射 / 测试
- [ ] `npm run typecheck` 全绿
- [ ] `npm run lint` 全绿
- [ ] `buildApplyEmail` 单测覆盖 3 种 case（有/无 savedAnswer / 无 signature）
- [ ] 老用户（无 applyProfile 字段的 context）打开 app 不报错 · 看到 "未设置" 引导

### PR 准备
- [ ] PR 描述列：本 PR 做了 5a-5g 哪几步 · 截图深审 modal "📋 投递助手" 展开态 + 邮件模式 + recommended_resume banner
- [ ] 在 PR 描述里**显式声明**："本 PR 不动 scoring / 不调 LLM / 不做 L4-L5 autofill"
- [ ] 顺手在 `doc/phase-5-5-notes.md`（新建）写 30-80 行落地笔记，模仿 `doc/phase-4-6-notes.md` 结构

---

## 9. 沟通约定

- 任何字段命名 / UX 改动想偏离本 brief → **先在 PR draft 状态找 Claude Code 对齐**，不要 silently 偏
- 5f banner 觉得太丑想加样式 → **忍住**，那是 M3 Design 的活
- 发现 Phase 4.6 数据层有 bug → 单开 hotfix PR，不要混进本 PR

> brief v1.0 · 2026-05-27 · Phase 5.5 启动
