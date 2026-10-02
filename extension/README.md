# 天命浏览器扩展（Phase 6.1–6.3）

LinkedIn 岗位列表 → 天命的单向搬运工。只读用户正在看的页面：已加载的卡片打徽章，用户点开的详情一键送进天命。不翻页、不请求详情页、不后台抓取（HANDOFF D4'）；扩展里没有 API Key，也不调 Gemini（D5）。

## 构建与加载

```bash
npm run build:extension        # 产物在 extension/dist/
```

Chrome → `chrome://extensions` → 打开「开发者模式」→「加载已解压的扩展程序」→ 选 `extension/dist/`。改完代码重新 build，再在扩展页点刷新。

天命 Web App 用 `npm run dev` 跑在 `http://localhost:3000`（manifest 和 `src/messages.ts` 里写死了这个地址，上线后一起加正式域名）。

## 使用

1. 打开 LinkedIn 岗位搜索页，滚动时视口里的卡片右上角出现「天命 · …」徽章。后端代理接上前一律显示「未评分」。
2. 点开某个岗位，详情区顶部出现「送进天命」按钮。点一下，JD 进入待送队列；按钮变成「已加入天命 · 打开天命」，再点切到天命标签页。
3. 天命页面打开着（或之后打开），岗位自动出现在列表顶部，和粘贴导入走同一条路（`services/jobImport.ts`），按「标题-公司」和链接去重。

## 结构

| 文件 | 作用 |
|---|---|
| `src/linkedin.ts` | LinkedIn 站点适配：卡片快照、详情抽取、jobId 解析 |
| `src/content/linkedinContent.ts` | 页面行为：IntersectionObserver 观察卡片、徽章、送进天命按钮 |
| `src/content/appBridge.ts` | 注入天命页面：`chrome.storage` 待送队列 ↔ `window.postMessage` |
| `src/background.ts` | service worker：入队、粗筛转发、打开天命标签页 |
| `src/scoring.ts` | 粗筛评分适配层，唯一的代理接入点（现在返回「未评分」） |
| `../services/extensionProtocol.ts` | 扩展与 Web App 共用的消息格式 |
| `test/` | 用保存下来的 LinkedIn 页面片段做的测试（`npm test` 一起跑） |

## 接后端代理（Phase 6.4）

`src/scoring.ts` 的 `getTriageScorer()` 换成调代理 `triage` 接口的实现即可，content script 和徽章不用动。徽章状态：`pass` / `maybe` / `reject` / `need_full_jd` / `unscored`。
