# 天命浏览器扩展（Phase 6.1–6.3 · 6.5）

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

1. 先打开天命页面，再打开 LinkedIn 岗位搜索页，滚动时视口里的卡片右上角出现「天命 · …」徽章。天命页面没开时显示「未评分」。
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
| `src/scoring.ts` | 粗筛评分适配层：把卡片交给天命标签页，没开就「未评分」 |
| `src/triageRelay.ts` | bridge 里按 requestId 中转粗筛请求和结果 |
| `src/content/copySidebar.ts` | 投递页复制侧栏（点扩展图标时注入） |
| `src/copyKitFetch.ts` / `src/copyKitRelay.ts` | 侧栏要内容：service worker 转给天命标签页 / bridge 里按 requestId 中转 |
| `../services/extensionProtocol.ts` | 扩展与 Web App 共用的消息格式 |
| `test/` | 用保存下来的 LinkedIn 页面片段做的测试（`npm test` 一起跑） |

## 卡片评分（Phase 6.2）

扩展自己不调 Gemini，也拿不到简历和画像（D5 / D6）。卡片快照经 `appBridge` 交给**打开着的天命页面**：Web App 用自己的画像走现有批量初筛（Flash 抽证据 → `scoreBatchScreenRecord` 代码算分，goal = `triage`），只把档位和一句理由回给扩展，画像和分数明细不出 Web App。评分逻辑和提示词一个字没改，见 `services/extensionTriage.ts`。

- 徽章：`pass`（合适）/ `maybe`（可看看）/ `reject`（不太合适）/ `need_full_jd`（信息不够，点开看全文）/ `unscored`（没评上）/ `retry_later`（被限流，稍后重试）。鼠标悬停看分数和理由。
- 部署后的代理有限流（超了返回 429）：被限流的卡片显示「稍后重试」，天命页面 1 分钟内不再调 LLM，扩展约 65 秒后把这些卡片合成一批补评一次，每张卡最多补评 3 次。
- 天命页面没打开时一律「未评分」，扩展不会替你开标签页；打开天命后刷新 LinkedIn 页面即可评分。
- 每批最多 30 张卡片；同一会话里每张卡片只评一次（Flash 调用计入天命页面的用量统计）。

## 投递页复制侧栏（Phase 6.5 · D11 L3）

在任意投递页（Greenhouse、Workday、公司官网、LinkedIn Easy Apply……）点浏览器右上角的天命扩展图标，页面右侧出现「天命 · 复制助手」侧栏，列出可以直接复制的内容，每条一个「复制」按钮，复制后自己粘贴到表单里：

- **投递档案**：天命「档案 → 投递助手」里填的姓名、邮箱、电话、链接、工签、起始日期等。
- **简历要点**：当前简历的简介、技能、语言、最近 3 段教育 / 经历 / 项目。
- **已存回答**：投递助手里存的常用回答。
- **邮件正文**：只在 LinkedIn 岗位详情页上有（能认出岗位名和公司时），和天命里的邮件模式同一个模板。

规则：

- 只复制，不碰页面上的表单，不自动提交（D11：L4 autofill / L5 自动提交永久不做）。侧栏底部写着「天命不替你提交。所有投递都是你自己手动点的。」
- 内容每次打开侧栏时向**打开着的天命页面**要，只放在侧栏内存里；点「关闭」就丢掉，不写进 `chrome.storage`（D6）。天命页面没开时侧栏提示先打开，有「打开天命」按钮。改了档案后点侧栏的「刷新」。
- 侧栏放在 closed shadow root 里，投递页的样式和脚本碰不到它的内容。
- 权限：用 `activeTab`，只有用户点图标的那一页会被注入，不申请「所有网站」权限。
- 「收起」变成右边缘的小标签，点它展开；再点一次扩展图标等于关闭。在天命页面本身、`chrome://` 页面上点图标仍是打开天命。

