# Tianming · Project Context

> AI-powered career navigator combining LLM-driven job analysis
> with multi-persona user profiling (MBTI / Holland / Big5).

## 0. 每次接手必读

本文件保留项目背景和路线；具体 agent 工作流先通过 `doc/agent-workflow.md` 分流。

如果当前运行环境是 **Claude Code 云端 GitHub workspace**，新 session 开始时先读：

1. `doc/STATE.md`：**当前状态快照 + 重入锚点**（≤50 行，30 秒重入；它指向本轮真正需要读的章节，避免每次全量重读）。
2. `doc/agent-workflow.md`：判断运行环境，不混用本地/云端规则。
3. `claudecode.md`：Claude Code 云端开发 SOP。
4. `doc/HANDOFF.md` v2.0：项目总交接（**§1.5 North Star + §4 D1-D12 + §5.0 Tracks/Milestones + §10.2 五方分工 + §10.4 任务分发 brief 模板 + §11 接力指令的 6 条评分铁律必读**）。首次接手全文读；重复接手可按 STATE.md 指引只读变更章节。
5. `doc/scoring-rubric.md`：Phase 4 评分体系（Pass A/B/C 三层 + LLM 抽证据 / 代码算分根原则 + §6 Phase 8.x ML 反馈闭环方向）。
6. 当前 Phase notes，例如 Phase 4 期间读 `doc/phase-4-notes.md`，Phase 5 期间读 `doc/phase-5-notes.md`（如果存在）。
7. `doc/briefs/`：限时会员窗口给 Claude Design / Super Grok 的任务包；未来新 agent 接入也走这里。

仓库自带 **`.claude/skills/`** 项目技能（brief-writer / adversarial-prompt-review / iron-rules-review / handoff-sync），任何 Claude 模型（含 Opus）的 session 均可直接以 `/技能名` 调用，用于固化 brief 撰写、prompt 对抗 review、PR 铁律守门、文档同步四个高频仪式。

关键提醒：

- Claude Code 直接基于 GitHub 云端仓库状态工作，不假设能读取用户本地文件、SSH key、`.env.local` 或 Codex sandbox 状态。
- Codex 才负责本地 Windows workspace、SSH remote 检查、GitHub merge 后的本地 `main` 同步；对应规则见 `doc/codex-workflow.md`。
- 任何环境都不要把 SSH private key、API key、token 写入 repo 或文档。

## 一、项目背景

天命（Tianming）是一个面向求职者的智能岗位匹配工具。核心能力：

1. **批量 JD 初筛**（Gemini Flash）：30 份 JD 同时打分
2. **深度审计**（Gemini Pro）：单 JD 出"卦象 + 详细 Pros/Cons + 2026 求职指导 + 面试策略 + 合同红旗"
3. **未来路线**：Persona 插件系统（MBTI/Big5/Holland/紫微斗数）+ 简历上传与结构化解析 + 浏览器扩展一键采集 JD + 桌面端打包

## 二、当前状态

- **V7.0 baseline** 来自 Google AI Studio 导出，已完成两处适配：
  - `services/geminiService.ts`：从 `window.aistudio` API 改为 `getApiKey()` 助手，读 `localStorage` 或 `import.meta.env.VITE_GEMINI_API_KEY`
  - `App.tsx`：`checkApiKey` / `handleSelectKey` 改为本地 prompt + localStorage 方案
- 本地 `npm run dev` 可正常调用 Gemini API
- Phase 0/1/2/2.6/2.8/3/4/4.5/5A/5B ✅ Done（main 状态）：工具链 + UserContext + Persona 插件系统 + MBTI/RIASEC polish + 简历上传解析 + Match/Scoring Engine + 简历 Union 技能覆盖 + `ResumeMatchBreakdownCard` UI 接入（PR #27）+ Dexie 存储完整迁移（PR #26）。详见 `doc/HANDOFF.md` §2、`doc/phase-2-8-notes.md`、`doc/scoring-rubric.md`。
- `UserContext.feedbackRecords?: MatchFeedbackRecord[]` 字段已预留，给 Phase 8.x（**ML 学权重，归 Track F**）浏览器端轻量学习铺垫。
- **方向（2026-07-07 拍板，HANDOFF §4 D13）**：**产品化优先**，作品集角色退居其次；手动粘贴为一等公民、不用第三方爬取、双语化最晚 M3、模型可配置、盈利模式后置；隐私对外措辞已修正（D6 v2.1）；安全路线见 `doc/security-plan.md`。
- **当前焦点**：**M1 收尾**。Phase 4.6 数据层 ✅ Done（PR #31）+ **Phase 5.5 Apply Assistant L2 ✅ Done（PR #34**：`ApplyProfile` + `savedAnswers` + 邮件模式 + `recommended_resume` 最简文字 banner 占位，全程零 LLM，详见 `doc/phase-5-5-notes.md`）。4.6 完整视觉 2f/2g 延后到 M3 跟 Claude Design polish 一起做。**M1 剩余**：简历多版本切换 UX 整理 + 反通胀端到端 smoke → 宣告 M1 Done 转 M2 浏览器扩展。**接手先读 `doc/STATE.md`（当前状态快照 + 重入锚点）**；North Star + Tracks/Milestones 见 HANDOFF §1.5 + §5.0；五方分工见 §10.2；brief 模板见 §10.4。

## 三、Tech Stack

| 层 | 选型 |
|---|---|
| 框架 | React 18 + TypeScript + Vite |
| LLM SDK | `@google/genai` (Gemini 3 Flash + Pro) |
| 样式 | Tailwind CSS（Phase 1 引入）|
| 表单 | react-hook-form + Zod（Phase 1 引入）|
| 本地存储 | localStorage（当前）→ Dexie/IndexedDB（Phase 5 迁移）|
| 状态管理 | useState（保持，不引入 Redux/Zustand）|

## 四、Phase 路线图（V8 重构）

| Phase | 内容 | 状态 |
|---|---|---|
| 0 | V7.0 baseline import + AI Studio 依赖修复 | ✅ Done |
| 1 | `UserContext` 数据模型重构 + localStorage 迁移脚本 | ✅ Done |
| 2 | Persona Plugin 系统（MBTI / Holland / Big5 / 紫微斗数隐藏插件）| ✅ Done |
| 2.6 | Plugin polish（紫微双主星 / MBTI 信效度 / RIASEC 权重）| ✅ Done · PR #18 |
| 2.8 | MBTI 去职业刻板标签 + RIASEC 6 维原始分 + 百分比归一化 | ✅ Done · PR #20 |
| 3 | 简历上传 + Gemini 多模态结构化解析 | ✅ Done |
| 4 | Match Engine + Scoring Engine（可解释评分 + 统一上下文装配）| ✅ Done |
| 4.5 | 简历 Union 技能覆盖对比（scoring + UI）+ `ResumeMatchBreakdownCard` 接入 | ✅ Done · PR #27 |
| 4.6 | Pro 深审 union prompt + `recommended_resume` schema · 最简 banner 已随 PR #34 占位 · 完整视觉 2f/2g 延后 M3 | ✅ 数据层 Done · PR #31 |
| 5 | 存储升级 localStorage → Dexie（同时根治 Phase 4 A1 数据丢失）| ✅ Done · PR #26 |
| 5.5 | Apply Assistant L2（ApplyProfile + savedAnswers + 邮件模式 · 零 LLM）| ✅ Done · PR #34 |
| 6 | 浏览器扩展（MV3）+ 后端代理雏形（API Key 移出前端）| |
| 7 | UI 整体调整 + 简历多版本管理 | |
| 8 | Cover Letter 生成 / 简历针对性优化建议（**Track D 文案反向赋能**） | |
| 8.x | **反向赋能 / ML 反馈闭环**（OLS / Ridge 浏览器端学权重 · Track F · 跟 Phase 8 区分）| |
| 9 | 云同步（可选，Supabase/Firebase）| |
| 10 | PWA + Tauri 桌面端打包 | |
| 11 | 文档完善 + 部署上线 + Chrome Web Store 上架 | |

## 五、架构约定

### 数据模型当前态

```ts
interface UserContext {
  personas: PersonaInstance[];                 // 心理/玄学画像
  resumes: ResumeProfile[];                    // 简历多版本
  preferences: UserPreferences;                // 薪资/地区/避雷
  activeResumeId?: string;
  activePersonaIds: string[];
  feedbackRecords?: MatchFeedbackRecord[];     // Phase 8+ ML 学权重铺垫（已预留）
}
```

### 评分系统 6 条铁律（Phase 4 落地，长期遵守）

1. **LLM 抽证据，代码算分** — Gemini 永远不输出最终 `overall` 或 `judgment`。
2. **`unknown !== 0`** — 缺失数据进 `confidence: 'unknown'`，不进加权分母。
3. **降权 > 剔除** — `hardFail` 默认 false，只在用户显式打开 `hardFilters.*` 才触发。
4. **rubricVersion + scoringVersion bump** — 任何评分结构变动必须升版号。
5. **Persona 总权重上限 ≤ 15%** — 玄学不主导决策。
6. **JobCardSnapshot vs JobDetail 两层** — 卡片粗筛 vs 完整 audit 信息密度不同，对应不同评分目标（`'triage'` vs `'audit'`）。

## 六、隐私红线（详见 `doc/HANDOFF.md` §7 + D4'/D5/D6/D9）

- 永远不 commit `.env.local` / 不硬编码 API Key 到源代码。
- **简历原文件永不存储于本产品的服务器**（PII 红线，D6 v2.1 澄清）：解析时文件内容会发送给 Google Gemini API（即用即弃、不落库），必须向用户如实披露；对外文案禁用"简历不上云 / 不离开设备"类表述。结构化数据可上云但需 PII 脱敏。
- 公网部署前必须引入后端代理（API Key 不能暴露给浏览器）。Phase 6 起硬约束（D9）。
- 浏览器扩展不直连 Gemini（扩展包可被反编译，Key 必盗，D5）。
- **浏览器扩展不批量爬**：只读当前页已加载卡片 + 用户主动点开的详情；不后台批量自动请求（D4'，防封号 + 合规）。
