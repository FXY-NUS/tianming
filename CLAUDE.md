# Tianming · Project Context

> AI-powered career navigator combining LLM-driven job analysis
> with multi-persona user profiling (MBTI / Holland / Big5).

## 0. 每次接手必读

本文件保留项目背景和路线；具体 agent 工作流先通过 `doc/agent-workflow.md` 分流。

如果当前运行环境是 **Claude Code 云端 GitHub workspace**，新 session 开始时先读：

1. `doc/agent-workflow.md`：判断运行环境，不混用本地/云端规则。
2. `claudecode.md`：Claude Code 云端开发 SOP。
3. `doc/HANDOFF.md` v1.5：项目总交接（**§1.5 North Star + §4 D1-D11 + §5.0 Tracks/Milestones + §10.2 三方分工 + §11 接力指令的 6 条评分铁律必读**）。
4. `doc/scoring-rubric.md`：Phase 4 评分体系（Pass A/B/C 三层 + LLM 抽证据 / 代码算分根原则）。
5. 当前 Phase notes，例如 Phase 4 期间读 `doc/phase-4-notes.md`，Phase 5 期间读 `doc/phase-5-notes.md`（如果存在）。

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
- Phase 0 / 1 / 2 / 3 / **4 核心** 已 merge 进 main：工具链 + UserContext 数据模型 + Persona 插件系统（4 个）+ 简历上传与多模态解析 + **Match Engine + Scoring Engine**（LLM 抽证据 / 代码算分，Pass A/B/C 三层架构）+ Persona UI 接入。详见 `doc/HANDOFF.md` §2、`doc/phase-2/3/4-notes.md`、`doc/scoring-rubric.md`。
- `UserContext.feedbackRecords?: MatchFeedbackRecord[]` 字段已预留，给 Phase 8+ 浏览器端轻量 ML 学个性化权重铺垫。
- **当前焦点**：Phase 4 smoke-test 收尾（A1 数据丢失 / A2 简历→preferences 数据流 / A3 薪资 slider / A4 unknown 率）已 merged 到 main。Phase 2.6 紫微 polish 在 `feat/phase-2-6-ziwei-polish` 分支（含文墨天机 parser + opposingPalaces）。**North Star + Tracks/Milestones 已确立（见 HANDOFF §1.5 + §5.0）**。下一步按 Milestone 推：M1 → A 收尾 + B 紫微 polish 合并 + Track D Phase 5.5 启动。Codex / Claude Code / Claude Design 三方分工见 HANDOFF §10.2。

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
| 2.6 | Plugin polish（紫微双主星 / MBTI 信效度 / RIASEC 权重）| ⏸ 可并行 |
| 3 | 简历上传 + Gemini 多模态结构化解析 | ✅ Done |
| 4 | Match Engine + Scoring Engine（可解释评分 + 统一上下文装配）| ✅ 核心 / ⏳ smoke-test 收尾 |
| 5 | 存储升级 localStorage → Dexie（同时根治 Phase 4 A1 数据丢失）| ⏳ 下一步 |
| 5.5 | Gemini 多模态截图导入 JD（可选）| ⏸ 已搁置 |
| 6 | 浏览器扩展（MV3）+ 后端代理雏形（API Key 移出前端）| |
| 7 | UI 整体调整 + 简历多版本管理 | |
| 8 | 反向利用：Cover Letter 生成 / 简历针对性优化建议 + Phase 8.x ML 权重学习 | |
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
- **简历原文件永远不上云**（PII 红线，对应架构决策 D6）；结构化数据可上云但需 PII 脱敏。
- 公网部署前必须引入后端代理（API Key 不能暴露给浏览器）。Phase 6 起硬约束（D9）。
- 浏览器扩展不直连 Gemini（扩展包可被反编译，Key 必盗，D5）。
- **浏览器扩展不批量爬**：只读当前页已加载卡片 + 用户主动点开的详情；不后台批量自动请求（D4'，防封号 + 合规）。
