/**
 * Tianming LLM 代理接口契约（v1）。Web App 与浏览器扩展共用，改动需同步 doc/backend-proxy.md。
 *
 * POST {base}/api/generate
 *   请求体 GenerateRequest，形状与 @google/genai 的 models.generateContent 参数一致。
 *   成功 200 → GenerateResponse；失败 → ProxyErrorBody + 对应 HTTP 状态码。
 * GET  {base}/api/health → { ok: true, version }
 */

export const PROXY_CONTRACT_VERSION = 'v1';
export const GENERATE_PATH = '/api/generate';
export const HEALTH_PATH = '/api/health';

/**
 * 代理只放行这两个名字，防止被当成任意模型网关滥用。
 * 它们同时是「快 / 强」两档的代号：服务端配了 DeepSeek / Kimi 时换成对应模型（server/providers.ts）。
 */
export const ALLOWED_MODELS = ['gemini-3-flash-preview', 'gemini-3-pro-preview'] as const;
export type AllowedModel = (typeof ALLOWED_MODELS)[number];

/** config 白名单字段；其余字段一律拒绝。 */
export const ALLOWED_CONFIG_KEYS = [
  'systemInstruction',
  'responseMimeType',
  'responseSchema',
  'temperature',
  'thinkingConfig',
] as const;

export const MAX_THINKING_BUDGET = 32768;
/** 代理限流（RATE_LIMITED）时 Retry-After 的秒数，与 wrangler.jsonc 里 ratelimits 的 period 一致。 */
export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

/** 简历 PDF/图片走 base64 inlineData，留足余量。 */
export const MAX_BODY_BYTES = 20 * 1024 * 1024;

export interface ProxyPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface ProxyContent {
  role?: 'user' | 'model';
  parts: ProxyPart[];
}

export interface GenerateConfig {
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: unknown;
  temperature?: number;
  thinkingConfig?: { thinkingBudget?: number };
}

export interface GenerateRequest {
  model: AllowedModel;
  contents: string | ProxyContent[];
  config?: GenerateConfig;
}

export interface GenerateResponse {
  text: string | null;
  /** 实际调用的模型名，例如 deepseek-chat。 */
  model: string;
  /** 实际调用的服务商：gemini | deepseek | kimi。 */
  provider?: string;
}

export type ProxyErrorCode =
  | 'BAD_REQUEST'
  | 'MODEL_NOT_ALLOWED'
  | 'UNSUPPORTED_INPUT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'RESOURCE_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'SERVER_MISCONFIGURED';

export interface ProxyErrorBody {
  error: { code: ProxyErrorCode; message: string };
}
