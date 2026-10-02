# 后端代理（Phase 6.4 · D9 落地）

> 目标只有一个：**Gemini API Key 不再出现在浏览器里**。Web App 和浏览器扩展都调同一个代理；
> 代理只做转发 + 白名单校验，**不碰评分**（rubric / scoringVersion 不变，LLM 抽证据、代码算分的铁律照旧）。

## 1. 形态

```
Web App（Vite 前端）──┐
                       ├──► POST {base}/api/generate ──► 代理（持有 GEMINI_API_KEY）──► Gemini REST
浏览器扩展（MV3）───────┘
```

| 文件 | 作用 |
|---|---|
| `server/contract.ts` | **接口契约**（请求 / 响应 / 错误码 / 模型白名单）。前端、扩展、代理三方共享的唯一真相 |
| `server/handler.ts` | 平台无关的处理函数：标准 `Request` 进、标准 `Response` 出。校验、CORS、口令、转发 Gemini |
| `server/worker.ts` | Cloudflare Workers 入口（公网部署形态） |
| `server/vitePlugin.ts` | 本地开发形态：把 `/api/*` 挂进 `npm run dev` / `npm run preview` 同一端口，零额外进程 |
| `services/llmClient.ts` | 前端唯一 LLM 调用入口。默认走代理；`VITE_LLM_MODE=byok` 才回到浏览器直连 |

`services/geminiService.ts` / `resumeParser.ts` / `jobEvidenceExtractor.ts` 不再 `new GoogleGenAI(...)`，
全部改为调 `llmClient.generateContent()`，传参形状与 SDK 的 `models.generateContent` 一致，所以 prompt /
schema / thinkingBudget 等一个字没改。

## 2. 接口契约 v1（扩展按这个对接，改动必须同步本节 + `server/contract.ts`）

### `POST {base}/api/generate`

请求体（JSON）：

```ts
{
  model: 'gemini-3-flash-preview' | 'gemini-3-pro-preview';   // 白名单外一律 400
  contents: string | Array<{ role?: 'user' | 'model'; parts: Array<{ text?: string } | { inlineData: { mimeType: string; data: string } }> }>;
  config?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: unknown;
    temperature?: number;
    thinkingConfig?: { thinkingBudget?: number };            // 上限 32768
  };                                                          // 其它 config 字段一律 400
}
```

成功 `200`：

```ts
{ text: string | null; model: string }   // text 与 SDK 的 response.text 等价（已去掉 thought 片段）
```

失败：`{ error: { code, message } }`，HTTP 状态码与 `code` 对应：

| HTTP | code | 含义 |
|---|---|---|
| 400 | `BAD_REQUEST` | 体不是 JSON / contents 空 / config 含白名单外字段 / thinkingBudget 超限 |
| 400 | `MODEL_NOT_ALLOWED` | 模型不在白名单 |
| 401 | `UNAUTHORIZED` | 代理设了 `PROXY_TOKEN` 而请求没带 / 带错 `Authorization: Bearer` |
| 403 | `ORIGIN_NOT_ALLOWED` | 跨域来源不在 `ALLOWED_ORIGINS` |
| 404 / 405 | `NOT_FOUND` / `METHOD_NOT_ALLOWED` | 路由或方法不对 |
| 413 | `PAYLOAD_TOO_LARGE` | 体超过 20 MB（简历 PDF base64 之上留了余量） |
| 429 | `RESOURCE_EXHAUSTED` | Gemini 限额，前端照旧提示"等 1 分钟" |
| 429 | `RATE_LIMITED` | 代理自己的限流：同一 IP 每分钟超过上限（部署默认 20 次）。带 `Retry-After: 60` 头 |
| 500 | `SERVER_MISCONFIGURED` | 代理没配 `GEMINI_API_KEY` |
| 502 | `UPSTREAM_ERROR` | Gemini 其它错误，`message` 带原文 |

请求头：`Content-Type: application/json`；设了口令时加 `Authorization: Bearer <PROXY_TOKEN>`。

### `GET {base}/api/health` → `{ ok: true, version: 'v1' }`

### CORS

- 同源请求（本地 dev / 前端与代理同域部署）不需要任何配置。
- 跨域（扩展、前端单独部署）把来源写进 `ALLOWED_ORIGINS`，逗号分隔。扩展的来源形如
  `chrome-extension://<扩展 id>`；代理对 `OPTIONS` 预检回 204。
- 预检放行头：`Content-Type, Authorization`；方法：`GET, POST, OPTIONS`。

### 扩展接入要点（给 Phase 6.1-6.3）

1. 扩展**不装 `@google/genai`**，只 `fetch` 上面的接口（D5）。
2. 请求形状直接复用 `server/contract.ts` 的 `GenerateRequest` 类型。
3. 评分照旧在 Web App 侧的 `MatchEngine` 做；扩展要么把 JD 传给 Web App，要么自己调代理拿证据后喂给
   `scoreBatchScreenRecord`，两种都不要让 LLM 出分。
4. `ALLOWED_ORIGINS` 里加上扩展 id；如果代理开了 `PROXY_TOKEN`，口令放 `chrome.storage`，不写进扩展包。

## 3. 环境变量（见 `.env.example`）

| 变量 | 侧 | 说明 |
|---|---|---|
| `GEMINI_API_KEY` | 服务端 | 唯一持有 Key 的地方 |
| `ALLOWED_ORIGINS` | 服务端 | 跨域白名单，逗号分隔 |
| `PROXY_TOKEN` | 服务端 | 可选共享口令 |
| `RATE_LIMITER` | 服务端 | Cloudflare 限流绑定，`wrangler.jsonc` 里配，不是环境变量；本地没有就不限流（§7.4） |
| `VITE_LLM_MODE` | 前端 | 缺省 = 代理；`byok` = 浏览器直连（保留给开发者 / BYOK 模式） |
| `VITE_TIANMING_API_BASE` | 前端 | 代理不同源时填，缺省同源 |
| `VITE_TIANMING_PROXY_TOKEN` | 前端 | 对应 `PROXY_TOKEN`；会进 bundle，只适合私人部署 |

`VITE_GEMINI_API_KEY` 不再被读取。旧 `vite.config.ts` 里把 `GEMINI_API_KEY` `define` 进
`process.env.*` 的两行已删（那两行会把 Key 打进 bundle，正是 D9 要堵的洞）。

## 4. 怎么跑

**本地开发**：`.env.local` 写 `GEMINI_API_KEY=...`，然后 `npm run dev`。前端请求同源 `/api/generate`，
Vite 插件在 Node 侧转发。右上角的"Key"按钮和"未激活"遮罩在代理模式下不再显示。

**沿用旧 BYOK 直连**：`.env.local` 写 `VITE_LLM_MODE=byok`，行为与改动前一致（Key 存 localStorage）。

**Cloudflare Workers 部署**：见 §7。

## 5. 这版刻意没做的（留给 D9 产品化路线）

- 没有按用户的鉴权 / 配额 / 计费。`PROXY_TOKEN` 只是私人部署的门闩，不是账号体系。
- 限流只按 IP（§7.4），不是按用户的配额；同一个 NAT 后面的多人共享额度。要更细再上 Turnstile 或账号体系。
- 没有 streaming（HANDOFF A5 说的 Flash/Pro 慢，等 streaming 时再在契约里加 `stream: true`）。
- `sendMessageToJobConsultant` 原来用 SDK 的 `chats.create` 单轮问答，改成等价的一次 `generateContent`
  （每次调用本来就是新会话，没有多轮历史），行为不变。

## 6. 校验方式

- `server/handler.test.ts`：模型白名单、config 白名单、thinkingBudget 上限、口令、CORS、413、429 / 502 映射、
  Key 不泄漏到响应；限流（超限 429 + `Retry-After`、按 IP 计数、先限流再验口令、health / 预检不计数、
  限流服务出错放行、本地无绑定不限流）。
- `server/worker.test.ts`：网页静态资源与 `/api/*` 的分流、限流绑定透传。
- `services/llmClient.test.ts`：默认代理模式、`API_BASE` / `TOKEN` 生效、错误透传。
- 原三个 service 测试把 `@google/genai` mock 换成 `./llmClient` mock，评分断言一字未改。

## 7. 部署（Cloudflare Workers）

### 7.1 形态

**一个 Worker 同时托管网页和代理**：`npm run build` 产出的 `dist/` 作为静态资源，`/api/*` 进
`server/worker.ts` 转发 Gemini。网页和代理同源，前端不用填 `VITE_TIANMING_API_BASE`，也不需要 CORS。
配置全在仓库根目录 `wrangler.jsonc`，里面没有任何密钥。

| 项 | 值 | 在哪改 |
|---|---|---|
| Worker 名 | `tianming`，上线后地址是 `https://tianming.<你的子域>.workers.dev` | `wrangler.jsonc` 的 `name` |
| 静态资源 | `dist/`，找不到的路径回 `index.html` | `assets` |
| 限流 | 每个 IP 每 60 秒 20 次 `/api/generate` | `ratelimits[0].simple.limit` |
| 跨域白名单 | 默认空（同源不需要） | `vars.ALLOWED_ORIGINS` |
| `GEMINI_API_KEY` / `PROXY_TOKEN` | 只存在 Cloudflare | `wrangler secret put`，见 7.2 |

wrangler 没装进依赖，`npm run deploy` 用 `npx wrangler@4` 现拉，第一次会慢一点。

### 7.2 Flora 要亲手做的步骤

在本地仓库根目录（已 `git pull` 到含本节的 main）执行。命令在 PowerShell 和 Git Bash 里都一样。

1. **注册 / 登录 Cloudflare**：免费套餐就够。然后登录 wrangler，会弹浏览器授权：

   ```bash
   npx wrangler@4 login
   ```

2. **确认 `.env.local` 里前端变量是代理模式**：`VITE_LLM_MODE`、`VITE_TIANMING_API_BASE` 都留空或删掉。
   `GEMINI_API_KEY` 留在 `.env.local` 没关系，它不会进网页包。

3. **先预演一次**（构建 + 打包 Worker，不上传）：

   ```bash
   npm run deploy:dry-run
   ```

   末尾看到 `env.RATE_LIMITER (20 requests/60s)`、`env.ASSETS` 两个绑定就对了。
   如果第 4 步真部署时报 `ratelimits` 相关错误，把报错贴回线程，别自己删掉限流配置。

4. **部署**：

   ```bash
   npm run deploy
   ```

   输出里会给出 `https://tianming.<你的子域>.workers.dev`，记下来，下面叫 `$BASE`。
   这一刻代理还没有 Key，调用会返回 500 `SERVER_MISCONFIGURED`，属正常。

5. **设置 Gemini Key**（命令会提示粘贴，输入不回显，不会进仓库也不会进命令历史）：

   ```bash
   npx wrangler@4 secret put GEMINI_API_KEY
   ```

   secret 立即生效，不用重新部署。

6. **设置 `PROXY_TOKEN`**（任选一串随机字符，例如密码管理器生成 32 位）：

   ```bash
   npx wrangler@4 secret put PROXY_TOKEN
   ```

   设了口令后网页也要带上它：在 `.env.local` 加一行 `VITE_TIANMING_PROXY_TOKEN=<同一串>`，再
   `npm run deploy` 一次。注意这串口令会写进网页的 JS，打开网页的人都能看到；它挡的是不打开网页、
   直接扫接口的脚本，真正兜底的是 7.4 的限流。网页要公开给别人用时，可以 `npx wrangler@4 secret delete PROXY_TOKEN`
   并去掉 `.env.local` 那行，只靠限流。

7. **给 Key 设上限**（推荐）：在 Google AI Studio / Google Cloud 控制台给这个 Key 所在项目设每日配额或预算提醒。
   代理限流是按 IP 的，多 IP 刷量时最后一道闸在 Google 那边。

### 7.3 怎么验证

把 `$BASE` 换成第 4 步拿到的地址。PowerShell 里要写 `curl.exe`（`curl` 在 PowerShell 里是别的命令的别名）。

1. **健康检查**：浏览器打开 `$BASE/api/health`，应看到 `{"ok":true,"version":"v1"}`。
2. **网页**：打开 `$BASE`，导入或粘贴一个 JD，跑一次批量初筛，能出分说明 Key 和转发都通了。
   刷新任意子路径（如 `$BASE/anything`）也应回到网页，不是 404。
3. **Key 没进网页包**：浏览器开发者工具 → Sources，全局搜 `AIza`（Gemini Key 的前缀），应搜不到。
4. **限流**：连发 25 次空请求（空请求在校验阶段就被拒，不会调用 Gemini、不花额度）：

   ```bash
   for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code} " -X POST -H "Content-Type: application/json" -d "{}" $BASE/api/generate; done
   ```

   PowerShell 版：

   ```powershell
   1..25 | % { curl.exe -s -o NUL -w "%{http_code} " -X POST -H "Content-Type: application/json" -d "{}" "$BASE/api/generate" }
   ```

   前约 20 个是 `401`（设了口令）或 `400`，之后变成 `429`。Cloudflare 的计数按机房、略有延迟，多放行一两个属正常。
   等 1 分钟后再请求应恢复。

### 7.4 限流方案说明

- 用 Cloudflare Workers 自带的 Rate Limiting 绑定（`wrangler.jsonc` 的 `ratelimits`），不需要 KV / Durable Object，
  免费套餐可用。计数 key 是 `CF-Connecting-IP`，只看 IP，不读请求体。
- 只对 `POST /api/generate` 计数；`/api/health` 和 CORS 预检不计。限流在验口令之前，猜口令也会被限。
- 超限返回 `429` + `{ error: { code: 'RATE_LIMITED', ... } }` + `Retry-After: 60`；前端提示「请求太频繁，等 1 分钟」。
- 限流服务自身出错时放行（宁可短暂不限，也不让所有人一起失败）。本地 `npm run dev` 没有这个绑定，不限流。
- 20 次 / 分钟的依据：批量初筛一次只发 1 个请求，深审和简历解析各 1 个，正常使用远到不了。扩展上线后如果
  每张卡片单独调用，再按实际调高 `limit`（`period` 只能是 10 或 60）。

### 7.5 隐私（D6）

- 代理不存任何东西：没有 KV / 数据库绑定，代码里没有 `console.log`，请求体只在内存里转发给 Gemini。
- `wrangler.jsonc` 没开 `observability`（Workers Logs）。即使以后开，也只会记录请求元数据（路径、状态码、耗时），
  不会有请求正文；改动时别在 `server/` 里加打印请求体的日志。
- `npx wrangler@4 tail` 能看实时请求元数据，排错用，同样不含正文。

### 7.6 之后的维护

- **更新**：合并新代码后在本地 `git pull`，再 `npm run deploy`。
- **回滚**：`npx wrangler@4 rollback`，回到上一个版本。
- **扩展接入**：把 `chrome-extension://<扩展 id>` 写进 `wrangler.jsonc` 的 `vars.ALLOWED_ORIGINS`（逗号分隔）再部署。
  别在 Cloudflare 控制台里改这个变量，下次 `deploy` 会被 `wrangler.jsonc` 覆盖。
- **自定义域名**：控制台 Workers → tianming → Settings → Domains & Routes 添加，同源结构不变。
