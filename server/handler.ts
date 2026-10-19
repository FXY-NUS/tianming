/**
 * 平台无关的代理处理函数：输入标准 Request，输出标准 Response。
 * Cloudflare Worker（server/worker.ts）和 Vite dev/preview 中间件（server/vitePlugin.ts）共用。
 * 模型 Key 只在这里读取（env.GEMINI_API_KEY / DEEPSEEK_API_KEY / KIMI_API_KEY），永远不回传给调用方。
 * 用哪家由 env.LLM_PROVIDER 决定，见 server/providers.ts。
 */
import {
  ALLOWED_CONFIG_KEYS,
  ALLOWED_MODELS,
  GENERATE_PATH,
  HEALTH_PATH,
  MAX_BODY_BYTES,
  MAX_THINKING_BUDGET,
  PROXY_CONTRACT_VERSION,
  RATE_LIMIT_RETRY_AFTER_SECONDS,
  type GenerateConfig,
  type GenerateRequest,
  type GenerateResponse,
  type ProxyContent,
  type ProxyErrorBody,
  type ProxyErrorCode,
} from './contract';
import {
  extractOpenAiCompatText,
  resolveProvider,
  toOpenAiCompatBody,
  TruncatedOutputError,
  UnsupportedInputError,
  type ProviderEnv,
  type ResolvedProvider,
} from './providers';

export interface ProxyEnv extends ProviderEnv {
  /** 逗号分隔的跨域白名单，例如 "https://tianming.example.com,chrome-extension://abc"。同源请求无需配置。 */
  ALLOWED_ORIGINS?: string;
  /** 可选共享口令；设置后请求必须带 Authorization: Bearer <token>。 */
  PROXY_TOKEN?: string;
  /** Cloudflare Workers Rate Limiting 绑定（wrangler.jsonc 的 ratelimits）。没有绑定（本地 dev）就不限流。 */
  RATE_LIMITER?: RateLimiter;
}

/** 与 Cloudflare 的 RateLimit 绑定同形，测试里可以直接塞假实现。 */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ProxyErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export async function handleProxyRequest(
  request: Request,
  env: ProxyEnv,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsOrigin = resolveCorsOrigin(origin, url.origin, env.ALLOWED_ORIGINS);

  try {
    if (origin && corsOrigin === null) {
      throw new RequestError(403, 'ORIGIN_NOT_ALLOWED', `Origin ${origin} is not allowed`);
    }

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), corsOrigin);
    }

    if (url.pathname === HEALTH_PATH) {
      if (request.method !== 'GET') {
        throw new RequestError(405, 'METHOD_NOT_ALLOWED', 'Use GET');
      }
      const provider = resolveProvider(env, 'gemini-3-flash-preview');
      return withCors(
        json(200, { ok: true, version: PROXY_CONTRACT_VERSION, provider: provider?.id ?? null }),
        corsOrigin,
      );
    }

    if (url.pathname !== GENERATE_PATH) {
      throw new RequestError(404, 'NOT_FOUND', `No route for ${url.pathname}`);
    }
    if (request.method !== 'POST') {
      throw new RequestError(405, 'METHOD_NOT_ALLOWED', 'Use POST');
    }

    // 先限流再验口令：猜口令的请求同样计数。
    await checkRateLimit(request, env.RATE_LIMITER);
    checkToken(request, env.PROXY_TOKEN);

    const body = validateGenerateRequest(await readJsonBody(request));
    const provider = resolveProvider(env, body.model);
    if (!provider) {
      throw new RequestError(
        500,
        'SERVER_MISCONFIGURED',
        `LLM_PROVIDER "${env.LLM_PROVIDER}" is not one of: gemini, deepseek, kimi`,
      );
    }
    if (!provider.apiKey) {
      throw new RequestError(
        500,
        'SERVER_MISCONFIGURED',
        `${provider.keyVar} is not set on the proxy`,
      );
    }

    const result =
      provider.id === 'gemini'
        ? await callGemini(body, provider, fetchImpl)
        : await callOpenAiCompat(body, provider, fetchImpl);
    return withCors(json(200, result), corsOrigin);
  } catch (err) {
    if (err instanceof RequestError) {
      const response = errorResponse(err.status, err.code, err.message);
      if (err.code === 'RATE_LIMITED') {
        response.headers.set('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SECONDS));
      }
      return withCors(response, corsOrigin);
    }
    const message = err instanceof Error ? err.message : 'Unknown proxy error';
    return withCors(errorResponse(502, 'UPSTREAM_ERROR', message), corsOrigin);
  }
}

/** 返回应写入 Access-Control-Allow-Origin 的值；无 Origin 时为 undefined；被拒为 null。 */
function resolveCorsOrigin(
  origin: string | null,
  selfOrigin: string,
  allowList: string | undefined,
): string | null | undefined {
  if (!origin) return undefined;
  if (origin === selfOrigin) return origin;
  const allowed = (allowList ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function withCors(response: Response, corsOrigin: string | null | undefined): Response {
  if (corsOrigin) {
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
    response.headers.append('Vary', 'Origin');
  }
  return response;
}

/**
 * 按客户端 IP 计数（Cloudflare 填的 CF-Connecting-IP）。只用 IP 做 key，不读请求体，也不记日志。
 * 限流服务本身出错时放行：宁可短暂不限流，也不让所有用户一起失败。
 */
async function checkRateLimit(request: Request, limiter: RateLimiter | undefined) {
  if (!limiter) return;
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  let success = true;
  try {
    ({ success } = await limiter.limit({ key: `ip:${ip}` }));
  } catch {
    return;
  }
  if (!success) {
    throw new RequestError(
      429,
      'RATE_LIMITED',
      `Too many requests from this client. Retry in ${RATE_LIMIT_RETRY_AFTER_SECONDS} seconds.`,
    );
  }
}

function checkToken(request: Request, token: string | undefined) {
  if (!token) return;
  const header = request.headers.get('Authorization') ?? '';
  if (header !== `Bearer ${token}`) {
    throw new RequestError(401, 'UNAUTHORIZED', 'Missing or invalid proxy token');
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) {
    throw new RequestError(413, 'PAYLOAD_TOO_LARGE', `Body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new RequestError(413, 'PAYLOAD_TOO_LARGE', `Body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new RequestError(400, 'BAD_REQUEST', 'Body must be JSON');
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function validateGenerateRequest(input: unknown): GenerateRequest {
  if (!isRecord(input)) throw new RequestError(400, 'BAD_REQUEST', 'Body must be an object');

  const { model, contents, config } = input;
  if (typeof model !== 'string' || !(ALLOWED_MODELS as readonly string[]).includes(model)) {
    throw new RequestError(
      400,
      'MODEL_NOT_ALLOWED',
      `model must be one of: ${ALLOWED_MODELS.join(', ')}`,
    );
  }

  if (typeof contents === 'string') {
    if (!contents.trim()) throw new RequestError(400, 'BAD_REQUEST', 'contents is empty');
  } else if (!Array.isArray(contents) || contents.length === 0 || !contents.every(isContent)) {
    throw new RequestError(400, 'BAD_REQUEST', 'contents must be a string or Content[]');
  }

  if (config !== undefined) validateConfig(config);

  return input as unknown as GenerateRequest;
}

function isContent(value: unknown): value is ProxyContent {
  if (!isRecord(value) || !Array.isArray(value.parts) || value.parts.length === 0) return false;
  if (value.role !== undefined && value.role !== 'user' && value.role !== 'model') return false;
  return value.parts.every(
    (part) =>
      isRecord(part) &&
      (typeof part.text === 'string' ||
        (isRecord(part.inlineData) &&
          typeof part.inlineData.mimeType === 'string' &&
          typeof part.inlineData.data === 'string')),
  );
}

function validateConfig(config: unknown): asserts config is GenerateConfig {
  if (!isRecord(config)) throw new RequestError(400, 'BAD_REQUEST', 'config must be an object');
  const unknownKeys = Object.keys(config).filter(
    (key) => !(ALLOWED_CONFIG_KEYS as readonly string[]).includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new RequestError(
      400,
      'BAD_REQUEST',
      `config keys not allowed: ${unknownKeys.join(', ')}`,
    );
  }
  if (config.systemInstruction !== undefined && typeof config.systemInstruction !== 'string') {
    throw new RequestError(400, 'BAD_REQUEST', 'config.systemInstruction must be a string');
  }
  const budget = isRecord(config.thinkingConfig) ? config.thinkingConfig.thinkingBudget : undefined;
  if (budget !== undefined && (typeof budget !== 'number' || budget > MAX_THINKING_BUDGET)) {
    throw new RequestError(
      400,
      'BAD_REQUEST',
      `thinkingBudget must be a number <= ${MAX_THINKING_BUDGET}`,
    );
  }
}

/** SDK 风格参数 → Gemini REST 请求体。 */
export function toGeminiRestBody(req: GenerateRequest): Record<string, unknown> {
  const contents: ProxyContent[] =
    typeof req.contents === 'string'
      ? [{ role: 'user', parts: [{ text: req.contents }] }]
      : req.contents.map((content) => ({ role: content.role ?? 'user', parts: content.parts }));

  const { systemInstruction, ...generationConfig } = req.config ?? {};
  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
  return body;
}

interface GeminiRestResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  error?: { message?: string; status?: string };
}

/** 与 SDK 的 response.text 一致：拼接首个候选里非 thought 的文本片段。 */
export function extractText(data: GeminiRestResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const texts = parts.filter((part) => !part.thought && typeof part.text === 'string');
  return texts.length > 0 ? texts.map((part) => part.text).join('') : null;
}

async function callGemini(
  req: GenerateRequest,
  provider: ResolvedProvider,
  fetchImpl: FetchLike,
): Promise<GenerateResponse> {
  const upstream = await fetchImpl(`${provider.baseUrl}/${provider.model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': provider.apiKey ?? '' },
    body: JSON.stringify(toGeminiRestBody(req)),
  });

  const data = (await upstream.json().catch(() => ({}))) as GeminiRestResponse;
  if (!upstream.ok) {
    const detail = data.error?.message ?? upstream.statusText;
    if (upstream.status === 429) {
      throw new RequestError(429, 'RESOURCE_EXHAUSTED', `Gemini 429: ${detail}`);
    }
    throw new RequestError(
      502,
      'UPSTREAM_ERROR',
      `Gemini ${upstream.status} ${data.error?.status ?? ''}: ${detail}`.trim(),
    );
  }

  return { text: extractText(data), model: provider.model, provider: provider.id };
}

/** DeepSeek / Kimi：兼容 OpenAI 的 chat/completions。 */
async function callOpenAiCompat(
  req: GenerateRequest,
  provider: ResolvedProvider,
  fetchImpl: FetchLike,
): Promise<GenerateResponse> {
  let compat;
  try {
    compat = toOpenAiCompatBody(req, provider);
  } catch (err) {
    if (err instanceof UnsupportedInputError) {
      throw new RequestError(400, 'UNSUPPORTED_INPUT', err.message);
    }
    throw err;
  }

  const upstream = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify(compat.body),
  });

  const data = (await upstream.json().catch(() => ({}))) as Parameters<
    typeof extractOpenAiCompatText
  >[0];
  if (!upstream.ok) {
    const detail = data.error?.message ?? upstream.statusText;
    if (upstream.status === 429) {
      throw new RequestError(429, 'RESOURCE_EXHAUSTED', `${provider.id} 429: ${detail}`);
    }
    throw new RequestError(502, 'UPSTREAM_ERROR', `${provider.id} ${upstream.status}: ${detail}`);
  }

  try {
    const text = extractOpenAiCompatText(data, compat.unwrapArray);
    return { text, model: provider.model, provider: provider.id };
  } catch (err) {
    if (err instanceof TruncatedOutputError) {
      throw new RequestError(502, 'UPSTREAM_ERROR', `${provider.id}: ${err.message}`);
    }
    throw err;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(status: number, code: ProxyErrorCode, message: string): Response {
  const body: ProxyErrorBody = { error: { code, message } };
  return json(status, body);
}
