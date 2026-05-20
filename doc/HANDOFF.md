# Tianming · 项目交接文档 v1.7

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
- **你**：默认工程助手人设。**本仓库为公开求职作品集项目，请保持专业、清晰语气**
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
5. **浏览器扩展**（Manifest V3，主流招聘站卡片粗筛 + 用户点开详情捕获）
6. **投递助手**（L2 结构化字段一键复制 + L3 侧边栏 overlay paste-helper）
7. **反向赋能**（Cover Letter 生成 / 简历针对性优化建议）

**差异化叙事（对外）**：
> 基于 Gemini 多模态 + 插件化用户画像系统 + Chrome 扩展三端联动的智能求职助手。

**为什么不是"又一个 ChatGPT 套壳"**：
- 插件化的 Persona 系统是真正的架构创新（不是堆 prompt）
- 浏览器扩展 + Web App + 未来桌面端三端联动
- 简历-岗位双向匹配引擎（而非单向打分）

---

## 1.5 North Star（决策准绳，所有 PR/功能取舍都要过这一句）

> > **"帮一个怕错的人按下投递键。单卡聚焦，Next 推动，隐形算法管理批次质量。"**

**目标用户**：犹豫型 / ADHD 求职者。看到 100 个 JD 头疼、迟迟不行动的人。
**不是目标用户**：海投型用户。LinkedIn Easy Apply、Indeed One-Click、Autofill 插件已经为他们服务。

**任何新功能上来都问一遍**：
- ✅ "这个让用户少 freeze 一次了吗？" → 做
- ❌ "这个只对海投型用户有价值？" → 不做
- ❌ "这个让用户陷入更多选择？" → 不做

**三层产品叙事**（一定记住）：

```
Layer 1 · 筛选层（Streaming Flow）
  N 个 JD → 流式单卡队列（眼前 1 大卡片 + 4 张准备好的下一批）
  解决：选择瘫痪 · 算法在后台过滤，UI 不暴露漏斗 / 固定数字 / 决策桶
  设计参考：Spotify Discover Weekly / Hinge / TikTok For You
  反例：不要做 LinkedIn 列表式、不要做 Codex 提议的"决策桶 + 漏斗仪表盘"

Layer 2 · 决策层（Audit）
  深度审计 + 卦象 + pros/cons + 12-24 月 action plan
  解决：怕错而不敢按下投递

Layer 3 · 行动层（Apply Assistant）  ⭐ 关键，不能漏
  L2 结构化字段一键复制 + L3 侧边栏 overlay paste-helper
  解决：填表认知摩擦力，ADHD 卡在最后一公里
```

**永久不做的事**（North Star 推出来的硬约束）：
- ❌ L4/L5 真正 autofill / auto-submit（合规雷区 + 用户账号封禁风险）
- ❌ 批量海投工具
- ❌ "AI 替你做所有事"的全自动求职 agent
- ❌ **主页暴露任何"过滤数字 / 桶 / 漏斗 / 固定 picks 数量"**——理由：更多选项 ≠ 更多信任，犹豫型用户看到 "我们扔了 83 个" 会去点 Skip 桶自我撤销过滤。信任来自下一张卡的质量，不来自展示过滤逻辑。
- ❌ 把用户当 HR / 招聘官的 triage dashboard。**用户是候选人本身，不是在评审候选人。**

**新用户最低门槛**（onboarding 路径）：
- 必须：上传简历 + 填几个基础偏好
- 完全可选：Persona 插件（MBTI / Holland / Big5 / 紫微）/ 文墨天机粘贴 / 自定义权重
- "想玩才玩"——新用户 0 触碰 Persona 也能跑通整个产品

---

## 2. 当前状态

### 已完成
- ✅ **Phase 0**：V7.0 baseline 导入 + AI Studio 依赖适配
- ✅ **Phase 1**：UserContext 数据模型 + 工程化工具链（Tailwind / ESLint / Prettier / Husky / Vitest / Zod / RHF）
- ✅ **Phase 2**：Persona 插件系统（MBTI / Holland / Big5 / 紫微斗数）
- ✅ **Phase 2.6**：紫微 polish（双主星 + mainStarStrengths + 文墨天机 parser + opposingPalaces + 12-24mo action plan）— PR #18 merged
- ✅ **Phase 2.8**：MBTI / RIASEC polish（MBTI 4 维 dimension expansion + Pittenger 1993 / RIASEC 6 维原始分 + 百分比归一化 + 3:2:1 fallback）— 详见 `doc/phase-2-8-notes.md`
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

### D4'. 扩展抓取边界（合规 + 防封号硬约束）
扩展**不做后台批量请求**，**不自动打开/请求 JD 详情页**。允许的抓取面只有两类：
1. `JobCardSnapshot`：当前搜索结果页**已经加载**的卡片（用 IntersectionObserver 监听滚动新出现的卡片，不主动翻页）。
2. `JobDetail`：用户**主动点开**详情后，content script 读取详情区。

理由：LinkedIn / Indeed / SEEK / JobsDB / Symplicity 的服务条款明文禁止自动化 scraping 和批量请求；账号封禁的代价比省下的时间高得多。我们的"省时间"价值在**对已加载内容的智能粗筛**，不在自动化抓取。

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

### D9. API Key 安全模型 + 产品化路线
**当前阶段（开发 / 单人 BYOK）**：
- Gemini API Key 通过 `localStorage.getItem('GEMINI_API_KEY')` 读取，或 `.env.local` 注入；纯前端调用。
- 仅适合开发者和小范围测试。

**Phase 6 起（扩展上线时硬约束）**：
- 必须引入后端代理（Cloudflare Worker / Vercel Edge / 自建）。
- API Key 只存后端环境变量；浏览器 / 扩展永远拿不到 Key。
- 扩展和 Web App 都走代理调用，扩展不直连 Gemini（见 D5）。

**产品化路线（Phase 6+ 之后）**：
| 模式 | 用途 |
|---|---|
| **BYOK Mode** | 开发者、技术用户、内部测试；用户自带 Key |
| **Tianming Credits** | 普通用户买积分（100 次卡片粗筛 / 10 次 Pro 深审等粒度） |
| **Subscription** | 月费订阅，按额度封顶 |
| **Trial Credits** | 新用户少量免费额度 + 防滥用机制 |

**架构形态**：
```
Web App / Extension
  → Tianming Backend API
     → Auth / Quota / Billing / Rate Limit
     → Gemini API
  → 结构化结果回前端
```
后端必须负责：用户登录、调 Gemini、token 计数、每用户每日 / 月限额、Stripe / 类似支付、防刷接口、成本预警 / 熔断、记录 `modelVersion` + `rubricVersion` + `scoringVersion`。

### D11. 投递助手分级铁律（North Star 推出来的硬约束）

为犹豫型 / ADHD 用户过"最后一公里"，但**严格分级**：

| 等级 | 内容 | 状态 |
|---|---|---|
| **L0** | 什么都不做 | 起点 |
| **L1** | JD 卡片高亮"立即投递"链接 | M1 含 |
| **L2** | 结构化字段一键复制 + AI 生成 cover snippet（可编辑后复制） | **M1 必做**（Phase 5.5）|
| **L3** | 扩展侧边栏 overlay（每字段点按钮复制 → 用户手动粘贴）| **M2 必做**（Phase 6.5）|
| **L4** | 扩展自动 fill 表单字段（用户点提交）| ❌ **永久不做** |
| **L5** | headless 自动提交 | ❌ **永久不做** |

**为什么 L4/L5 永久不做**：
- ATS 系统对自动行为模式有检测，触发 = 用户求职账号被打入冷宫
- Symplicity 是高校求职系统，ban 影响整个学校账户
- North Star 是"帮犹豫者按下按钮"，**不是"替犹豫者按按钮"**——后者会让用户更加依赖、更加焦虑

**关键产品语**（写进 UI 提示 + Chrome Web Store 描述）：
> Tianming 不替你提交。所有投递都是你自己手动点的。

### D10. 多 Provider 抽象（**预留，不实现**）
为防止"换模型导致前后打分不一致"，未来允许接 Claude / OpenAI / DeepSeek，但实现服从以下约束：

```ts
interface LlmProvider {
  extractJobEvidence(job: Job, ctx: UserContext): Promise<ExtractedEvidence>;
  parseResume(file: File): Promise<ResumeStructured>;
  generateAuditNarrative(job: Job, ctx: UserContext): Promise<AuditNarrative>;
}
```

**铁律**：
- 任何 provider 都只输出**证据 + 叙述**，**不输出 overall 或 judgment**。
- 最终分数永远由 `src/core/scoringEngine.ts` 计算（见 D7 + scoring-rubric.md）。
- 换 provider 只影响"证据抽取质量"，**不能破坏评分规则**。

**实现时机**：等真的要接第二个 model 时再写实现；当前只 Gemini，多写一层抽象只是 over-engineering。

---

## 5. 完整 Phase 路线图

### 5.0 双轴结构：Tracks（并行）× Milestones（时间锚）

路线图按**工作流（Track）**横向拆分，按**可演示版本（Milestone）**纵向锚定。Phase N 编号保留只作为**功能簇 ID**，不再隐含时间顺序。

#### Tracks（并行的工作流）

| Track | 内容 | 主做方 |
|---|---|---|
| **A. 数据 / 评分 / 存储** | Phase 4 收尾 · Phase 5 Dexie · 4.5 简历 Union | **Codex 主做**（本地浏览器 + IndexedDB 调试） |
| **B. Persona / 插件** | 2.6 紫微 polish · 2.7 六爻 · 2.8 MBTI+RIASEC | **Claude Code 主做**（schema/prompt/test） |
| **C. 浏览器扩展** | Phase 6.0-6.4 + 后端代理雏形 | **Codex 主做**（Chrome 加载本地扩展调试） |
| **D. 投递助手** | 5.5 L2 剪贴板 · 6.5 L3 overlay | **Claude Code 主写代码 → Codex 本地 UX 验收** |
| **E. UI 设计 + 实现** | Phase 7 整体重做（围绕"3 张牌" + Apply Assistant 重新设计） | **Claude Design 设计稿 → Claude Code/Codex 翻译为 React 组件** |
| **F. 反向赋能** | Phase 8 Cover Letter · 简历针对性优化（**注**：学校已有项目组做"AI 改简历"，非 unique value，延后） | Claude Code |

#### Milestones（demo 锚点）

| Milestone | 含义 | 包含 Track 内容 | 估时 |
|---|---|---|---|
| **M1 · Local MVP** | 本地端到端跑通，可演示完整决策闭环 | A 收尾 + B 紫微 polish + D L2 + 现有 UI | 1-2 周 |
| **M2 · Browser Beta** | 加扩展卡片粗筛 + L3 paste-helper | + C + D L3 | 再 2-3 周 |
| **M3 · Design Polish** | UI 整体焕新成"3 张牌 + Apply Assistant" 设计 | + E（Claude Design） | 再 1-2 周 |
| **M4 · Public Launch** | 后端代理 + Vercel 部署 + Chrome Store | + Phase 11 + D9 后端 | 再 1-2 周 |

#### Demo-first 纪律

- 主线开发**不强求每个 Track 完美**；
- **每周末必须有一个 stable demo branch**，能跑、能演示、可截图；
- 如果 Milestone 截止前发现某 Phase 还差临门一脚，**宁可砍功能保 demo 可跑**。

---

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

### Phase 2.6 — 紫微 plugin polish（Track B）✅ Done · PR #18 merged
**Branch**: `feat/phase-2-6-ziwei-polish`（已合 main）

**已落地（commit 27bec22 / be7d5e9 / 4b3b86c / 89a2373 / 14413fb）**：
- schema 升级 `mainStar → mainStars[1..2]` + `mainStarStrengths` + 旧数据 `normalizeZiweiData`
- UI 副主星 toggle / 副星备注折叠
- 文墨天机命盘文本 zero-LLM parser + UI 导入面板
- 星名内部空格归一化（"天   相" → 天相）
- **opposingPalaces**：8 非 schema 宫位结构化保存 + promptFragment 新增"对宫主星"段落 + 空宫显式"借对宫"事实
- career_growth prompt 重写：3-5 年泛化路径 → 12-24 个月可执行 action plan

**延后到 Phase 2.6+**：手动强度 selector UI / 四化层次（生年/大限/流年/自化）schema v2 / iztro 排盘库接入

### Phase 2.7 — 六爻插件（一事一占）⏸ 待启动
**目标**：用户对一个具体 JD 起卦 → 输出"建议投递 / 谨慎 / 不建议" + 一段简短解读。**完美对齐 North Star**——犹豫型用户需要的就是一个外部锚帮下决心。

- 等用户联系真懂六爻的家属做内容审核（不让 Gemini 自由发挥）
- 边界：1 个 plugin，1 种用法（每 JD 一卦），1 个 Gemini call
- ❌ 不做"开局通占大运 / 一卦看一生"——那是 Pro 深审的事

### Phase 2.8 — MBTI / RIASEC plugin polish（Track B）✅ Done
**Branch**: `feat/phase-2-8-mbti-riasec-polish` · Commits: `ed3e0b7` (MBTI) + `1270034` (RIASEC) · 详见 `doc/phase-2-8-notes.md`

**已落地**：
- **MBTI**：`MBTI_DESCRIPTIONS` 16 个职业刻板 label（"建筑师 / 指挥官 / 竞选者…"）替换为中性 4 维 dimension expansion（INTJ → "内倾 · 直觉 · 思维 · 判断"）；新增 `MBTI_DIMENSION_LABEL` / `MBTI_DIMENSION_DESCRIPTION` 两层；promptFragment 改输出 4 维倾向 + Pittenger 1993 critique blockquote；plugin.description 加"非职业诊断"框定；anti-pattern blocklist test 防回滚。
- **RIASEC**：schema 加可选 `scores: {R,I,A,S,E,C: int >= 0}`（接受任意原始分，O*NET / SDS / 中文量表都行）；`deriveHollandRawScores()` + `hollandPercentages()` 两段式归一化（用户原始分优先，未填走 3:2:1 fallback）；promptFragment 新增"6 维强度（占比）"行 + 来源标注（让 Gemini 知道置信度）；HollandForm 加可折叠 6 输入区（默认收起，全空清字段）。
- **接口签名 0 变化**：constants.tsx / scoring engine 不需要任何改动。

**延后到 Phase 2.8+**：MBTI dimension strength sliders / RIASEC 6 维 slider UI / promptFragment 真实 Gemini smoke 验证 / 翻译 i18n。

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

### Phase 4 — Match Engine + Scoring Engine ✅ Core Done · Smoke-Test 收尾中
**目标**：把 Flash 初筛 / Pro 深审从"让 Gemini 直接打分"升级为可解释、可复现的评分系统。

**核心原则**（详见 `doc/scoring-rubric.md`）：
- LLM 抽证据，代码算分；Gemini 不直接拥有最终总分。
- `unknown !== 0`：缺失信息只降低 confidence，不默认扣成 0 分。
- 年限 / 地点 / 薪资 / avoid keywords 默认降权并标红；只有用户显式开启 hard filter 才 hard reject。
- 搜索结果页使用 `JobCardSnapshot` 做 `triage`；完整 JD 使用 `JobDetail` 做正式 `audit`。
- Persona 是小权重辅助层（总权重上限 15%），紫微默认只增强叙事，除非用户显式开启加权。

**已落地**（PR #10 / #11 / #12 / #13 / #14）：
- `src/core/matchTypes.ts`：`JobCardSnapshot` / `JobDetail` / `ExtractedEvidence` / `DimensionScore` / `MatchScore` / `MatchFeedbackRecord`。
- `src/core/scoringEngine.ts`：Pass A/C 实现（规则维度 + 加权聚合 + persona cap）；experience hardFail 已收敛，partial-year 估算支持 YYYY-MM。
- `services/jobEvidenceExtractor.ts`：Pass B（Gemini evidence + responseSchema + 客户端二次校验，`temperature: 0.1`）。
- `services/matchPromptBuilder.ts`：prompt + responseSchema 统一装配，明确告诉 LLM"不要输出最终 score / judgment"。
- `services/geminiService.ts`：批量初筛和单 JD 深审都接进 MatchEngine。
- Persona 注册入口 `src/personas/index.ts` + Profile Modal Persona tab。
- `types.ts`：`UserContext.feedbackRecords?: MatchFeedbackRecord[]` 预留（Phase 8+ ML 学权重铺垫）。

**Smoke-test 暴露的待修问题**（Codex 当前在分支上修，进 Phase 5 前必须清掉）：
- **A1 数据丢失**（最严重）：切走网站再切回，账号 / 简历 / preferences 全部消失。怀疑是 `setUserCtx` stale closure 把空 ctx 覆盖回 localStorage，或者某条错误路径调用了 `localStorage.clear()`。Phase 5 Dexie 升级会顺手把这层做扎实。
- **A2 简历 → preferences 数据流断裂**：解析出的 `ResumeStructured.basic.name / location / skills` 不会回填到 preferences。决定走"方案 α"——审阅页给一个"建议同步"按钮，不静默覆盖。
- **A3 薪资 slider UX**：先调下限再调上限，上限输入会联动改变下限。受控组件 min/max 逻辑写反，1 小时内可修。
- **A4 scoring 大量 unknown**：location 维度没有 fallback、JD 没有 `locationText` 字段、period 自由文本估年限失败。当 unknown > 50% 时 UI 应该显示"信息不足"，而不是给一个被几个维度撑起来的虚高分。
- **A5 性能**（不阻塞收尾）：Flash / Pro 都慢，留到 Phase 6 引入后端代理时做 streaming + token 预算。

**验收**：
- 同一输入重复评分稳定（`temperature: 0.1` + deterministic 加权）。
- unknown 维度不进入加权分母（已实现）。
- hard filter 失败只在用户显式开启时触发（已实现）。
- `npm.cmd run test` / `npm.cmd run lint` / `npm.cmd run build` 全过（当前 112 tests pass）。
- 上述 A1-A4 都修完。

---

### Phase 4.5 — 简历 Union 匹配 ⏸ Backlog（小，半天）
**Track A**：scoring engine 在 active resume 一份的基础上，**用所有 ResumeProfile.skills 的并集做匹配**，结果显示哪一份命中。**针对犹豫型用户**——他们不知道用哪份简历投，我们自动选最匹配的。

---

### Phase 5 — 存储升级 localStorage → Dexie
**目标**：JD / UserContext / 简历 Blob 全迁到 IndexedDB；**同时根治 Phase 4 smoke-test A1 的数据丢失**。

**实现**：
- `src/storage/db.ts` Dexie schema（`personas` / `resumes` / `jobs` / `userContext` / `feedbackRecords`）。
- `src/storage/migration.ts` localStorage → Dexie 一次性迁移函数，沿用 Phase 1/3 三段迁移链范式。
- 用 `dexie-react-hooks` 的 `useLiveQuery` 替换 `useState(loadUserContext())` + `useEffect(saveUserContext)` 模式，**多 tab 写入不会互相覆盖**。
- 简历 `rawFileRef`：types.ts 草图早就预留，Phase 5 真的把上传的原 PDF/DOCX 存进 IndexedDB Blob。
- A1 根因调查：grep 所有 `localStorage` 写点 / 检查 setUserCtx stale closure / 检查异常路径是否覆盖空 ctx。

**工期**：半天 ~ 1 天。

**验收**：
- 关 tab 再开，数据不丢。
- 多 tab 同时改 → liveQuery 同步，不互相覆盖。
- 简历 Blob 真的能从 IndexedDB 重新打开预览。
- 旧 localStorage 数据自动迁移（或保留 `_legacy` 备份）。

---

### Phase 5.5（重新定义）— Apply Assistant L2 投递助手 · 结构化字段一键复制
**Track D，M1 必含**。这是为犹豫型 / ADHD 用户**过最后一公里**的关键功能。详细分级见 §4 D11。

**目标**：Pro 深审完成后多出一个"📋 投递助手"入口 → 弹出 modal，结构化展示：
- 基本信息（姓名 / 邮箱 / 电话 / 地址）每项独立 一键复制
- 教育经历（每段每个字段独立）
- 工作经历（每段每个 bullet 独立）
- **AI 生成 "Why this company"**（基于 JD + 简历 → textarea **可编辑** → 复制）
- **AI 生成 "Why a good fit"**（基于 JD pros/cons → 同上 → 可编辑 → 复制）
- 期望薪资 / 可入职时间等动态字段一键复制
- 顶部一个大按钮 "↗️ 跳转到投递页"（用 JD.url 新窗口打开）

**关键产品语**：**不替用户提交**——用户 100% 手动点"粘贴"按钮，行为本质是"复制粘贴"，跟 1Password 一个性质。**永远不做 L4 真正 autofill / L5 auto-submit**（见 §4 D11）。

**Gemini 调用**：+1（生成 cover snippets 那一次）。叙述部分允许 temperature 中等，给 narrative 留余地。

**工期**：1.5-2 天。

**~~原 Phase 5.5 截图导入 JD~~**：已搁置（UX 不如复制粘贴）。

---

### Phase 6.5 — Apply Assistant L3 侧边栏 overlay（依赖 Phase 6）
**Track D, M2 必含**。扩展把 Apply Assistant 的内容呈现为**当前投递页右侧 overlay**，每个字段一个"点这里复制 → 然后粘贴到对应输入框"的按钮。仍是 100% 手动粘贴，不 autofill。

---

### Phase 6 — 浏览器扩展（Manifest V3）
**目标**：主流招聘站智能粗筛 + 用户主动详情捕获。**严格遵守 D4' 抓取边界**——不批量自动打开详情页。

**实现拆解**：
- **6.0 文档收口**（半小时）：D4' / D9 / D10 在 §4 已写入，确认 README / Chrome Web Store 描述也用合规语言。
- **6.1 MV3 骨架 + 1 个 site adapter**：独立子项目 `extension/`，manifest V3 + service worker；建议 **LinkedIn 起步**（覆盖广 + 静态 DOM 相对稳定）。
- **6.2 卡片粗筛 UI**：IntersectionObserver 跟当前页可视卡片，每个卡片角盖徽章（Pass / Maybe / Reject / Need full JD）；调用 Web App 的 MatchEngine 做 `triage` 评分。
- **6.3 详情捕获**：用户主动点开 JD detail → content script 抽完整 JD → Chrome Storage 传 Web App → 触发 audit 流。
- **6.4 后端代理雏形**（Phase 6 硬前置）：哪怕只是 Cloudflare Worker / Vercel Edge Function 转发 Gemini，API Key 必须只在后端（见 D5 / D9）。

**工期**：2-3 天 + 后端代理 1 天。

**待商榷**：起步先支持 1 个站还是 3 个站（LinkedIn / BOSS / 智联）。建议先 LinkedIn 跑通整套，再扩两个。

---

### Phase 7 — UI 整体调整（Track E）
**目标**：围绕 North Star "3 张牌 + Apply Assistant" 的新视觉重做 UI。

**工作流**（Claude Design 加入后）：
1. **前 M3 期间**：用户用 Claude Design 周期性跑屏 mock → 截图存 `doc/design/` → 不立刻 merge
2. **M3 期间**：Claude Design 出的 mock 由 Claude Code 翻译成 React + Tailwind，逐屏替换现有 UI
3. **现状参考**：用户已在 Claude Design 跑了"天命导航仪 Design System"（古典神秘风格，京华老宋体 / IM Fell English / LXGW WenKai），见 `doc/design/` 截图

**Claude Design Prompt 通用模板**：
```
你是 Tianming（天命）项目的 UI 设计师。

【North Star】为犹豫型 / ADHD 求职者做的决策助手。
核心叙事：100 个 JD → 筛到 3 个 → 一键决策 → 投递助手帮过最后一公里。

【技术栈约束】
- React 18 + TypeScript + Vite + Tailwind CSS（indigo 紫色品牌）
- 准备引入 shadcn/ui（按需）
- 暗色模式友好（dark: prefix）
- 移动端兼容（min-width: 320px）

【视觉锚点】
- 主色：indigo-500/600；强调：rose（危险）/ emerald（推荐）
- 字体：京华老宋体 + IM Fell English SC + LXGW WenKai（已建 design system）
- 圆角 rounded-xl；暗色背景 slate-900

【这一屏要画什么】（具体写）

请输出完整的 React + Tailwind component（含 mock 数据），并附设计决策说明。
```

**必跑的 4 屏**（按优先级）：
1. **单卡聚焦主页**（Streaming Flow）：屏中央 1 张大卡片（完整 JD 审计 + 卦象 + 三维度分 + Pros/Cons + 12-24mo plan + 一个大"📋 帮我投这个"按钮 + 一个低权重"next →"按钮）；屏底 4 张半透明小卡片预览下一批；屏角小字"系统已为你过滤 N 个不合适的 · 看完整列表"作 escape hatch。**关键**：不暴露总数、不展示漏斗、不分桶。设计哲学参考 Spotify Discover Weekly。
2. **Apply Assistant Modal**：结构化字段一键复制 + AI cover snippet 可编辑 + 跳转投递按钮
3. **Pro 深审结果页**：卦象 + Pros/Cons + 12-24mo action plan + 投递助手入口
4. **Onboarding**：简历上传 → 偏好填写 → 完成。Persona/文墨天机彻底折叠为可选

**实现 Track**：
- 建立 `src/ui/components/` + `src/ui/_design-source/`（记录每个组件对应的设计来源）
- shadcn/ui 按需引入
- 暗色模式 / 响应式 / 移动端适配
- 顺手清理：搬迁根目录文件到 src/，移除 metadata.json

**工期**：1-2 天 + Claude Design 出图时间

**待商榷**：是否引入新字体（京华老宋体 .woff2 等）vs 用系统字体保性能

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
  feedbackRecords?: MatchFeedbackRecord[];  // Phase 8+ 轻量 ML 学权重铺垫
}

export interface PersonaInstance {
  pluginId: string;        // 'mbti' | 'holland' | 'big5' | 'ziwei'
  data: unknown;
  createdAt: string;
}

export interface MatchFeedbackRecord {
  // 定义见 src/core/matchTypes.ts；Phase 4 已预留字段，Phase 8+ 实现 UI + OLS。
  id: string;
  jobId: string;
  resumeId?: string;
  scoringVersion: string;
  dimensionScores: Record<string, number>;
  userRating?: 1 | 2 | 3 | 4 | 5;
  userAction?: 'save' | 'reject' | 'apply' | 'ignore';
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
| Q9 | 简历 → preferences 数据流方案 | α（解析后建议同步，不静默覆盖）| Phase 4 收尾 | ⏳ Open |
| Q10 | 紫微 双主星 schema 改动 | 单星 → `mainStars: string[]`（1-2 长度），plugin id 不变 | Phase 2.6 / Plugin polish | ⏳ Open |
| Q11 | Phase 4.5 硬筛选标签 UI 何时做 | 用户希望先 Phase 5，故延后 | Phase 5 后 | ⏳ Open |
| Q12 | MBTI 职业映射的信效度引用 | 引用 Pittenger 1993 critique，明确"辅助参考非诊断" | Phase 2.6 | ⏳ Open |

**已解决**（不再讨论）：
- ~~Q1: 简历 PII 处理默认策略~~ → 结构化明文（`piiPolicy: 'keep'`） + 原文件不存盘 + 不上云
- ~~Q1': 是否允许导出结构化简历为 JSON~~ → 允许，UI 显式 PII 警告条
- ~~Q2: 紫微斗数 prompt 怎么写~~ → Phase 2 已实现，让 Gemini 模拟

---

## 10. 协作约束

### 10.1 通用沟通
- 用户用中文沟通，**请用中文回复**
- 用户对前端工程化熟悉度中等，**重要 CLI 命令需要解释作用**
- 用户是 **Windows 用户**，Bash 命令需用 PowerShell / CMD 等价写法或说明
- 重大架构决策**先讨论再动手**，不要"我先做了你看看"
- 每个 Phase 开始前给一份"本 Phase 拆解到具体 commit 级"的计划等用户确认
- 遇到与本文档冲突的情况**停下来询问**，不要自作主张改方向
- 讲解技术时优先用类比和具象例子，避免堆砌术语

### 10.2 三方分工矩阵（Codex / Claude Code / Claude Design）

| 任务类别 | 主做 | 备注 |
|---|---|---|
| Track A 数据/评分/存储（Phase 4/4.5/5）| **Codex** | 需要本地浏览器 + localStorage/IndexedDB + 多 tab + Windows 验证 |
| Track B Persona 插件（Phase 2.6/2.7/2.8）| **Claude Code** | schema / prompt / 测试 / 文档，云端做高效 |
| Track C 浏览器扩展（Phase 6）| **Codex** | 需要 Chrome 加载本地扩展调试 |
| Track D 投递助手（Phase 5.5/6.5）| **Claude Code 主写 → Codex 本地 UX 验收** | 代码逻辑在云端做，最终交互体验本地确认 |
| Track E UI 设计 + 实现（Phase 7）| **Claude Design 出 mock → Claude Code/Codex 翻译实现** | 见 Phase 7 工作流；mock 存 `doc/design/` |
| Track F 反向赋能（Phase 8）| **Claude Code** | 偏 prompt + schema 工作 |
| HANDOFF / 文档沉淀 | **Claude Code** | 文档整理云端做效率高 |
| PR 合 main 后本地同步 | **Codex** | 本地 workspace 职责，云端不需要 |
| 真实 smoke 测试（用户填真数据 + 测端到端 UX）| **用户 + Codex 本地** | 云端 Claude Code 跑不动 dev server 给用户看 |

**冲突避免**：
- 同一 PR 不同时开两个 agent 改重叠文件——开始之前先 grep 一下另一方分支的活动
- HANDOFF.md 改动统一让 Claude Code 处理
- 设计稿改动统一从 Claude Design 出，不要 Codex/Claude Code 直接修 mock

### 10.3 Claude Design 工作流操作指南

**Claude Design 是什么**：Anthropic 提供的 UI 设计工具，基于 Claude 能力生成 HTML/CSS 预览 + 设计 system 文档。**不是直接 ship 的代码**，是设计稿来源。

**输入约束**：
- 单屏 / 单组件粒度（不要让它一次画整个应用）
- 给清楚的 North Star + 技术栈 + 视觉锚点 + 这一屏内容（用 Phase 7 通用模板）
- 提供已有视觉参考时尽量贴截图

**输出处理**：
- 截图 + 导出 HTML/CSS 存 `doc/design/<phase>/<screen>.png` + `.html`
- 在 M3 启动前**不要直接把生成的 React 合 main**——先做参考，等翻译
- 翻译时由 Claude Code 用项目实际依赖（Tailwind + shadcn/ui）重写，不直接照搬 Claude Design 的 inline 样式

**用户已有进度**：用户已经跑了"天命导航仪 Design System"——含品牌色板（bg-void / deep / surface / elevated / rim）、Typography（京华老宋体 / IM Fell English SC / LXGW WenKai）、按钮组件（深金色边框，glow-azure 强调）。这套设计系统**优先级 = 视觉基线**，后续屏 mock 必须沿用同一套 token。

---

## 11. 接力指令

**当前位置**：Phase 0/1/2/2.6/2.8/3 ✅ Done · **Phase 4 核心 + smoke fix** ✅ merged 到 main · **North Star + Tracks/Milestones 已确立**（见 §1.5 + §5.0）· **M1 剩余**：Phase 5.5 Apply Assistant L2（Codex 在做）· **Track A Phase 4.5/5 Dexie** 待启动。

**新 session 第一步**：
1. 读完本文档全文，**特别是 §1.5 North Star + §4 D1-D11 + §5.0 Tracks/Milestones + §10.2 三方分工**。
2. 读 `doc/scoring-rubric.md` 理解评分系统的 Pass A/B/C 三层架构。
3. 读 `doc/phase-2-notes.md` / `phase-2-8-notes.md` / `phase-3-notes.md` / `phase-4-notes.md` 了解每个 Phase 的落地范式。
4. 浏览 `types.ts`、`src/core/`、`services/`、`src/personas/index.ts`、`src/components/ResumeModal.tsx` 摸清现有范式。
5. **不要写任何代码**，先：
   a. 用清晰友好的中文向用户确认你理解了 North Star + 当前位置（一两段，避免堆术语）
   b. **看 main HEAD**：是否含 `feat/phase-2-6-ziwei-polish` 合并 → 决定下一步起点
   c. 根据 Milestone 进度提建议：
      - **M1 未达成** → 优先 Track A 收尾 + Track B 紫微 polish 合并 + Track D Phase 5.5 启动
      - **M1 达成** → 进 M2，Track C 浏览器扩展启动 + Track D L3 overlay
      - **M2 达成** → 进 M3，Track E UI 重做（Claude Design 出图 → Code 翻译）

**评分系统的 6 条铁律（一定要记住）**：
1. LLM 抽证据，代码算分；Gemini 永远不输出 `overall` / `judgment`，schema 不留这两个字段。
2. `unknown !== 0`：缺失数据进 `confidence: 'unknown'`，不进加权分母。
3. 降权优先于剔除；`hardFail` 默认 false，只在用户显式打开 `hardFilters.*` 时触发。
4. `rubricVersion + scoringVersion` 必须随结构变动 bump，写进每条 `MatchScore` 和 `MatchFeedbackRecord`。
5. Persona 总权重上限 ≤ 15%（`personaWeightCap` 已 clamp）。
6. `JobCardSnapshot`（卡片粗筛）vs `JobDetail`（完整 audit）两层评分；卡片信息不全时维度数会少。

**隐私 + 合规铁律**：
1. 简历原文件不上云（PII 红线，D6）。
2. API Key 不进 repo / 不进扩展包；BYOK 仅当前阶段，Phase 6 起必须后端代理（D5 + D9）。
3. 浏览器扩展不批量爬，只读已加载卡片 + 用户主动点开的详情（D4'）。

**禁止**：
- 不要一上来就改代码。
- 不要让 LLM 输出最终 score（D7 + scoring-rubric.md §1）。
- 不要询问任何已在本文档明确决定的事。
- 不要混用 Codex 本地工作流和 Claude Code 云端工作流（见 §0.0）。

---

*文档版本 v1.7 · 2026-05-20 · Phase 2.6 / 2.8 状态更新为 Done + Phase 2.8 落地详情 + phase-2-8-notes.md 加入必读列表*

*文档版本 v1.6 · 2026-05-19 · Streaming Flow 隐喻替换 "3 picks / 决策队列"（Spotify Discover 范式）+ 永久不做"过滤数字 / 漏斗 / 桶"硬约束 + Phase 7 主屏 mock 描述重写为单卡聚焦*
