# Tianming · 项目交接文档 v1.0

> 本文档由前序 Claude session（私密上下文）整理交接给当前 session。
> 作用：让你在零上下文情况下快速理解项目全貌，能直接接手 Phase 1 开干。
> 阅读顺序：从上往下读完整份，不要跳读，所有决策都有依赖关系。

---

## 0. 角色 & 协作模式

- **用户**：fxy-nus（中文名昵称：阿棠 / 召棠），23 岁求职中的学生
- **你**：默认 Claude 工程助手人设。**这个 repo 是公开求职项目，严格保持专业语气**。
  给我讲解项目的时候可以采用温柔，易懂的语气 ，因为我很多技术不懂。
- **协作模式**：用户主导决策，你提供方案 + 工程实现。重大架构决策需她确认，
  小型实现细节可自主推进，遇到与本文档冲突的情况停下来询问

---

## 1. Big Picture

**项目名**：Tianming（天命） / 天命导航仪

**一句话定位**：
> AI-powered career navigator that combines LLM-driven job analysis 
> with multi-persona user profiling and resume intelligence.

**核心能力（最终形态）**：
1. **批量 JD 智能初筛**（Gemini Flash，30 份/次打分）
2. **单 JD 深度审计**（Gemini Pro，输出卦象 + Pros/Cons + 残酷真相 + 面试策略 + 合同红旗）
3. **多维度用户画像**（MBTI / Holland / Big5 / 八字插件化）
4. **简历智能解析**（Gemini 多模态读 PDF/DOCX/图片，结构化抽取）
5. **浏览器扩展**（Manifest V3，主流招聘站一键采集 JD）
6. **反向赋能**（Cover Letter 生成 / 简历针对性优化建议）

**差异化叙事**（简历用）：
> 基于 Gemini 多模态 + 插件化用户画像系统 + Chrome 扩展三端联动的智能求职助手。

**为什么不是"又一个 ChatGPT 套壳"**：
- 插件化的 Persona 系统是真正的架构创新（不是堆 prompt）
- 浏览器扩展 + Web App + 未来桌面端三端联动
- 简历-岗位双向匹配引擎（而非单向打分）

---

## 2. 当前状态

### 已完成
- ✅ V7.0 baseline 从 Google AI Studio 导出并迁移
- ✅ 修复 `window.aistudio.*` 平台依赖（→ localStorage + prompt fallback）
- ✅ 修复 `process.env.API_KEY`（→ `getApiKey()` 助手，读 `import.meta.env.VITE_GEMINI_API_KEY` 或 localStorage）
- ✅ 本地 `npm run dev` 可调通 Gemini Flash + Pro
- ✅ Git 初始化 + push 到公开 repo `fxy-nus/tianming`
- ✅ `.gitignore` 正确排除 `.env.local` / `node_modules`

### 当前 Repo 结构
```
tianming/
├── App.tsx                      # 主组件（含 API Key 管理逻辑）
├── constants.tsx                # Prompt 模板（FLASH_FILTER / PRO_AUDIT / CHAT_SYSTEM）
├── index.html / index.tsx       # 入口
├── package.json / vite.config.ts / tsconfig.json
├── metadata.json                # AI Studio 元数据（暂保留，未来清理）
├── services/
│   └── geminiService.ts         # Gemini API 调用层
├── types.ts                     # Job / Profile 类型定义
├── .gitignore
└── README.md                    # 当前为空，待 Phase 1 完善
```

### 已知技术债
- `types.ts` 里 `Profile` 是扁平结构，需重构为 `UserContext` 三模块
- API Key 安全模型在公网部署前需引入后端代理（暂不处理，Phase 4 之后）
- 无 ESLint / Prettier / Tailwind / 测试框架（Phase 1 装齐）
- AI Studio 残留：`metadata.json` 暂保留以备查阅，未来清理

---

## 3. Tech Stack（含选型理由）

| 层 | 选型 | 引入 Phase | 理由 |
|---|---|---|---|
| 框架 | React 18 + TypeScript + Vite | 已有 | V7.0 baseline，不动 |
| LLM SDK | `@google/genai` | 已有 | Gemini 3 Flash + Pro 多模态 |
| 样式 | Tailwind CSS | Phase 1 | Claude Design 生成的组件默认 Tailwind |
| Schema 校验 | Zod | Phase 1 | 跟 Gemini responseSchema 配合优雅 |
| 表单 | react-hook-form + @hookform/resolvers | Phase 1 | 类型安全受控表单 |
| 本地存储 | localStorage → Dexie/IndexedDB | Phase 5 | 简历 Blob、大量 JD 需要 IndexedDB |
| 状态管理 | 仅 useState + Dexie liveQuery | — | **明确拒绝** Redux/Zustand，过度工程 |
| Lint | ESLint + Prettier + Husky + lint-staged | Phase 1 | 标配 |
| 部署 | Vercel | Phase 11 | 接 GitHub 自动部署，PR preview |
| 浏览器扩展 | Manifest V3 + Service Worker | Phase 6 | V2 已死 |
| 桌面端 | Tauri | Phase 10 | 比 Electron 轻 100 倍 |

### 明确**不引入**的东西（防止过度工程）
- ❌ Redux / Zustand / Jotai：useState + liveQuery 够用
- ❌ RAG / 向量数据库 / transformers.js：Gemini 3 Pro 有 1M+ context，结构化数据直接塞
- ❌ PDF/DOCX 解析库（pdfjs-dist / mammoth）：**全部交给 Gemini 多模态原生处理**
- ❌ tRPC / GraphQL：纯前端 + 极少后端，不值得
- ❌ Storybook：组件量级不够，Claude Design 已经是设计稿源

---

## 4. 核心架构决策（已定，不再讨论）

### D1. 用户上下文三模块化
`Profile` 字符串 → `UserContext` = `Personas[] + Resumes[] + Preferences`，三个正交模块。

### D2. Persona 插件化
每个画像维度（MBTI / Holland / Big5 / 八字）是独立插件，自带三件套：
- `formComponent`：用户填写表单
- `promptFragment(data)`：注入到 LLM system prompt 的字符串
- `responseSchemaFragment`：扩展 Gemini responseSchema

新增一个 Persona 不应该改任何已有代码，只是 register 一个新插件。

### D3. 简历解析走 Gemini 多模态
PDF / DOCX / 图片 / 文本统一交给 Gemini，输出结构化 JSON。**不装任何前端解析库**。

### D4. JD 导入三层兜底
1. **主路径**：浏览器扩展（覆盖 LinkedIn / BOSS / 智联 / 猎聘 / Indeed）
2. **兜底**：复制粘贴文本框
3. ~~截图 OCR~~：**已砍掉**，UX 太差

### D5. 扩展不直连 Gemini API
扩展包是公开的，API Key 塞进去会被反编译盗用。扩展只抽取 JD 数据，
通过 Chrome Storage 传给 Web App，LLM 调用永远在 Web App 一侧。

### D6. 简历不上云
简历原文件默认仅本地 IndexedDB Blob 存储；结构化数据可上云但需 PII 脱敏。
**这是隐私红线**。

### D7. 双层匹配引擎
- **Flash 初筛**：用 ResumeStructured 的硬性条件（经验/学历/语言）+ Personas 简版做粗筛
- **Pro 深审**：完整 UserContext 装配，单 JD 高 token 预算

### D8. Git 工作流
- `main`：可发布的稳定版本
- `refactor/v8`：长期重构分支
- `feat/phase-N-xxx`：每个 Phase 一个短期分支，PR 合入 `refactor/v8`
- v8 整体完成后合 `main` 发布 V2.0

---

## 5. 完整 Phase 路线图

### Phase 0 — V7.0 Baseline ✅ Done
代码导入、AI Studio 依赖修复、git 初始化、push GitHub。

---

### Phase 1 — UserContext 数据模型重构 ⏳ NEXT
**目标**：把扁平 `Profile` 拆成 `UserContext` 三模块，并完成 localStorage 数据迁移。

**实现**：
1. 安装：Tailwind / Zod / react-hook-form / ESLint / Prettier / Husky / lint-staged
2. 新建 `src/core/types.ts` 定义完整类型（见 §6 数据模型草图）
3. 新建 `src/storage/migrations.ts` 写"旧 Profile localStorage → 新 UserContext"迁移函数
4. 改造 `App.tsx` 读 UserContext，旧 Profile 字段 fallback 兼容
5. 单元测试覆盖迁移函数（确保不丢数据）

**效果**：用户层无感知，但底层为后续所有 Phase 打地基。

**工期**：1-2 天

**待商榷**：暂无，可直接开干

---

### Phase 2 — Persona Plugin 系统
**目标**：建立 `PersonaPlugin` 接口 + Registry，实现 MBTI / Holland / Big5 三个核心插件 + 八字隐藏插件。

**实现**：
- `src/personas/PersonaPlugin.ts` 定义接口（formComponent / promptFragment / responseSchemaFragment）
- `src/personas/registry.ts` 注册中心
- 每个插件一个文件夹：`plugins/mbti/`、`plugins/holland/`、`plugins/big5/`、`plugins/bazi/`
- 八字默认未启用，需在设置里手动开启（不是默认隐藏，是"轻入口"）

**效果**：用户可在设置里勾选启用哪些画像维度，匹配 prompt 自动装配。

**工期**：1-2 天

**待商榷**：八字插件 prompt 怎么调（让 Gemini 假装会算八字？还是真接命理 API？倾向前者）

---

### Phase 3 — 简历上传 + 多模态解析
**目标**：用户上传 PDF/DOCX/图片简历，Gemini 解析为 `ResumeStructured`，用户审阅编辑后入库。

**实现**：
- 上传 UI：拖拽 + 文件选择（支持多文件，因为简历多版本）
- 后端解析：`services/resumeParser.ts` 调用 Gemini 多模态 + responseSchema
- 审阅页：每个字段可编辑、可标记 PII 敏感度
- 多版本管理：`ResumeProfile[]`，每份给个 label（"技术岗版" / "咨询版"）

**效果**：用户 30 秒内把简历变成结构化数据。

**工期**：2 天（核心战场）

**待商榷**：
- PII 处理策略默认值（保留原文加密 / 仅结构化 / 完全剥离 PII）—— **需阿棠拍板**
- 是否允许导出结构化简历为 JSON（用户带去其他工具？）

---

### Phase 4 — 匹配引擎重构
**目标**：Flash 初筛和 Pro 深审统一吃 `MatchContext`（含完整 UserContext）。

**实现**：
- `src/core/matchEngine.ts` 抽象 `MatchEngine` 类
- `buildSystemPrompt(ctx)` 装配 Personas + Resume + Preferences
- `buildResponseSchema(ctx)` 按启用的 Persona 动态扩展 schema
- Flash 初筛额外吃硬性条件（学历/经验年限/语言要求），避免应届生看到 senior 岗位

**效果**：匹配精度显著提升，简历参与硬性筛选 + 软性匹配。

**工期**：1-2 天

**待商榷**：暂无

---

### Phase 5 — 存储升级 localStorage → Dexie
**目标**：把 JD / UserContext / 简历 Blob 全迁到 IndexedDB。

**实现**：
- `src/storage/db.ts` 定义 Dexie schema
- 用 `dexie-react-hooks` 的 `useLiveQuery` 替换 useState + useEffect 模式
- localStorage 数据一次性迁移到 Dexie 后清理

**效果**：能存大量数据（简历 Blob 几 MB 也不慌）、跨 tab 实时同步。

**工期**：半天

**待商榷**：暂无

---

### Phase 5.5（可选）— 多模态截图导入 JD
**注**：曾考虑作为兜底，已与阿棠讨论后**暂时跳过**，UX 不如复制粘贴。
若未来需要再单开。

---

### Phase 6 — 浏览器扩展（Manifest V3）
**目标**：用户在主流招聘站浏览 JD 时，扩展浮窗一键采集到 tianming。

**实现**：
- 独立子项目 `extension/`，与主 Web App 同 repo
- `manifest.json` MV3，Service Worker 后台
- Content Scripts：4-5 个 site adapter（LinkedIn / BOSS / 智联 / Indeed / 猎聘）
- 通用启发式抽取器作为兜底
- 通过 Chrome Storage 写入 JD，Web App 监听变化拉取

**效果**：JD 导入门槛从"复制粘贴 30 秒"降到"点一下按钮"。

**工期**：2-3 天

**待商榷**：
- 先适配哪几个网站？建议 LinkedIn + BOSS + 智联三个起步 —— **需阿棠拍板**
- 是否做"浏览时直接显示匹配预测分"的浮窗 UI

---

### Phase 7 — UI 整体调整
**目标**：吃透 Claude Design 设计稿，整体 UI 升级。

**实现**：
- 建立 `src/ui/components/` + `src/ui/_design-source/`（记录每个组件对应的 Claude Design 链接）
- shadcn/ui 按需引入
- 暗色模式 / 响应式 / 移动端适配

**效果**：从"AI Studio 默认风格"跃迁到"产品级 UI"。

**工期**：1 天

**待商榷**：阿棠之前已在 Claude Design 做了一些组件，需她提供链接/导出

---

### Phase 8 — 反向利用（Cover Letter / 简历优化）
**目标**：基于"用户简历 + 单 JD"输出 Cover Letter 和针对性简历优化建议。

**实现**：
- Pro 深审完成后多出两个 action：「生成 Cover Letter」「优化此简历针对此 JD」
- 输出可编辑、可一键复制、可导出 Markdown

**效果**：从"看分数"变成"出弹药"，用户求职效率质变。

**工期**：1-2 天

**待商榷**：是否前置到更早 Phase？阿棠倾向放后期，先把核心打磨

---

### Phase 9（可选）— 云同步
**目标**：跨设备同步 UserContext + JD（**简历默认不同步**）。

**实现**：Supabase 或 Firebase（auth + sync）

**效果**：手机/电脑数据一致

**工期**：1 天

**待商榷**：**整个 Phase 是否要做？** —— 阿棠暂未拍板，倾向不做（隐私优先）

---

### Phase 10 — PWA + Tauri 桌面端
**目标**：
- PWA：手机浏览器可"添加到主屏"，离线可用
- Tauri：打包 Windows/Mac 桌面 app

**实现**：vite-plugin-pwa + tauri scaffolding

**效果**：三端覆盖（Web + 桌面 + 移动 PWA），简历叙事再升一级

**工期**：1.5 天

**待商榷**：Mac 用户量少时是否值得做 Tauri，看时间预算

---

### Phase 11 — 文档 + 部署 + Chrome Web Store 上架
**目标**：
- README 完善（截图 + 演示 GIF + tech stack badge）
- ARCHITECTURE.md（架构图 + 数据流）
- DECISIONS.md（ADR 关键架构决策记录）
- Vercel 部署主站
- 扩展打包提交 Chrome Web Store

**工期**：半天 + Chrome Web Store 审核等待

---

## 6. 关键数据模型草图

```ts
// src/core/types.ts

export interface UserContext {
  personas: PersonaInstance[];
  resumes: ResumeProfile[];
  preferences: UserPreferences;
  activeResumeId?: string;
  activePersonaIds: string[];
}

export interface PersonaInstance {
  pluginId: string;        // 'mbti' | 'holland' | 'big5' | 'bazi'
  data: unknown;            // 插件自己 schema 校验
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
  avoidKeywords?: string[];      // 避雷词
  workMode?: 'remote' | 'onsite' | 'hybrid' | 'any';
}

// Persona 插件接口
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

// 匹配引擎上下文
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

## 8. SOP / Git Workflow

```
main (可发布稳定版)
└── refactor/v8 (长期重构分支)
    ├── feat/phase-1-user-context
    ├── feat/phase-2-persona-plugin
    ├── feat/phase-3-resume-upload
    └── feat/phase-N-xxx
```

- 每个 Phase = 1 个 PR，合入 `refactor/v8`
- v8 全部完成后整体合 main，tag v2.0
- commit message 用 conventional commits（feat: / fix: / chore: / docs: / refactor:）

---

## 9. 待商榷 / 开放问题（需阿棠拍板）

| # | 问题 | 推荐方案 | 优先级 |
|---|---|---|---|
| Q1 | 简历 PII 处理默认策略 | 保留原文件本地加密 + 结构化数据明文 | Phase 3 前必须决 |
| Q2 | 八字插件 prompt 怎么写 | 让 Gemini 模拟，不接命理 API | Phase 2 |
| Q3 | 扩展先适配哪几个网站 | LinkedIn + BOSS + 智联 三选起步 | Phase 6 前 |
| Q4 | 反向功能（Cover Letter）是否前置 | 维持 Phase 8 | Phase 4 前确认 |
| Q5 | 云同步是否做 | 倾向不做（隐私优先）| Phase 8 完成后再决 |
| Q6 | Tauri 桌面端是否值得 | 看时间预算 | Phase 9 完成后再决 |
| Q7 | Claude Design 现有设计稿 | 阿棠提供链接/导出 | Phase 7 前 |
| Q8 | 项目主品牌色 / Logo | 暂用 V7.0 紫色 | Phase 7 |

---

## 10. 协作约束（重要）

- 用户用中文沟通，你用**中文回复**
- 用户对前端工程化熟悉度中等，**重要 CLI 命令需要解释作用**
- 用户是 **Windows 用户**，Bash 命令需用 PowerShell/CMD 等价写法或说明
- 重大架构决策要**先讨论再动手**，不要"我先做了你看看"
- 每个 Phase 开始前给一份"本 Phase 拆解到具体 commit 级"的计划等阿棠确认
- 遇到与本文档冲突的情况**停下来询问**，不要自作主张改方向

---

## 11. 接力指令

**当前位置**：Phase 0 ✅ Done，准备进入 Phase 1。

**新 session 第一步**：
1. 读完本文档全文
2. 确认理解后，向阿棠确认 Q1（简历 PII 策略）暂可推迟，Phase 1 不依赖
3. 提出 Phase 1 的具体拆解（建议 5-8 个 commit）
4. 等阿棠 confirm 后开始 Phase 1 第一个 commit：安装依赖 + 配置 Tailwind/ESLint/Prettier

**禁止**：
- 不要一上来就开始改代码
- 不要跳到 Phase 2 之后
- 不要询问任何已经在本文档明确决定的事

---

*文档版本 v1.0 · 由前序 session 整理 · 2026-05-13*
