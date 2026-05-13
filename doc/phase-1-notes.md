# Phase 1 · UserContext 数据模型重构

> 期间：2026-05-13 · 分支：`claude/plan-usercontext-refactor-zyBCT`

## 目标回顾

把 V7.0 的扁平 `Profile`（`name / bg / astrology / preferences / resumeContent` 五个 free-text 字段）拆成 `UserContext` 三模块（`personas[] / resumes[] / preferences`），并装齐 Phase 1 之后所有 Phase 都会依赖的前端工具链。

## 实际产出（8 个 commit）

| # | Commit | 影响 |
|---|---|---|
| 1 | `chore: setup Tailwind CSS + PostCSS` | CDN → 本地 npm 装的 Tailwind v3；引 `src/styles/index.css` |
| 2 | `chore: add ESLint + Prettier + Husky + lint-staged` | ESLint v9 flat config；整库一次性 prettier baseline；husky pre-commit |
| 3 | `chore: add Vitest + Zod + react-hook-form` | Vitest 嵌入 `vite.config.ts.test`，jsdom env；Zod + RHF 备用 |
| 4 | `feat(core): define UserContext data model` | `src/core/types.ts`，Zod-first，TS 类型用 `z.infer` 推 |
| 5 | `feat(storage): migration` | `src/storage/migrations.ts`，6 个 Vitest 用例 |
| 5b | `fix(storage): correct legacy key` | 把 `tianming.profile` 修成 V7.0 真正用的 `career_navigator_profile` |
| 6 | `refactor(app): App.tsx via adapter` | `src/core/legacyAdapter.ts`；App.tsx 走双轨；3 个 prompt callsite 改吃 `effectiveProfile` |
| 7 | `docs: phase 1 wrap-up` | 本文件 + README |

## 关键决策与遗产

### 1. localStorage key 命名

| Key | 用途 | 何时清掉 |
|---|---|---|
| `career_navigator_profile` | V7.0 legacy Profile（free-text 五字段） | 整个 V7.0 Profile Modal 被 Phase 2 Persona plugins 替换后 |
| `career_navigator_jobs_v10` | JD 列表 | Phase 5 迁 Dexie 时 |
| `career_navigator_usage_v4` | Flash/Pro 调用计数 | Phase 5 迁 Dexie 时 |
| `tianming.userContext.v1` | 新 UserContext 单一来源 | 长期保留，schema bump 才换 v2 |
| `GEMINI_API_KEY` | API Key | 后端代理上线（Phase 4 之后）|

Phase 1 期间 **legacy key 不被删除**，作为回滚兜底 + Phase 2 plugin 数据来源。

### 2. Adapter 寿命

`src/core/legacyAdapter.ts` 是过渡件，做两件事：

- `legacyProfileView(ctx, legacy) → LegacyProfile`：给 V7.0 的 prompt 模板喂数据
- `syncResumeFromLegacy(ctx, legacy) → UserContext`：Profile Modal 保存时把 resumeContent 写进 UserContext

预计**砍除时机**：

- Phase 2 完成（真正的 Persona plugins 接管 `bg / astrology / preferences`）
- Phase 4 完成（match engine 直接吃 `UserContext`，不再走 `Profile` 形状）

砍除时同步删 `types.ts` 里的 `Profile / LegacyProfile`。

### 3. 测试覆盖

- `src/test/setup.test.ts` — Vitest + jsdom + Zod 三件套 sanity
- `src/storage/migrations.test.ts` — 6 个用例：纯函数迁移（正常 / 空 resume）+ 编排器（fresh / 首次迁移 / 幂等 / 损坏 JSON 兜底）
- `src/core/legacyAdapter.test.ts` — 5 个用例：view 默认 / view override / sync 空no-op / sync 首次创建 / sync 更新 + immutability

合计 13 个测试。运行：`npm test`。

### 4. 残留 lint warning（20 条）

| 类别 | 数量 | 处理时机 |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | ~10 | Phase 4 重构 matchEngine 时给 `any` 上正经类型 |
| `react-hooks/set-state-in-effect` | 1 | 把整个 init useEffect 拆成 lazy initializer 时一起清 |
| 杂项 unused vars | ~9 | 随手清，无紧迫性 |

### 5. 故意没做的事

- 没把根目录的 `App.tsx` / `types.ts` / `constants.tsx` / `services/` 搬进 `src/`。Phase 7 UI 整体调整时一并搬，避免 Phase 1 diff 爆炸。
- 没动 `constants.tsx`（3 个 prompt 模板）和 `services/geminiService.ts`（3 个 LLM 调用）。adapter 兜住了它们的 `Profile` 形状契约；Phase 4 真正重构 match engine 时再换。
- 没引 PersonaPlugin / MatchContext 接口（HANDOFF §6 提到但属于 Phase 2 / Phase 4 领地）。

## 下一步（Phase 2）

- 建 `src/personas/PersonaPlugin.ts` 接口 + `src/personas/registry.ts`
- 实现 MBTI / Holland / Big5 三个核心插件 + 八字隐藏插件
- 改 Profile Modal 用 plugin form components 替换 V7.0 free-text textarea
- 那时本文件 §2 提到的 adapter 进入"准退役"状态
