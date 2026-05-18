# Tianming · 项目交接文档 v1.3

> 本文档是 Tianming 项目的工程交接 brief，供任何接手开发的 AI 助手或工程师阅读。
> 阅读顺序：从上往下读完整份，不要跳读，所有决策都有依赖关系。

## 0.0 每次接手必读 SOP

在继续任何开发前，先读 `doc/agent-workflow.md`，判断当前是 Codex 本地模式还是 Claude Code 云端模式，然后只执行对应工作流：

- Codex 本地开发：读 `doc/codex-workflow.md`。Codex 负责本地 Windows workspace、SSH remote 检查、GitHub PR merge 后的本地 `main` 同步，以及本地验证命令。
- Claude Code 云端开发：读 `claudecode.md`。Claude Code 直接基于 GitHub 云端仓库状态工作，不读取或假设用户本地文件、SSH config、`.env.local`、本地 dev server 或 Codex sandbox 状态。

共同规则：

- 不要把 SSH private key、API key、token、`.env.local` 内容写入 repo 或文档。
- GitHub 与本地是否同步由运行环境决定：Codex 需要同步本地；Claude Code 不需要处理用户本地 checkout。
- 代码提交前按对应环境运行测试、lint、build；文档-only 变更至少做 diff 检查。

---

## 0. 角色 & 协作模式

- **用户**：fxy-nus（项目所有者），求职中的学生，对前端工程化熟悉度中等
- **你**：默认 Claude 工程助手人设。**本仓库为公开求职作品集项目，请保持专业、清晰语气**
- **沟通风格**：用户希望讲解技术时**清晰友好、不堆砌术语、必要时用类比解释**——
  目标是让用户理解决策依据，而非展示术语储备
- **协作模式**：
  - 用户主导决策，你提供方案 + 工程实现
  - 重大架构决策需用户确认
  - 小型实现细节可自主推进
  - 遇到与本文档冲突的情况停下来询问

---

## 1. Big Picture

**项目名**：Tianming（天命） / 天命导航仪

**一句话定位**：
> AI-powered career navigator that combines LLM-driven job analysis 
> with multi-persona user profiling and resume intelligence.

**核心能力（最终形态）**：
1. **批量 JD 智能初筛**（Gemini Flash，30 份/次打分）
2. **单 JD 深度审计**（Gemini Pro，输出卦象 + Pros/Cons + 残酷真相 + 面试策略 + 合同红旗）
3. **多维度用户画像**（MBTI / Holland / Big5 / 紫微斗数 插件化）
4. **简历智能解析**（Gemini 多模态读 PDF/DOCX/图片，结构化抽取）
5. **浏览器扩展**(Manifest V3，主流招聘站一键采集 JD)
6. **反向赋能**（Cover Letter 生成 / 简历针对性优化建议）

**差异化叙事（对外）**：
> 基于 Gemini 多模态 + 插件化用户画像系统 + Chrome 扩展三端联动的智能求职助手。

**为什么不是"又一个 ChatGPT 套壳"**：
- 插件化的 Persona 系统是真正的架构创新（不是堆 prompt）
- 浏览器扩展 + Web App + 未来桌面端三端联动
- 简历-岗位双向匹配引擎（而非单向打分）

---

## 2. 当前状态

### 已完成
- ✅ **Phase 0**：V7.0 baseline 导入 + AI Studio 依赖适配
- ✅ **Phase 1**：UserContext 数据模型 + 工程化工具链（Tailwind / ESLint / Prettier / Husky / Vitest / Zod / RHF）
- ✅ **Phase 2**：Persona 插件系统（MBTI / Holland / Big5 / 紫微斗数）
- ✅ **Phase 3**：简历上传 + Gemini 多模态结构化解析 + 多版本管理 + Prompt 命理图层条件化（详见 `doc/phase-3-notes.md`）

### 当前 Repo 结构

```
tianming/
├── .husky/                      # pre-commit hook (lint-staged)
├── doc/
│   ├── HANDOFF.md               # 本文档
│   ├── phase-2-notes.md         # Phase 2 落地总结
│   ├── phase-3-notes.md         # Phase 3 落地总结
│   └── scoring-rubric.md        # Phase 4 评分体系设计
├── services/
│   ├── geminiService.ts         # Gemini API 调用层
│   ├── userContextStorage.ts    # UserContext 持久化
│   └── userContextStorage.test.ts
├── src/
│   └── personas/                # Persona 插件系统
│       ├── PersonaPlugin.ts
│       ├── registry.ts
│       └── plugins/
│           ├── mbti/
│           ├── holland/
│           ├── big5/
│           └── ziwei/
├── App.tsx                      # 主组件
├── constants.tsx                # Prompt 模板
├── types.ts                     # Job / UserContext 类型
├── eslint.config.js
├── postcss.config.js / tailwind.config.js
├── .prettierrc.json / .prettierignore
├── package.json / vite.config.ts / tsconfig.json
└── README.md                    # 待 Phase 11 完善
```

### 已知技术债 / 推迟事项
- API Key 安全模型在公网部署前需引入后端代理（Phase 4 之后处理）
- `metadata.json` AI Studio 残留，待 Phase 7 清理
- 根目录的 `App.tsx` / `types.ts` / `constants.tsx` 暂未搬到 `src/`，待 Phase 7

---

## 3. Tech Stack（含选型理由）

| 层 | 选型 | 状态 | 理由 |
|---|---|---|---|
| 框架 | React 18 + TypeScript + Vite | ✅ | V7.0 baseline，不动 |
| LLM SDK | `@google/genai` | ✅ | Gemini 3 Flash + Pro 多模态 |
| 样式 | Tailwind CSS | ✅ | 与 Claude Design 默认输出一致 |
| Schema 校验 | Zod | ✅ | 跟 Gemini responseSchema 配合优雅 |
| 表单 | react-hook-form + @hookform/resolvers | ✅ | 类型安全受控表单 |
| 测试 | Vitest | ✅ | Vite 原生，跑 services 单元测试 |
| Lint | ESLint + Prettier + Husky + lint-staged | ✅ | 标配 |
| 本地存储 | localStorage → Dexie/IndexedDB | Phase 5 | 简历 Blob、大量 JD 需要 IndexedDB |
| 状态管理 | 仅 useState + Dexie liveQuery | — | **明确拒绝** Redux/Zustand |
| 部署 | Vercel | Phase 11 | 接 GitHub 自动部署，PR preview |
| 浏览器扩展 | Manifest V3 + Service Worker | Phase 6 | V2 已死 |
| 桌面端 | Tauri | Phase 10 | 比 Electron 轻 100 倍 |

### 明确**不引入**的东西
- ❌ Redux / Zustand / Jotai：useState + liveQuery 够用
- ❌ RAG / 向量数据库 / transformers.js：Gemini 3 Pro 有 1M+ context
- ❌ PDF/DOCX 解析库（pdfjs-dist / mammoth）：**全部交给 Gemini 多模态原生处理**
- ❌ tRPC / GraphQL：纯前端 + 极少后端，不值得
- ❌ Storybook：组件量级不够

---

## 4. 核心架构决策（已定，不再讨论）

### D1. 用户上下文三模块化
`Profile` 字符串 → `UserContext` = `Personas[] + Resumes[] + Preferences`，三个正交模块。
**Phase 1 已落地**。

### D2. Persona 插件化
每个画像维度是独立插件，自带三件套：
- `formComponent`：用户填写表单
- `promptFragment(data)`：注入到 LLM system prompt 的字符串
- `responseSchemaFragment`：扩展 Gemini responseSchema

新增 Persona 不应改任何已有代码，只 register 一个新插件。
**Phase 2 已落地 4 个插件**：MBTI / Holland / Big5 / 紫微斗数。

### D3. 简历解析走 Gemini 多模态
PDF / DOCX / 图片 / 文本统一交给 Gemini，输出结构化 JSON。**不装任何前端解析库**。

### D4. JD 导入三层兜底
1. **主路径**：浏览器扩展（覆盖 LinkedIn / BOSS / 智联 / 猎聘 / Indeed）
2. **兜底**：复制粘贴文本框
3. ~~截图 OCR~~：已砍掉，UX 太差

### D5. 扩展不直连 Gemini API
扩展包是公开的，API Key 塞进去会被反编译盗用。扩展只抽取 JD 数据，
通过 Chrome Storage 传给 Web App，LLM 调用永远在 Web App 一侧。

### D6. 简历不上云
简历原文件默认仅本地 IndexedDB Blob 存储；结构化数据可上云但需 PII 脱敏。
**这是隐私红线**。

### D7. 双层匹配引擎
- **Flash 初筛**：用 ResumeStructured 的硬性条件（经验/学历/语言）+ Personas 简版做粗筛
- **Pro 深审**：完整 UserContext 装配，单 JD 高 token 预算

### D8. Git 工作流（实际采用）
- `main` 始终保持可发布的稳定版本
- 每个 Phase 一个 feature branch：`feat/phase-N-xxx` 或 `chore/phase-N-xxx`
- 通过 PR 合并 main，**不使用长期 `refactor/v8` 分支**
- commit 用 conventional commits（feat: / fix: / chore: / docs: / refactor: / test:）

---

## 5. 完整 Phase 路线图

### Phase 0 — V7.0 Baseline ✅ Done
代码导入、AI Studio 依赖修复、git 初始化、push GitHub。

### Phase 1 — UserContext 数据模型 + 工具链 ✅ Done
- 类型重构 `Profile` → `UserContext`
- localStorage 迁移函数 + 单元测试
- 安装 Tailwind / Zod / RHF / Vitest / ESLint / Prettier / Husky / lint-staged
- PR #1 + PR #2

### Phase 2 — Persona 插件系统 ✅ Done
- `PersonaPlugin` 接口 + Registry
- 4 个核心插件：MBTI / Holland / Big5 / 紫微斗数
- 落地细节见 `doc/phase-2-notes.md`
- PR #3

---

### Phase 3 — 简历上传 + 多模态解析 ✅ Done
**目标**：用户上传 PDF/DOCX/图片简历，Gemini 解析为结构化数据，用户审阅编辑后入库。

**实际落地**（PR #5 / #6 / #7 / #8）：
- 上传 UI：单文件拖拽 / 选择，6 类 MIME（PDF / DOCX / PNG / JPG / WEBP / TXT）
- 解析：`services/resumeParser.ts` Gemini 3 Pro 多模态 + responseSchema + 客户端二次校验
- 审阅页：每个字段可编辑，编辑即时反映到 `structured`，「保存修改」覆盖回激活简历
- 多版本管理：`ResumeProfile[]`（label / structured / piiPolicy / createdAt），侧边栏支持新增/重命名/删除/切换/JSON 导出，全部即时持久化
- 迁移链：legacy（V7.0 `resumeContent`）→ v1（`name/content`）→ v2（`label/rawText/structured`），有 `isValidUserContext` / `normalizePreferences` 兜底
- Prompt 装配：`PRO_AUDIT_PROMPT` 通过 `buildActiveResumeSection(ctx)` 自动注入激活简历结构化字段；`hasAstrologyContext(ctx)` 决定要不要叠加紫微图层，避免新用户无命理数据时 Gemini 自由发挥"天府坐命"
- ⚠️ 推迟到后续 Phase：`piiPolicy: 'mask' | 'strip'` UI（Phase 9）、`rawFileRef` Blob 存储（Phase 5）、多文件批量上传

**落地细节见 `doc/phase-3-notes.md`**。

**拍板了的开放问题**：
- Q1 → `piiPolicy: 'keep'` 默认（结构化明文 + 原文件不存盘），见 §9
- Q1' → 允许导出 JSON + UI 显式 PII 警告条，见 §9

---

### Phase 4 — Match Engine + Scoring Engine ⏳ In Progress
**目标**：把 Flash 初筛 / Pro 深审从“让 Gemini 直接打分”升级为可解释、可复现的评分系统。

**核心原则**（详见 `doc/scoring-rubric.md`）：
- LLM 抽证据，代码算分；Gemini 不直接拥有最终总分。
- `unknown !== 0`：缺失信息只降低 confidence，不默认扣成 0 分。
- 年限 / 地点 / 薪资 / avoid keywords 默认降权并标红；只有用户显式开启 hard filter 才 hard reject。
- 搜索结果页使用 `JobCardSnapshot` 做 `triage`；完整 JD 使用 `JobDetail` 做正式 `audit`。
- Persona 是小权重辅助层，紫微默认只增强叙事，除非用户显式开启加权。

**实现拆解**：
- `src/core/matchTypes.ts`：定义 `JobCardSnapshot` / `JobDetail` / `ExtractedEvidence` / `DimensionScore` / `MatchScore` / `MatchFeedbackRecord`。
- `src/core/scoringEngine.ts`：实现 Pass A/C（规则证据 + 代码聚合）。
- `services/jobEvidenceExtractor.ts`：实现 Pass B（Gemini evidence extraction + responseSchema + 客户端二次校验）。
- 后续继续：Persona 注册入口 + Profile Modal Persona UI + 将现有 `geminiService` 逐步迁移到 MatchContext。

**验收**：
- 同一输入重复评分稳定。
- unknown 维度不进入加权分母。
- hard filter 失败只在用户显式开启时触发。
- `npm.cmd run test` / `npm.cmd run lint` / `npm.cmd run build` 通过。

---

### Phase 5 — 存储升级 localStorage → Dexie
**目标**：JD / UserContext / 简历 Blob 全迁到 IndexedDB。

**实现**：
- `src/storage/db.ts` Dexie schema
- 用 `dexie-react-hooks` 的 `useLiveQuery` 替换 useState + useEffect
- localStorage 一次性迁移到 Dexie

**工期**：半天

---

### Phase 5.5（已搁置）— 多模态截图导入 JD
UX 不如复制粘贴，跳过。未来需要再开。

---

### Phase 6 — 浏览器扩展（Manifest V3）
**目标**：主流招聘站一键采集 JD。

**实现**：
- 独立子项目 `extension/`，与主 Web App 同 repo
- `manifest.json` MV3，Service Worker 后台
- Content Scripts：site adapter（LinkedIn / BOSS / 智联 / Indeed / 猎聘）
- 通用启发式抽取器作为兜底
- 通过 Chrome Storage 写入 JD，Web App 监听变化拉取

**工期**：2-3 天

**待商榷**：先适配哪 3 个网站起步（建议 LinkedIn + BOSS + 智联）

---

### Phase 7 — UI 整体调整
**目标**：吃透 Claude Design 设计稿，整体 UI 升级。

**实现**：
- 建立 `src/ui/components/` + `src/ui/_design-source/`（记录每个组件对应的设计来源）
- shadcn/ui 按需引入
- 暗色模式 / 响应式 / 移动端适配
- 顺手清理：搬迁根目录文件到 src/，移除 metadata.json

**工期**：1 天

**待商榷**：用户需提供 Claude Design 设计稿链接 / 导出

---

### Phase 8 — 反向利用（Cover Letter / 简历优化）
**目标**：基于"用户简历 + 单 JD"输出 Cover Letter 和针对性简历优化建议。

**实现**：
- Pro 深审完成后多出两个 action：「生成 Cover Letter」「优化此简历针对此 JD」
- 输出可编辑、可一键复制、可导出 Markdown

**工期**：1-2 天

---

### Phase 9（可选）— 云同步
**目标**：跨设备同步 UserContext + JD（**简历不同步**）。
**实现**：Supabase 或 Firebase
**工期**：1 天
**待商榷**：整个 Phase 是否要做？目前倾向不做（隐私优先）

---

### Phase 10 — PWA + Tauri 桌面端
- PWA：手机浏览器可"添加到主屏"，离线可用
- Tauri：打包 Windows/Mac 桌面 app

**工期**：1.5 天

---

### Phase 11 — 文档 + 部署 + Chrome Web Store 上架
- README 完善（截图 + 演示 GIF + tech stack badge）
- ARCHITECTURE.md（架构图 + 数据流）
- DECISIONS.md（ADR 关键架构决策记录）
- Vercel 部署主站
- 扩展打包提交 Chrome Web Store

**工期**：半天 + 审核等待

---

## 6. 关键数据模型草图（目标态）

```ts
// 目标态——实际实现以 types.ts / src/personas/ 当前代码为准。
// Phase 3 启动后 ResumeProfile / ResumeStructured 会扩展到此形态。

export interface UserContext {
  personas: PersonaInstance[];
  resumes: ResumeProfile[];
  preferences: UserPreferences;
  activeResumeId?: string;
  activePersonaIds: string[];
}

export interface PersonaInstance {
  pluginId: string;        // 'mbti' | 'holland' | 'big5' | 'ziwei'
  data: unknown;
  createdAt: string;
}

export interface ResumeProfile {
  id: string;
  label: string;            // "技术岗版" / "咨询版"
  rawText?: string;
  rawFileRef?: { mime: string; blobId: string };
  structured: ResumeStructured;
  piiPolicy: 'keep' | 'mask' | 'strip';
  createdAt: string;
}

export interface ResumeStructured {
  basic: { name?: string; email?: string; phone?: string; location?: string };
  summary?: string;
  education: Array<{ school: string; degree: string; major: string; gpa?: string; years: string }>;
  experience: Array<{ company: string; title: string; period: string; bullets: string[] }>;
  skills: { hard: string[]; soft: string[]; languages: string[]; tools: string[] };
  projects: Array<{ name: string; role: string; bullets: string[]; tech: string[] }>;
  certifications?: string[];
  rawHighlights?: string[];
}

export interface UserPreferences {
  salaryRange?: [number, number];
  preferredLocations?: string[];
  preferredIndustries?: string[];
  avoidKeywords?: string[];
  workMode?: 'remote' | 'onsite' | 'hybrid' | 'any';
}

export interface PersonaPlugin<TData = unknown> {
  id: string;
  name: string;
  description: string;
  schema: ZodSchema<TData>;
  formComponent: React.FC<{ value: TData; onChange: (v: TData) => void }>;
  promptFragment: (data: TData) => string;
  responseSchemaFragment?: Record<string, unknown>;
  defaultEnabled?: boolean;
}

export interface MatchContext {
  job: Job;
  user: UserContext;
  activeResumeId: string;
  activePersonaIds: string[];
  goal: 'screen' | 'audit' | 'cover_letter' | 'resume_tailor';
}
```

---

## 7. 安全 & 隐私红线

1. **永远不 commit `.env.local`**（已在 .gitignore）
2. **永远不硬编码 API Key 到源代码**
3. **永远不把简历原文上云**（PII 红线）
4. **公网部署前必须引入后端代理**（API Key 不能暴露给浏览器）
5. **浏览器扩展不直连 Gemini**（扩展包可被反编译，Key 必盗）
6. 任何对外文档 / 截图前，**确认没有真实 PII / Key**

---

## 8. SOP / Git Workflow（实际）

```
main (始终可发布)
├── feat/phase-3-resumes       ← 即将开
├── feat/phase-4-match-engine
├── chore/phase-N-xxx
└── docs/xxx
```

- 每个 Phase = 1 个 feature branch + 1 个 PR → merge main
- commit 粒度细（一个 PR 一般 3-6 个 commit）
- conventional commits（feat: / fix: / chore: / docs: / refactor: / test:）
- 每个 commit 前跑 lint + test + build 三项验证

---

## 9. 待商榷 / 开放问题

| # | 问题 | 推荐方案 | 何时拍板 | 状态 |
|---|---|---|---|---|
| Q3 | 扩展先适配哪 3 个网站 | LinkedIn + BOSS + 智联 | Phase 6 前 | ⏳ Open |
| Q4 | 反向功能（Cover Letter）是否前置 | 维持 Phase 8 | Phase 4 前确认 | ⏳ Open |
| Q5 | 云同步是否做 | 倾向不做（隐私优先）| Phase 8 完成后 | ⏳ Open |
| Q6 | Tauri 桌面端是否值得 | 看时间预算 | Phase 9 完成后 | ⏳ Open |
| Q7 | Claude Design 现有设计稿 | 用户提供链接 / 导出 | Phase 7 前 | ⏳ Open |
| Q8 | 项目主品牌色 / Logo | 暂用 V7.0 紫色 | Phase 7 | ⏳ Open |

**已解决**（不再讨论）：
- ~~Q1: 简历 PII 处理默认策略~~ → 结构化明文（`piiPolicy: 'keep'`） + 原文件不存盘 + 不上云
- ~~Q1': 是否允许导出结构化简历为 JSON~~ → 允许，UI 显式 PII 警告条
- ~~Q2: 紫微斗数 prompt 怎么写~~ → Phase 2 已实现，让 Gemini 模拟

---

## 10. 协作约束

- 用户用中文沟通，**请用中文回复**
- 用户对前端工程化熟悉度中等，**重要 CLI 命令需要解释作用**
- 用户是 **Windows 用户**，Bash 命令需用 PowerShell / CMD 等价写法或说明
- 重大架构决策**先讨论再动手**，不要"我先做了你看看"
- 每个 Phase 开始前给一份"本 Phase 拆解到具体 commit 级"的计划等用户确认
- 遇到与本文档冲突的情况**停下来询问**，不要自作主张改方向
- 讲解技术时优先用类比和具象例子，避免堆砌术语

---

## 11. 接力指令

**当前位置**：Phase 0 / 1 / 2 / 3 ✅ Done，准备进入 **Phase 4（匹配引擎重构）**。

**新 session 第一步**：
1. 读完本文档全文
2. 读 `doc/phase-2-notes.md` 与 `doc/phase-3-notes.md` 了解最近代码层和约定
3. 浏览 `types.ts`、`constants.tsx`、`services/`、`src/personas/`、`src/components/ResumeModal.tsx` 摸清现有范式
4. **不要写任何代码**，先：
   a. 用清晰友好的中文向用户确认你理解了项目架构（一两段，避免堆术语）
   b. 提出 Phase 4 的具体拆解（5-8 个 commit，每个写清"干什么 / 触碰文件 / 风险"）
5. Phase 4 的核心交付：
   - `src/core/matchEngine.ts` 抽象 `MatchEngine` 类（吃 `MatchContext`）
   - `buildSystemPrompt(ctx, goal)` 统一替代 `FLASH_FILTER_PROMPT` / `PRO_AUDIT_PROMPT` / `CHAT_SYSTEM_PROMPT`
   - `buildResponseSchema(ctx, goal)` 按激活的 Persona 动态扩展 schema
   - Flash 初筛额外吃简历的硬性条件（学历/经验年限/语言要求）
   - **同时把 Persona 注册入口 `src/personas/index.ts` 建起来** + Profile Modal 加 Persona / 生日 UI（不然 Phase 2 / Phase 3 装配再完美也没数据可用）

**禁止**：
- 不要一上来就改代码
- 不要跳到 Phase 5 之后
- 不要询问任何已在本文档明确决定的事

---

*文档版本 v1.3 · 2026-05-18 · Workflow 拆分更新*
