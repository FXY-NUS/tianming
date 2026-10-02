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
| `VITE_LLM_MODE` | 前端 | 缺省 = 代理；`byok` = 浏览器直连（保留给开发者 / BYOK 模式） |
| `VITE_TIANMING_API_BASE` | 前端 | 代理不同源时填，缺省同源 |
| `VITE_TIANMING_PROXY_TOKEN` | 前端 | 对应 `PROXY_TOKEN`；会进 bundle，只适合私人部署 |

`VITE_GEMINI_API_KEY` 不再被读取。旧 `vite.config.ts` 里把 `GEMINI_API_KEY` `define` 进
`process.env.*` 的两行已删（那两行会把 Key 打进 bundle，正是 D9 要堵的洞）。

## 4. 怎么跑

**本地开发**：`.env.local` 写 `GEMINI_API_KEY=...`，然后 `npm run dev`。前端请求同源 `/api/generate`，
Vite 插件在 Node 侧转发。右上角的"Key"按钮和"未激活"遮罩在代理模式下不再显示。

**沿用旧 BYOK 直连**：`.env.local` 写 `VITE_LLM_MODE=byok`，行为与改动前一致（Key 存 localStorage）。

**Cloudflare Workers 部署**（雏形，还没接 wrangler 配置，下一步再补）：

```bash
npm i -D wrangler
npx wrangler init  # 入口指向 server/worker.ts
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
# 再把 ALLOWED_ORIGINS / PROXY_TOKEN 配到 Worker vars
```

前端 `VITE_TIANMING_API_BASE=https://<worker>.workers.dev` 后 `npm run build`。

## 5. 这版刻意没做的（留给 D9 产品化路线）

- 没有按用户的鉴权 / 配额 / 计费。`PROXY_TOKEN` 只是私人部署的门闩，不是账号体系。
- 没有限流。Cloudflare 上线前至少加 Workers Rate Limiting 或 Turnstile，否则 Key 等于半公开。
- 没有 streaming（HANDOFF A5 说的 Flash/Pro 慢，等 streaming 时再在契约里加 `stream: true`）。
- `sendMessageToJobConsultant` 原来用 SDK 的 `chats.create` 单轮问答，改成等价的一次 `generateContent`
  （每次调用本来就是新会话，没有多轮历史），行为不变。

## 6. 校验方式

- `server/handler.test.ts`：模型白名单、config 白名单、thinkingBudget 上限、口令、CORS、413、429 / 502 映射、
  Key 不泄漏到响应。
- `services/llmClient.test.ts`：默认代理模式、`API_BASE` / `TOKEN` 生效、错误透传。
- 原三个 service 测试把 `@google/genai` mock 换成 `./llmClient` mock，评分断言一字未改。
