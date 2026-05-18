# Tianming · Project Context

> AI-powered career navigator combining LLM-driven job analysis
> with multi-persona user profiling (MBTI / Holland / Big5).

## 0. 每次接手必读

本文件保留项目背景和路线；具体 agent 工作流先通过 `doc/agent-workflow.md` 分流。

如果当前运行环境是 **Claude Code 云端 GitHub workspace**，新 session 开始时先读：

1. `doc/agent-workflow.md`：判断运行环境，不混用本地/云端规则。
2. `claudecode.md`：Claude Code 云端开发 SOP。
3. `doc/HANDOFF.md`：项目总交接和 Phase 路线。
4. 当前 Phase notes，例如 Phase 4 期间读 `doc/scoring-rubric.md` 和 `doc/phase-4-notes.md`（如果存在）。

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
- Phase 0 / 1 / 2 / 3 已 merge 进 main：工具链（Tailwind / Zod / RHF / Vitest / ESLint / Prettier / Husky）+ UserContext 三模块数据模型 + Persona 插件系统（4 个插件：MBTI / Holland / Big5 / 紫微斗数）+ 简历上传与多模态解析（多版本管理 + JSON 导出 + Prompt 命理图层条件化）。详见 `doc/HANDOFF.md` §2、`doc/phase-2-notes.md`、`doc/phase-3-notes.md`
- **当前焦点**：Phase 4 Match Engine + Scoring Engine（LLM 抽证据，代码按版本化 rubric 算分；同时把 Persona / 生日等数据真正接进 Profile Modal UI）

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
| 3 | 简历上传 + Gemini 多模态结构化解析 | ✅ Done |
| 4 | Match Engine + Scoring Engine（可解释评分 + 统一上下文装配）| ⏳ In Progress |
| 5 | 存储升级 localStorage → Dexie | |
| 5.5 | Gemini 多模态截图导入 JD（可选）| |
| 6 | 浏览器扩展（Manifest V3，主流招聘站 JD 一键采集）| |
| 7 | UI 整体调整 + 简历多版本管理 | |
| 8 | 反向利用：Cover Letter 生成 / 简历针对性优化建议 | |
| 9 | 云同步（可选，Supabase/Firebase）| |
| 10 | PWA + Tauri 桌面端打包 | |
| 11 | 文档完善 + 部署上线 + Chrome Web Store 上架 | |

## 五、架构约定

### 数据模型方向（Phase 1 目标）

```ts
interface UserContext {
  personas: PersonaInstance[];      // 心理/玄学画像
  resumes: ResumeProfile[];         // 简历多版本
  preferences: UserPreferences;     // 薪资/地区/避雷
  activeResumeId?: string;
  activePersonaIds: string[];
}
```

## 六、隐私红线（详见 `doc/HANDOFF.md` §7）

- 永远不 commit `.env.local` / 不硬编码 API Key 到源代码
- **简历原文件永远不上云**（PII 红线，对应架构决策 D6）；结构化数据可上云但需 PII 脱敏
- 公网部署前必须引入后端代理（API Key 不能暴露给浏览器）
- 浏览器扩展不直连 Gemini（扩展包可被反编译，Key 必盗）
