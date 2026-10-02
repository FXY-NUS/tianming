# 天命浏览器扩展（Phase 6.1–6.3）

LinkedIn 岗位列表 → 天命的单向搬运工。只读用户正在看的页面：已加载的卡片打徽章，用户点开的详情一键送进天命。不翻页、不请求详情页、不后台抓取（HANDOFF D4'）；扩展里没有 API Key，也不调 Gemini（D5）。

## 安装（不需要 npm）

1. 打开仓库的 Actions 页，点最新一次 main 上绿色的 CI 运行，拉到底部 Artifacts，下载 `tianming-extension-…`（需要登录 GitHub）。
2. 把下载的 zip 解压到一个固定的文件夹（之后别删、别挪，Chrome 每次启动都从这里读）。
3. Chrome 地址栏打开 `chrome://extensions`，右上角打开「开发者模式」，点「加载已解压的扩展程序」，选刚才解压出来、里面有 `manifest.json` 的那个文件夹。
4. 更新：下载新的 zip，解压覆盖同一个文件夹，在 `chrome://extensions` 里点扩展卡片上的刷新按钮。

## 设置天命网址

扩展默认把岗位送到 CI 构建时设定的天命网址：仓库变量 `TIANMING_APP_URL`（Settings → Secrets and variables → Actions → Variables），没设就是本地开发版 `http://localhost:3000`。部署上线后设好这个变量，之后 main 上产出的安装包默认就指向线上网址。

想临时换网址不用重新构建：`chrome://extensions` → 天命扩展「详细信息」→「扩展程序选项」，填天命网址点保存，Chrome 会问一次能否访问这个网站，选「允许」。留空保存即恢复默认。只接受 https 网址（本机调试可以用 `http://localhost`）。

为什么这样做：MV3 的 content script 静态注入只能写在 manifest 里，所以默认网址在构建时写进去，开箱即用、不用额外授权；自填网址走 `optional_host_permissions` + `chrome.scripting.registerContentScripts`，只在用户保存时申请那一个站点的权限，不预先要全部网站的权限。

## 开发者构建

```bash
npm run build:extension                                    # 产物在 extension/dist/，默认网址 localhost:3000
TIANMING_APP_URL=https://你的天命网址 npm run build:extension   # 换默认网址
```

改完代码重新 build，再在扩展页点刷新。本地天命 Web App 用 `npm run dev`，跑在 `http://localhost:3000`。

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
| `src/background.ts` | service worker：入队、粗筛转发、打开天命标签页、按设置注册 bridge |
| `src/appUrl.ts` | 天命网址：构建时默认值 + 用户自填，校验和 match pattern |
| `src/bridgeRegistration.ts` | 自填网址时把 bridge 动态注册到该站点 |
| `src/options/` | 扩展设置页（填天命网址） |
| `src/scoring.ts` | 粗筛评分适配层，唯一的代理接入点（现在返回「未评分」） |
| `../services/extensionProtocol.ts` | 扩展与 Web App 共用的消息格式 |
| `test/` | 用保存下来的 LinkedIn 页面片段做的测试（`npm test` 一起跑） |

## 接后端代理（Phase 6.4）

代理已合入 main，契约见 `doc/backend-proxy.md`（`POST /api/generate`，请求形状复用 `server/contract.ts`）。但扩展不能直接调代理给卡片打分：`scoreBatchScreenRecord` 需要完整的 `UserContext`（简历、偏好、画像），这些只在天命 Web App 的 IndexedDB 里，扩展拿不到，也不该把简历数据复制进扩展存储（D6）。

下一步的做法：卡片快照经 `appBridge` 交给打开着的天命页面，由 Web App 照旧调 Flash 抽证据、`scoreBatchScreenRecord` 算分，再把档位回给扩展。`src/scoring.ts` 的 `getTriageScorer()` 是唯一切换点，content script 和徽章不用动。天命页面没打开、或请求失败时降级为「未评分」。徽章状态：`pass` / `maybe` / `reject` / `need_full_jd` / `unscored`。
