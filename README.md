# Tianming · 天命

> **100 个岗位你只能投 1 个。  
> 我们让你看清那 1 个。**

为「看到一堆 JD 就头疼、迟迟不行动」的求职者做的决策支持工具。

---

## North Star

> **"帮一个怕错的人按下投递键。  
> 单卡聚焦，Next 推动，隐形算法管理批次质量。"**

每一个 PR、每一行 prompt、每一个像素都用这一句过一遍。  
对齐 → 做。不对齐 → 砍。

---

## 这不是为谁做的

- ❌ 海投型求职者（LinkedIn Easy Apply / Indeed 已经为他们服务）
- ❌ HR / 招聘官（这是给候选人本身用的）
- ❌ "AI 帮你跑完整个求职"的全自动 agent 拥趸

## 这是为谁做的

- 你有简历，但还没投出去几份
- 你看到一页搜索结果就关掉浏览器
- 你被"投递就要写 cover letter"卡住
- 你想要的不是更多选项，是**少一点犹豫**

---

## 三层产品

```
Layer 1 · Streaming Flow
  N 个 JD → 屏中央 1 张大卡 + 4 张准备好的下一批
  算法过滤是隐形的。
  设计哲学：Spotify Discover Weekly / Hinge，不是 LinkedIn 列表。

Layer 2 · 决策审计
  Gemini 抽证据，代码算分（Pass A/B/C 三层 rubric，可解释）。
  叙事层叠加：pros & cons + 12-24 月可执行 action plan。
  Persona 系统（MBTI / Holland / Big5 etc.）作为画像图层。

Layer 3 · 投递助手（Apply Assistant）
  L2 结构化字段一键复制 + AI cover snippet 可编辑后粘贴
  L3 浏览器扩展侧边栏 paste-helper
  。
```

---

## 我们永远不做的事

- **不做自动投递 / autofill**。让用户按按钮，不是替他按。  
  "替犹豫者按按钮 = 让他更被动"。
- **不做漏斗仪表盘 / 决策桶**。用户不是 HR，不需要 triage UI。
- **不暴露任何过滤数字**。"我们扔了 83 个" 会让用户回头点 Skip 桶撤销过滤。
- **简历原文件不上云**。本地解析、本地存储。PII 红线。
- **API Key 不进 repo、不进扩展包**。BYOK 仅当前阶段；Phase 6 起后端代理。
- **LLM 不输出最终分数**。Gemini 只抽证据，代码按版本化 rubric 算分。

---

## 当前进度

- ✅ JD 批量初筛 + 单 JD 深度审计
- ✅ Persona 插件系统（4 个：MBTI / Holland / Big5 etc）
- ✅ 简历多模态解析（PDF / DOCX / 图片）+ 多版本管理
- ✅ Pass A/B/C 评分引擎 + 可解释维度分
- ✅ Phase 5 Dexie 存储升级（解决跨 tab 持久化）
- ⏳ Phase 5.5 Apply Assistant L2
- ⏳ Phase 6 浏览器扩展（卡片粗筛 + 详情捕获）

完整 roadmap 见 [`doc/HANDOFF.md`](doc/HANDOFF.md)。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | React 18 + TypeScript + Vite |
| AI | `@google/genai`（Gemini Flash + Pro，多模态） |
| 样式 | Tailwind CSS（shadcn/ui · Phase 7 引入） |
| 表单 | react-hook-form + Zod |
| 测试 | Vitest |
| 存储 | localStorage → Dexie/IndexedDB（Phase 5） |
| 状态 | `useState` + `useLiveQuery`。**不引入** Redux / Zustand / Jotai |
| Lint | ESLint + Prettier + Husky |

---

## 快速开始

```bash
git clone https://github.com/FXY-NUS/tianming.git
cd tianming
npm install
cp .env.example .env.local   # 填入 GEMINI_API_KEY（服务端变量，由内置 /api 代理读取，不进前端）
npm run dev
```

API key 从 [Google AI Studio](https://aistudio.google.com) 拿。

---

## 隐私

- 简历原文件**永不上云**
- API key **仅本地**使用
- 所有 AI 分析在你自己的浏览器里跑（BYOK）

---

## 贡献

最缺的不是 PR，是**真实犹豫型用户的 1:1 访谈**。

如果你看到 100 个 JD 就关浏览器，欢迎：
- 开 Issue 描述你卡在哪一步
- 跑一遍 demo，告诉我们哪个动作让你又 freeze 了
- 看 [`doc/HANDOFF.md`](doc/HANDOFF.md) 找你能帮忙的 Track

---

> *天命非命定，是你看清下一步后敢迈出那一步。*
