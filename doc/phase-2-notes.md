# Phase 2 落地总结 · Persona 插件系统

> 本文档是 Phase 2（PR #3）的实施记录，对应 HANDOFF.md §5 Phase 2。
> 目的：让接手 Phase 3+ 的人快速理解已建立的代码层范式，避免重新造轮子或误判工作量。

---

## 1. Phase 2 目标与实际范围

**HANDOFF §5 原计划**：建立 `PersonaPlugin` 接口 + Registry，落地 MBTI / Holland / Big5 / 紫微斗数 4 个插件。

**实际落地**（PR #3）：
- ✅ `PersonaPlugin` 接口（`src/personas/PersonaPlugin.ts`）
- ✅ Registry + 测试（`src/personas/registry.ts` + `registry.test.ts`）
- ✅ 4 个插件实现，每个含 schema / form / index / test（详见 §3）
- ⚠️ **未做**：UI wiring（App.tsx 没 import 任何 plugin，也没 `src/personas/index.ts` 显式注册）
- ⚠️ **未做**：Prompt 装配（`constants.tsx` 的 `FLASH_FILTER_PROMPT` / `PRO_AUDIT_PROMPT` 没调用任何 `plugin.promptFragment`）
- ⚠️ **未做**：`PersonaInstance` 的实际持久化测试（types.ts 已含 `personas: PersonaInstance[]` 字段，但 storage 层只验证字段存在，不验证有效负载）

**这是有意的工期分配**：Phase 2 只交付"可被 Phase 4 消费的纯逻辑层"。UI 集成 + Prompt 装配是 Phase 4 MatchEngine 重构的本职工作，不在 Phase 2 抢跑——避免 Phase 2 PR 把 App.tsx 改得过深、给 Phase 3 的简历 UI 留下冲突。

---

## 2. 命名同步：HANDOFF "八字" → 代码 "ziwei"

HANDOFF.md（特别是 §1、§5 的旧草稿段）里有"八字 / 玄学画像"字样，实际实现选用了**紫微斗数**。所有路径、ID、类型名以代码为准：

| HANDOFF 旧措辞 | 实际代码 |
|---|---|
| "八字插件" / "玄学画像" | `src/personas/plugins/ziwei/` |
| Plugin id | `'ziwei'`（持久化到 `PersonaInstance.type`，**升级不能改**）|
| 隐藏插件分类 | `category: 'esoteric'`（vs `'core'`）|

判断依据：紫微斗数有结构化命盘（宫位 + 主星 + 四化），可被 Gemini 用结构化字段引用；八字的天干地支抽象层级更深，不便结构化输入。Phase 2 在落地时换了选项。后续如果做八字 plugin，仍可作为另一个 `category: 'esoteric'` 插件并存。

---

## 3. PersonaPlugin 接口与 Registry

### 3.1 接口契约（`src/personas/PersonaPlugin.ts`）

```ts
export type PersonaCategory = 'core' | 'esoteric';

export interface PersonaFormProps<TData> {
  value: TData;
  onChange: (next: TData) => void;
}

export interface PersonaPlugin<TData = unknown> {
  id: string;                  // 稳定 slug, 持久化到 PersonaInstance.type
  name: string;                // UI 显示名
  description: string;         // 一行副标题
  category: PersonaCategory;   // 'core' 主列表 / 'esoteric' 玄学折叠区
  schema: ZodType<TData>;      // PersonaInstance.data 的 Zod schema
  emptyData: () => TData;      // 首次启用时的空值工厂
  formComponent: ComponentType<PersonaFormProps<TData>>;
  promptFragment: (data: TData) => string;  // 输出 Markdown 注入 system prompt
  tokenHint?: string;          // 可选, 如 '~400 tokens / call'
}
```

**与 HANDOFF §6 草图的差异**（实际代码为准）：
- 草图里有 `responseSchemaFragment?: Record<string, unknown>` 和 `defaultEnabled?: boolean`——**实际未实现**。
  - `responseSchemaFragment` 推迟到 Phase 4：MatchEngine 决定 response schema 怎么按 active personas 动态扩展，目前还没有需要 schema 扩展的产品诉求。
  - `defaultEnabled` 推迟到 UI 落地时：Phase 2 不做 UI，谈不上"默认启用"。
- 新增 `category` 字段：因为紫微落到"隐藏区"是 UX 决策，需要在 plugin 自身声明，而非由 App.tsx 维护 hardcoded 列表。
- 新增 `tokenHint`：紫微 prompt 比较重（~400 tokens），需要在 UI 提示用户成本。

### 3.2 Registry（`src/personas/registry.ts`）

简单 Map，4 个 API：
```ts
registerPersona(plugin)              // 重复 id 抛错
getPersona(id) → plugin | undefined
listPersonas() → plugin[]
listPersonasByCategory(category) → plugin[]
__resetPersonaRegistry()             // test-only, 不再 re-export 给应用
```

**注册位置约定**：HANDOFF §6 草图说"在 `src/personas/index.ts` 里 `registerPersona(plugin)`"——目前该文件**不存在**。Phase 4 UI 接入时需要新建，把 4 个 plugin 显式注册一次。**Phase 3 不需要触碰这一层**（简历不走 plugin 系统，详见 Phase 3 plan）。

---

## 4. 4 个插件口径对比

| 维度 | mbti | holland | big5 | ziwei |
|---|---|---|---|---|
| **目录** | `plugins/mbti/` | `plugins/holland/` | `plugins/big5/` | `plugins/ziwei/` |
| **id** | `'mbti'` | `'holland'` | `'big5'` | `'ziwei'` |
| **category** | `core` | `core` | `core` | `esoteric` |
| **schema 形态** | 单 enum (16 型) + 可选 note | 3 个 enum letter + refine 互斥 | 5 个 0-100 percentile + 可选 note | 4 必填宫 + 2 可选宫，每宫含 mainStar/sihua/note |
| **表单交互** | 单 `<select>` | 3 个联动 `<select>`（动态排除已选项）| 5 个 range slider | 嵌套 PalaceRow（含 add/remove）+ 流年年份 + 全局备注 |
| **emptyData** | `{ type: 'INTJ' }` | `{ primary: 'I' }` | 5 维度全 50 | 4 必填宫均 `紫微+无` |
| **tokenHint** | 未声明 | 未声明 | 未声明 | `'~400 tokens / call'` |
| **promptFragment 输出** | `## MBTI 人格类型` | `## Holland 职业兴趣类型（RIASEC）` | `## Big5 人格维度 (OCEAN)` | `## 紫微斗数（职业相关核心宫位）` |

**口径一致点**（所有 plugin 都遵守）：
- 表单**不用 react-hook-form**，全部用 controlled `value` + `onChange(next)` 回调（与 PersonaFormProps 一致）。RHF 留给 Phase 3 的简历审阅页评估，目前用不上。
- promptFragment 输出 Markdown 二级标题 + bullet，便于直接拼到 system prompt。
- note / 备注字段统一是顶层可选字符串，trim 后空白视为不填（不渲染对应行）。
- 测试三层结构（详见 §5）。

---

## 5. 测试范式（三层）

所有 plugin test 都按以下三层组织（参考 `mbti/index.test.ts` / `holland/index.test.ts` / `big5/index.test.ts` / `ziwei/index.test.ts`）：

```ts
describe('xxx schema', () => {
  // 用 .safeParse() 验证 happy / sad 路径
  // 必含: 接受合法值 / 拒绝非法值 / 拒绝缺字段
});

describe('xxxPromptFragment', () => {
  // 验证 Markdown 输出包含关键标记 (** / ##)
  // 必含: 必填字段渲染 / 可选字段非空时渲染 / 空白时跳过
});

describe('xxxPlugin definition', () => {
  // 自洽性: id 正确 / category 正确 / emptyData() 通过自己的 schema
});
```

Registry 测试 (`registry.test.ts`) 单独覆盖：starts empty / register+retrieve / unknown id / duplicate id 抛错 / list / listByCategory / reset。

**惯例**：plugin 的测试文件叫 `index.test.ts`（不是 `mbti.test.ts`），与 plugin 入口文件 `index.ts` 同名。

---

## 6. 已建立的代码层范式（Phase 3+ 可直接复用）

| 范式 | 位置 | 复用场景 |
|---|---|---|
| **Zod schema + `z.infer` 推 TS 类型** | `*/schema.ts` | 任何需要"schema 兼做运行时校验 + TS 类型"的地方 |
| **Controlled form + `onChange(next)` 全量替换** | `*Form.tsx` | Phase 3 简历审阅页可直接复用（无 RHF） |
| **Markdown promptFragment 输出** | `index.ts` | Phase 4 MatchEngine 装配 system prompt 时直接拼接 |
| **测试三层**（schema / behavior / self-consistency）| `index.test.ts` | Phase 3 的 resumeParser 也用这套，schema 校验 + 错误分类 + 自洽 |
| **Tailwind 风格**（`rounded-xl`, `border-2 border-slate-100`, `focus:border-indigo-500`, `space-y-3`）| 所有 `*Form.tsx` | Phase 3 ResumeModal 沿用 |
| **可选字段 trim 后判定**（`value.note?.trim()` 决定是否渲染） | 4 个 promptFragment | 简历的 summary / certifications 等可选字段同样处理 |
| **Registry 模式** | `registry.ts` | 暂不复用——简历不走 plugin 系统（差异在内容措辞而非结构） |

---

## 7. 未完成 / Phase 4 接手项

下列内容**有意推迟**，不是遗漏：

1. **`src/personas/index.ts` 注册入口**：新建后显式 `[mbtiPlugin, hollandPlugin, big5Plugin, ziweiPlugin].forEach(registerPersona)`，App.tsx import 它触发注册。
2. **App.tsx UI 集成**：Profile Modal 加 "Personas" tab，渲染 `listPersonasByCategory('core')` 列表 + `category: 'esoteric'` 折叠区，每项一个开关 + 表单。`PersonaInstance` 写回 `ctx.personas`，`activePersonaIds` 跟踪启用集。
3. **`responseSchemaFragment`（如有必要）**：Phase 4 重构 `deepAuditJob` 时评估，目前 Pro 输出已是固定 schema，不需要按 persona 动态扩展。
4. **`defaultEnabled`**：Phase 4 UI 落地时定夺。当前倾向 `mbti / holland` 默认启用、`big5 / ziwei` 默认关闭。
5. **Prompt 装配**：Phase 4 MatchEngine 用 `activePersonaIds` 收集 plugin → 拼 `promptFragment` 输出 → 注入 system prompt 的 `## 命主画像` 段。
6. **Token 预算**：紫微 ~400 tokens/call 还没纳入成本核算，Phase 4 接入时加 token meter。

---

## 8. 已知后续风险

- **PersonaInstance 持久化未充分测试**：当前 storage 测试只验证字段存在/migration，不验证 `data` 字段是否能通过对应 plugin 的 schema。Phase 4 接入后建议补一组"persona round-trip"测试：填数据 → 保存 → 读取 → `plugin.schema.parse(instance.data)` 必须通过。
- **Plugin id 是持久化键**：未来 rename plugin id（如 `'mbti'` → `'mbti-v2'`）会丢用户数据。任何 id 变动都要走 migration 路径，类比 Phase 1 的 `LegacyProfile` migration。
- **紫微宫位 mainStar 是固定枚举（15 项含"空宫"）**：实际紫微斗数的副星组合远多于 15，目前只取核心主星 + 四化 + 自由备注。这是工期权衡，不是"做错了"——若 Phase 8/未来要做精细排盘，再扩 schema。
