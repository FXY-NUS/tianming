# Phase 5.5 Notes · Apply Assistant L2

> 当前状态：Codex 本地实现中。目标是把“决定投递”之后的最后一公里降到复制字段和邮件正文，不做自动填表、不做自动提交、不新增 LLM 调用。

---

## 1. Scope

Phase 5.5 只做 L2：

- 用户维护本地 `ApplyProfile`：姓名、邮箱、电话、链接、工签、起始日期、邮件签名等常用投递字段。
- 用户维护 `savedAnswers`：自己写好的通用回答模板。
- 深审结果区展示一个默认收起的“投递助手”，提供字段复制和邮件正文拼装复制。
- Phase 4.6 的 `recommended_resume` 只接一个最简文字 banner，完整视觉留给 Phase 7 / M3。

明确不做：

- 不调 Gemini / 不新增任何 LLM call。
- 不做 DOM autofill、content script、自动提交。
- 不动 scoring / prompt / rubric version。
- 不渲染 `edits_suggestion` 详细 UI。

---

## 2. Data Model

`UserPreferences` 新增可选字段：

```ts
applyProfile?: ApplyProfile;
```

所有字段 optional，保证旧用户 context 加载不崩。保存时会清理空白字段和空白 savedAnswers；没有内容时不静默创建空对象。

---

## 3. Implementation

- `types.ts`
  - 新增 `ApplyProfile` / `SavedAnswer`
  - `UserPreferences.applyProfile?: ApplyProfile`
- `services/applyAssistant.ts`
  - `getApplyProfileFields`
  - `buildApplyEmail`
- `src/components/ApplyAssistantPanel.tsx`
  - Phase 4.6 recommended resume 最简 banner
  - L2 字段复制
  - 邮件模式拼装复制
- `App.tsx`
  - Profile modal 新增“投递助手”tab
  - 支持从 active resume 的 structured.basic 一次性预填
  - 深审结果区接入 `ApplyAssistantPanel`

---

## 4. Validation

自动化：

- `services/applyAssistant.test.ts`
  - 有 savedAnswer 时拼装邮件
  - 无 savedAnswer 时不塞占位文案
  - 无 signature 时 fallback 到姓名 / 邮箱 / 电话
  - 只返回已填写字段

手动 smoke 待补：

- 老用户无 `applyProfile` 打开 App 不报错。
- 设置投递档案后，深审结果区能复制字段。
- 邮件模式能选 savedAnswer 并复制完整正文。
- 推荐简历 banner 点击后切换 `activeResumeId`，Dexie 持久化。

---

*Notes v0.1 · 2026-06-15 · Codex 本地实现*
