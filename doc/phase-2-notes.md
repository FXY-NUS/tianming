# Phase 2 · Persona Plugin 系统

> 期间：2026-05-13 · 分支：`feat/phase-2-personas`

## 目标回顾

把 V7.0 的 4 个自由文本档案字段升级为**可扩展的画像插件系统** —— 每个画像维度（MBTI / Holland / Big5 / 紫微）是独立插件，自带 schema + 表单 + prompt 片段。新增维度不改任何已有代码。

## 实际产出（8 个 commit）

| # | Commit | 核心 |
|---|---|---|
| 1 | `feat(personas): PersonaPlugin interface + registry` | 定义插件契约 + 全局注册中心，加 `__resetPersonaRegistry` 测试钩 |
| 2 | `feat(personas): MBTI plugin` | 16 型枚举 + 单选下拉 + 备注，10 个测试 |
| 3 | `feat(personas): Holland (RIASEC) plugin` | 三槽 RIASEC 编码，schema `.refine()` 拒绝重复字母，11 个测试 |
| 4 | `feat(personas): Big5 plugin` | OCEAN 5 个 0-100 滑块 + 5 档语义（低/偏低/中等/偏高/高），12 个测试 |
| 5a | `feat(personas): 紫微 plugin core` | 4 必填 + 2 可选宫位，每宫主星 + 化曜 + 副星备注，~400 token/call 警示，12 个测试 |
| 5b | `feat(personas): integrate iztro for auto-charting` | iztro 按需加载（动态 import），生日 → 自动填充 4 宫位 + 身宫，8 个测试 |
| 6 | `feat(app): Personas section + prompt assembly` | 注册中心 bootstrap、`assemblePersonaPrompt`、PersonasSection UI 接入 Profile Modal、constants.tsx 三个 prompt 注入 `【画像插件输出】` 块 |
| 7 | `docs: Phase 2 wrap-up` | 本文件 + README 更新 |

## 关键决策

### 1. Q1 → 用紫微取代八字

八字 prompt 无法量化、Gemini 凭印象解读；紫微的"官禄宫 + 三方四正"是天然结构化标签，LLM 接得住。八字插件没做，留给未来按需补一个（plugin 架构正是为了"按需补"）。

### 2. Q2 → 保留 free-text，紫微 plugin 并存

`UserContext.preferences.astrologyProfile` 那段自由文本不删，当作"自由备注"留给用户写自己想写的；紫微 plugin 是结构化数据并行存在。两者都进 Pro prompt，互不冲突。

### 3. Q3 → Profile Modal 加一个"画像插件"区

不开新 modal，直接在现有的 Profile Modal 底部追加 `<PersonasSection>`。修改最小，UI 一致。

### 4. Q4 → 复选框 + 自动玄学折叠

每个插件一行：复选框 + 名称 + 描述 + token 提示。勾上才展开表单。八字…紫微，因为 `category: 'esoteric'`，默认折叠在"显示玄学画像"开关后面。

### 5. Q5 → 单元测试，UI 集成测试 Phase 7

每插件测 schema 边界 + promptFragment 输出 + 默认值通过自己的 schema。registry / promptAssembly / iztro adapter 单独覆盖。**共 70 个新测试**（commit 1-5b 累计 + commit 6 的 8 个 promptAssembly）。Form 组件本身不做集成测试，留到 Phase 7 UI 整体调整时统一加。

### 6. Q6 + Q6b → 紫微表单：6 宫位 + iztro 自动排盘

- 4 必填：命 / 官禄 / 财帛 / 夫妻（即官禄宫的三方四正）
- 2 可选：身宫 / 流年宫
- 每宫：主星下拉 + 化曜下拉 + 副星备注短文本
- 顶部一个折叠的"自动排盘"：填生日 + 时辰 + 性别 → iztro 计算 → 自动填到下方宫位，每项可手动覆盖
- **生日不持久化**，仅本次计算用（隐私优先）

## 架构亮点

### 插件契约（src/personas/PersonaPlugin.ts）

```ts
interface PersonaPlugin<TData> {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'esoteric';
  schema: ZodType<TData>;
  emptyData: () => TData;
  formComponent: ComponentType<{ value: TData; onChange: (next: TData) => void }>;
  promptFragment: (data: TData) => string;
  tokenHint?: string;
}
```

### Bootstrap（src/personas/index.ts）

```ts
import './src/personas';  // ← App.tsx 顶部一行，启动时注册全部插件
```

每个 plugin 自己定义；bootstrap 用 `getPersona(plugin.id)` 做幂等守卫（HMR 不炸）。

### Prompt 装配（src/personas/promptAssembly.ts）

```ts
assemblePersonaPrompt(ctx): string
  → 按 activePersonaIds 顺序，找 instance、查 plugin、schema.safeParse、调 promptFragment、\n\n 拼接
  → 任何一步失败：静默跳过（坏数据永远不能让 Gemini 调用失败）
```

constants.tsx 的三个 prompt（FLASH_FILTER / PRO_AUDIT / CHAT）各自调 `personaBlock(ctx)` 注入一个 `【画像插件输出】` 段。无插件激活时返回空字符串，不污染老 prompt。

### iztro 代码分割

`src/personas/plugins/ziwei/iztro.ts` 里写 `await import('iztro')`，Vite 自动产出独立 chunk。`dist/assets/`：
- 主包 ~474 KB（无 iztro）
- iztro chunk ~612 KB（紫微未启用时不下载）

## localStorage 形态

`tianming_user_context_v1` 现在持久化以下字段（Phase 1 + Phase 2 累计）：

```json
{
  "personas": [
    { "id": "mbti", "type": "mbti", "label": "MBTI 人格类型", "data": { "type": "INTJ", "note": "" }, "createdAt": "..." },
    { "id": "ziwei", "type": "ziwei", "label": "紫微斗数", "data": { "ming": {...}, "guanlu": {...}, ... }, "createdAt": "..." }
  ],
  "resumes": [...],
  "preferences": {
    "displayName": "...",
    "backgroundSummary": "...",
    "astrologyProfile": "...",
    "jobPreferences": "...",
    "preferredLocations": [],
    "avoidKeywords": []
  },
  "activeResumeId": "resume-legacy",
  "activePersonaIds": ["mbti", "ziwei"]
}
```

## 故意没做

- **MBTI 副维度（A/T 变体）**：16 主类型够用，副维度等用户反馈再加
- **Holland 6 维分数**：现在只用 3 字母编码（最常见的输出形式），数值版以后可加
- **Big5 子刻面（facets）**：30 个子维度太多，超出"输入门槛"，留给重度用户的进阶 plugin
- **紫微流年自动计算**：iztro 的 `horoscope()` 可以，但 UX 上要让用户选当前年份，留给 5b 之后单独 commit
- **八字 plugin**：决策上让位给紫微；用户层面 plugin 架构允许未来按需补
- **表单组件 UI 集成测试**：留到 Phase 7

## 下一步（Phase 3）

简历上传 + Gemini 多模态结构化解析：
- 上传 PDF / DOCX / 图片
- 调 Gemini Pro 多模态 → 输出符合 `ResumeStructured` 形状的 JSON
- 审阅页：每字段可编辑、可标记 PII 敏感度
- 多版本管理：`ResumeProfile[]`，每份带 label（"技术岗版" / "咨询版"）

**待商榷（Q1）**：简历 PII 处理默认策略 —— 保留原文件本地加密 / 仅结构化数据明文 / 完全剥离 PII。Phase 3 开始前必须决。
