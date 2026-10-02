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

/** 代理只放行这些模型，防止被当成任意 Gemini 网关滥用。 */
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
  model: string;
}

export type ProxyErrorCode =
  | 'BAD_REQUEST'
  | 'MODEL_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'RESOURCE_EXHAUSTED'
  | 'UPSTREAM_ERROR'
  | 'SERVER_MISCONFIGURED';

export interface ProxyErrorBody {
  error: { code: ProxyErrorCode; message: string };
}
