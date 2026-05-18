# Phase 3 落地总结 · 简历上传 + 多模态解析

> 本文档是 Phase 3（PR #5 / #6 / #7 / 当前 UX-fix PR）的实施记录，对应 HANDOFF.md §5 Phase 3。
> 目的：让接手 Phase 4 的人快速理解 ResumeProfile 数据流、Gemini 多模态调用范式、与 PRO_AUDIT 上下文装配的耦合点。

---

## 1. Phase 3 目标与实际范围

**HANDOFF §5 原计划**：上传 UI（拖拽 + 多文件）+ `services/resumeParser.ts` Gemini 多模态解析 + 审阅页可编辑 + 多版本管理 + PII 敏感度标记。

**实际落地**：

- ✅ `services/resumeParser.ts`：Gemini 3 Pro 多模态 + responseSchema，支持 PDF / DOCX / PNG / JPG / WEBP / TXT
- ✅ `src/components/ResumeModal.tsx`：左侧版本列表 + 上传 tab + 审阅 tab，全字段可编辑
- ✅ 多版本管理：`UserContext.resumes: ResumeProfile[]`，每份独立 `label / structured / piiPolicy / createdAt`
- ✅ 自动持久化：上传解析成功 / 重命名 / 删除 / 切换激活 → 全部即时 `onSave` 写 localStorage
- ✅ JSON 导出：每份简历可单独导出结构化数据（含 PII 警告条）
- ✅ 迁移链：legacy（V7.0 `resumeContent`）→ v1（`name/content`）→ v2（`label/rawText/structured`），每层有 `isValidUserContext` / `normalizePreferences` 兜底
- ✅ Prompt 装配：`PRO_AUDIT_PROMPT` 通过 `buildActiveResumeSection(ctx)` 自动注入激活简历的结构化字段
- ✅ Prompt 命理图层条件化：检测 `astrologyProfile` 或激活的 ziwei persona，没有命理数据时切到纯职业分析模式
- ⚠️ **未做**：`piiPolicy: 'mask' | 'strip'` 数据模型有但 UI 未暴露——目前所有简历固定 `'keep'`，等 Phase 9 云同步真正需要再做
- ⚠️ **未做**：原文件 Blob 存储（HANDOFF §6 草图 `rawFileRef`）——简历不上云的隐私红线下，本地只存 `rawText`（v1 迁移产物）+ `structured`，原 PDF/DOCX 不落盘
- ⚠️ **未做**：拖拽多文件批量上传——UI 只接受单文件，多版本通过反复"新增简历"实现

---

## 2. 拍板了的开放问题

HANDOFF §9 在 Phase 3 启动前列了两个问号：

| # | 问题 | 决定 | 备注 |
|---|---|---|---|
| Q1 | 简历 PII 处理默认策略 | **结构化明文**（`piiPolicy: 'keep'`） | 简历原文件不存盘；结构化字段保留 PII 但所有 onSave 走 localStorage，永不出本机 |
| Q1' | 是否允许导出结构化 JSON | **允许**，但 UI 显式警告 | ResumeModal 左下角常驻黄条「导出的 JSON 包含 PII，请勿上传到公开渠道」 |

PII 红线（HANDOFF §7.3）只约束**原文件不上云**。本地 localStorage 多版本结构化 JSON 完全合规。Phase 9 若真做云同步，需要在那时给 `piiPolicy: 'mask' | 'strip'` 接 UI（mask 屏蔽姓名/手机/邮箱，strip 整段剥离），并在上行链路做 PII 检查。

---

## 3. resumeParser 范式（Phase 4 可直接复用）

```ts
// services/resumeParser.ts

type ParseErrorKind = 'unsupported_mime' | 'gemini_error' | 'schema_violation' | 'empty_response';
type ParseResult =
  | { status: 'ok'; data: ResumeStructured }
  | { status: 'error'; kind: ParseErrorKind; message: string };

export async function parseResumeFile(file: File): Promise<ParseResult>;
export async function parseResumeText(text: string): Promise<ParseResult>;
```

**4 条强约束**：

1. **错误分类化**：`ParseErrorKind` 是闭合枚举，调用方按 kind 决定 UX（unsupported_mime 提示格式 / gemini_error 重试 / schema_violation 走文本兜底）
2. **schema 双层校验**：Gemini 端通过 `responseSchema` 约束（`Type.OBJECT` + `required` 字段），客户端通过 `isValidResumeStructured(parsed)` 二次校验——Gemini 偶尔会偷工省字段或返回部分 JSON，仅靠 Gemini schema 不够安全
3. **MIME 白名单**：`SUPPORTED_MIMES` 显式枚举 6 类，未识别直接拒绝（不走 Gemini，省 token）；扩展名 fallback `getMimeFromExtension` 兜底浏览器没识别出 MIME 的情况
4. **不装前端解析库**：D3 决策——PDF / DOCX / 图片全交给 Gemini 多模态，不引 pdfjs-dist / mammoth

**Phase 4 复用点**：MatchEngine 调 Pro 深审时同样用 `responseSchema + 客户端二次校验` 范式（geminiService.ts 已有），保持错误分类化。

---

## 4. ResumeProfile 数据流与三段迁移

### 4.1 类型形态（types.ts）

```ts
export interface ResumeProfile {
  id: string;
  label: string;                                // "技术岗版" / "咨询版"
  rawText?: string;                             // 仅 v1 迁移产物保留；Phase 3 新上传走多模态，留 undefined
  rawFileRef?: { mime: string; blobId: string }; // 预留给未来 IndexedDB Blob 存储，当前未使用
  structured: ResumeStructured;
  piiPolicy: 'keep' | 'mask' | 'strip';
  createdAt: string;
}
```

### 4.2 三段迁移链（loadUserContext）

```
Tier 1: tianming_user_context_v2 (current)
   ↓ 走 isValidUserContext(parsed) 校验 personas/resumes/preferences/activePersonaIds 都是合法形态
   
Tier 2: tianming_user_context_v1 (Phase 1/2)
   ↓ migrateFromV1: { id, name, content } → { id, label, rawText, structured: empty, piiPolicy: 'keep' }
   ↓ v1 的 plain-text content 保留为 rawText 防止数据丢失
   
Tier 3: career_navigator_profile (V7.0 baseline)
   ↓ migrateFromLegacy: 字符串 resumeContent → 单份 'resume-legacy' (label='默认简历')
```

每层迁移成功后立即 `saveUserContext` 把数据升级到 v2 键，下次启动直接命中 Tier 1。

### 4.3 双层 invariant

- `isValidUserContext`：只验顶层数组/对象存在，宽松（防止良性新增字段被拒）
- `normalizePreferences`：preferences 子字段逐项 type-check，确保下游 `ctx.preferences.displayName.trim()` 之类调用不炸

任何对 UserContext 形态的扩展都应同时改 `isValidUserContext` 防御性放宽，避免老用户 v2 数据被新校验拒掉走到 default 损失数据。

---

## 5. ResumeModal UX 与 4 条不变量

经过 PR #5 → #6 → #7 → 当前 UX-fix 的迭代，弹窗形成 4 条不变量：

1. **打开即恢复激活态**：`useState` 用 `initialActive` 初始化 `structured / activeTab / fileName / uploadState`——有激活简历直接开"审阅"tab，没激活才开"上传"tab
2. **解析成功即入库**：`commitParsedResume` 把新 `ResumeProfile` push 进 `localResumes` + `setLocalActiveId` + 调 `onSave` 持久化——和重命名/删除/切换的即时保存行为一致，不再有"上传后忘记点添加导致数据丢失"的状态分裂
3. **唯一的 footer 按钮是「保存修改」**：因为新解析的简历已经在 list 里了，footer 只剩"把审阅页的编辑覆盖回当前激活简历"这一个动作，不再有"添加 vs 更新"双态按钮
4. **侧边栏改动走 `localResumes` + `onSave({ ...ctx, resumes: ..., activeResumeId: ... })`**：`ctx` 是 props（每次 React 渲染会反映最新 App.tsx state），`localResumes` 是局部状态跟踪 modal 会话内的中间态——重命名 / 删除时 spread `...ctx` 保留 preferences/personas 不动，只覆盖 resumes/activeResumeId

**`ctx` prop 不会 stale 的原因**：App.tsx 的 `onSave` 是 `setUserCtx(newCtx)`，React 会把新 ctx 作为新 props 重新渲染 ResumeModal，但 `useState(ctx.resumes)` 只在 mount 时取初值——这是设计而非 bug，让 modal 会话内的中间态独立于 parent 重渲染。

---

## 6. PRO_AUDIT_PROMPT 装配（constants.tsx）

Phase 3 重构 `constants.tsx`：

```ts
function renderPersona(p: PersonaInstance): string         // 按 p.type 派发到对应 plugin.promptFragment
function buildActivePersonaSection(ctx): string             // 收集激活 personas → Markdown 段
function buildActiveResumeSection(ctx): string              // 激活简历的结构化字段 → bullet list
function hasAstrologyContext(ctx): boolean                  // 决定要不要加紫微图层
```

`PRO_AUDIT_PROMPT(ctx)` 现在是**条件构造**：

- **基础角色**：检测 `astrologyProfile` 或激活的 ziwei persona——有命理数据走"紫微斗数 + 周易六爻审计师"身份，没有走"数据科学职业审计师"身份
- **审计维度 E**：有命理 → "命理加权（廉贞忌/子午冲）"；没有 → "地域与文化加权"
- **输出 hexagram 字段**：有命理 → 实际填写本卦变卦；没有 → 强制返回空字符串
- **pros/cons 示例**：有命理 → 鼓励引用紫微术语；没有 → 限制基于简历/背景
- **【约束】兜底**：没命理时显式禁用「命主」「天府」「廉贞」「巨门」「子午冲」等词汇，防止 Gemini 自由发挥编出八字

`App.tsx` 配套：hexagram 徽章 conditional 渲染（空字符串时不渲染），避免 UI 出现空 pill。

**这是 Phase 3 的最后一个 commit 修的 bug**：Phase 0 的原始 prompt 把紫微斗数写死成审计师的必备技能，导致即使新用户没填生日，Gemini 也会输出"天府坐命 / 廉贞忌"之类的占卜话术。修完后基础 prompt 是中性的，命理只在用户主动提供数据时才作为图层叠加——和 D2 的 Persona 插件化原则一致。

---

## 7. 已建立的代码层范式（Phase 4+ 可复用）

| 范式 | 位置 | 复用场景 |
|---|---|---|
| **Gemini multimodal + responseSchema + 客户端 isValid 二次校验** | `services/resumeParser.ts` | Phase 4 MatchEngine 的 Pro 深审同样这套 |
| **ParseResult 闭合错误枚举** | `services/resumeParser.ts` | 所有需要"分类错误 → 分类 UX"的 LLM 调用 |
| **三段迁移链 + isValid 防御** | `services/userContextStorage.ts` | Phase 5 Dexie 迁移时同套思路（localStorage → IndexedDB 也是一段 tier） |
| **modal 局部 state + props auto-sync** | `src/components/ResumeModal.tsx` | 任何"有会话内中间态但需要即时持久化"的 modal |
| **prompt 条件图层化**（`hasAstrologyContext` / `buildActivePersonaSection` / `buildActiveResumeSection`）| `constants.tsx` | Phase 4 MatchEngine 用同套思路装配 system prompt，按 active personas / resume 动态切换 |
| **可选字段 trim 渲染** | `buildActiveResumeSection` | 与 Phase 2 plugin promptFragment 范式一致 |

---

## 8. 未完成 / Phase 4 接手项

下列内容**有意推迟**，不是遗漏：

1. **MatchEngine 抽象**（HANDOFF §5 Phase 4）：当前 `geminiService.batchScreenJobs` / `deepAuditJob` / `sendMessageToJobConsultant` 是平铺的 3 个函数，Phase 4 抽 `MatchEngine` 类 + `buildSystemPrompt(ctx, goal)` + `buildResponseSchema(ctx, goal)`，把 `FLASH_FILTER_PROMPT` / `PRO_AUDIT_PROMPT` / `CHAT_SYSTEM_PROMPT` 统一吃 `MatchContext`
2. **Persona 注册入口**（Phase 2 §7.1 未完）：新建 `src/personas/index.ts`，显式 `[mbtiPlugin, hollandPlugin, big5Plugin, ziweiPlugin].forEach(registerPersona)`；App.tsx import 触发副作用——Phase 3 没碰这一层，Phase 4 必做
3. **Profile Modal 的 Personas tab UI**：当前 App.tsx 的 Profile Modal 只有 4 个 preference 文本框，没有 persona 入口。新用户填不进 MBTI/生日。Phase 4 接 MatchEngine 时一起做 UI（否则 prompt 装配再完美也没数据可用）
4. **`piiPolicy: 'mask' | 'strip'` UI**：Phase 9 云同步真正动手前不做
5. **`rawFileRef` Blob 存储**：Phase 5 迁 Dexie 时评估，目前 localStorage 容量上 IndexedDB Blob 没意义

---

## 9. 已知后续风险

- **`isValidUserContext` 过于宽松**：只验顶层 `Array.isArray(o.resumes)`，不验数组里每份 ResumeProfile 的形态。如果 v2 localStorage 被外部脚本污染（比如手动写入 `resumes: [{id: 'x'}]` 缺 structured/piiPolicy），调用端访问 `r.structured.basic` 会炸。当前没遇到，但 Phase 4 接 MatchEngine 后建议补一组 round-trip 测试
- **`commitParsedResume` 用 `localResumes.length + 1` 作默认 label**：删除后再新增可能撞名（删第 2 份后新增叫"简历 2"，跟现有第 2 份重名）。Label 不是 key，不会引起数据问题，但 UI 会出现两个同名条目——Phase 7 UI 重构时可加去重逻辑
- **Gemini 多模态 token 成本**：PDF 简历单次解析约 2000-5000 tokens（取决于页数），Phase 4 接 token meter 时要把 Phase 3 的简历解析也纳入统计
- **`buildActiveResumeSection` 静默截断长字段**：当前直接 `.join(', ')` 拼技能/经历，没有长度上限。若用户简历 experience 极多（10+ 段），单次 PRO_AUDIT 的 prompt token 可能超预算。Phase 4 MatchEngine 接 token budgeting 时需要给 resume section 加截断策略（如保留最近 5 段 experience）
