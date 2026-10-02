/**
 * 前端唯一的 LLM 调用入口。默认走后端代理（D9：Key 只在服务端）；
 * 只有构建时显式设 VITE_LLM_MODE=byok 才在浏览器里用用户自带的 Key 直连（开发/BYOK 模式）。
 */
import type { GenerateContentParameters } from '@google/genai';
import {
  GENERATE_PATH,
  type GenerateRequest,
  type GenerateResponse,
  type ProxyErrorBody,
} from '../server/contract';

export type LlmMode = 'proxy' | 'byok';

export interface LlmGenerateRequest {
  model: GenerateRequest['model'];
  contents: GenerateContentParameters['contents'];
  config?: GenerateContentParameters['config'];
}

export interface LlmGenerateResult {
  text: string | undefined;
}

// 逐个字段写全 import.meta.env.VITE_*，让 Vite 只内联这几个值，不把整个 env 对象打进 bundle。
export const getLlmMode = (): LlmMode =>
  import.meta.env.VITE_LLM_MODE === 'byok' ? 'byok' : 'proxy';

export async function generateContent(req: LlmGenerateRequest): Promise<LlmGenerateResult> {
  return getLlmMode() === 'byok' ? generateDirect(req) : generateViaProxy(req);
}

async function generateViaProxy(req: LlmGenerateRequest): Promise<LlmGenerateResult> {
  const base = (import.meta.env.VITE_TIANMING_API_BASE ?? '').replace(/\/$/, '');
  const token = import.meta.env.VITE_TIANMING_PROXY_TOKEN;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${base}${GENERATE_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });

  const data = (await response.json().catch(() => null)) as
    | GenerateResponse
    | ProxyErrorBody
    | null;

  if (!response.ok || !data || 'error' in data) {
    const code = data && 'error' in data ? data.error.code : 'UPSTREAM_ERROR';
    const message = data && 'error' in data ? data.error.message : response.statusText;
    throw new Error(`Proxy ${response.status} ${code}: ${message}`);
  }

  return { text: data.text ?? undefined };
}

async function generateDirect(req: LlmGenerateRequest): Promise<LlmGenerateResult> {
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey ?? '' });
  const response = await ai.models.generateContent(req);
  return { text: response.text };
}
