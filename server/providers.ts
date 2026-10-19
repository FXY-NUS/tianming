/**
 * 代理背后用哪家模型由服务端配置决定（LLM_PROVIDER + 对应 Key），前端和扩展不感知。
 * 前端仍按契约传 gemini-3-flash-preview / gemini-3-pro-preview，代理把它们当作「快 / 强」两档，
 * 换成所选服务商的模型名。DeepSeek、Kimi 走兼容 OpenAI 的 /chat/completions。
 * 只换模型，不碰评分：LLM 照旧只抽证据，分数由代码算。
 */
import type { AllowedModel, GenerateRequest, ProxyContent } from './contract';

export const PROVIDER_IDS = ['gemini', 'deepseek', 'kimi'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ModelTier = 'fast' | 'strong';

export interface ProviderEnv {
  /** gemini（缺省）| deepseek | kimi */
  LLM_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  KIMI_API_KEY?: string;
  /** 覆盖「快」档模型名（初筛、对话、JD 证据抽取）。 */
  LLM_MODEL_FAST?: string;
  /** 覆盖「强」档模型名（深审、简历解析）。 */
  LLM_MODEL_STRONG?: string;
  /** 覆盖兼容 OpenAI 服务商的接口地址，例如 Kimi 国际站 https://api.moonshot.ai/v1。 */
  LLM_BASE_URL?: string;
}

interface ProviderPreset {
  keyVar: 'GEMINI_API_KEY' | 'DEEPSEEK_API_KEY' | 'KIMI_API_KEY';
  baseUrl: string;
  models: Record<ModelTier, string>;
  /** 服务商接受的 temperature 上限。 */
  maxTemperature: number;
}

const PRESETS: Record<ProviderId, ProviderPreset> = {
  gemini: {
    keyVar: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: { fast: 'gemini-3-flash-preview', strong: 'gemini-3-pro-preview' },
    maxTemperature: 2,
  },
  deepseek: {
    keyVar: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    models: { fast: 'deepseek-chat', strong: 'deepseek-chat' },
    maxTemperature: 2,
  },
  kimi: {
    keyVar: 'KIMI_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: { fast: 'kimi-k2-0905-preview', strong: 'kimi-k2-0905-preview' },
    maxTemperature: 1,
  },
};

/** 兼容 OpenAI 的服务商单次输出上限；Kimi 不设时默认很短，深审会被截断。 */
export const OPENAI_COMPAT_MAX_TOKENS = 8192;

export interface ResolvedProvider {
  id: ProviderId;
  apiKey: string | undefined;
  keyVar: ProviderPreset['keyVar'];
  baseUrl: string;
  model: string;
  maxTemperature: number;
}

export const tierOf = (model: AllowedModel): ModelTier =>
  model === 'gemini-3-pro-preview' ? 'strong' : 'fast';

/** 不认识的 LLM_PROVIDER 返回 null，由调用方报 SERVER_MISCONFIGURED。 */
export function resolveProvider(env: ProviderEnv, model: AllowedModel): ResolvedProvider | null {
  const raw = (env.LLM_PROVIDER ?? '').trim().toLowerCase() || 'gemini';
  if (!(PROVIDER_IDS as readonly string[]).includes(raw)) return null;
  const id = raw as ProviderId;
  const preset = PRESETS[id];
  const tier = tierOf(model);
  const override = tier === 'fast' ? env.LLM_MODEL_FAST : env.LLM_MODEL_STRONG;
  return {
    id,
    apiKey: env[preset.keyVar],
    keyVar: preset.keyVar,
    baseUrl: (env.LLM_BASE_URL?.trim() || preset.baseUrl).replace(/\/$/, ''),
    model: override?.trim() || preset.models[tier],
    maxTemperature: preset.maxTemperature,
  };
}

// ── Gemini responseSchema → JSON Schema ──────────────────────────────────────

/** @google/genai 的 Type 枚举是大写字符串（'OBJECT'），转成 JSON Schema 的小写类型。 */
export function toJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (typeof schema !== 'object' || schema === null) return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && typeof value === 'string') out.type = value.toLowerCase();
    else if (key === 'properties' && typeof value === 'object' && value !== null) {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, sub]) => [name, toJsonSchema(sub)]),
      );
    } else if (key === 'propertyOrdering' || key === 'nullable') continue;
    else out[key] = toJsonSchema(value);
  }
  if ((schema as Record<string, unknown>).nullable === true && typeof out.type === 'string') {
    out.type = [out.type, 'null'];
  }
  return out;
}

/** JSON 模式只保证顶层是对象，数组结果包一层再在代理里拆掉。 */
export const ARRAY_WRAPPER_KEY = 'items';

const isArraySchema = (schema: unknown) =>
  typeof schema === 'object' &&
  schema !== null &&
  String((schema as Record<string, unknown>).type).toUpperCase() === 'ARRAY';

// ── 契约请求 → OpenAI chat/completions 请求体 ─────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class UnsupportedInputError extends Error {}

function partsToText(content: ProxyContent, providerId: ProviderId): string {
  return content.parts
    .map((part) => {
      if (part.inlineData) {
        throw new UnsupportedInputError(
          `${providerId} 不接受文件或图片输入（${part.inlineData.mimeType}），请先转成文字再发送`,
        );
      }
      return part.text ?? '';
    })
    .join('\n');
}

export interface OpenAiCompatBody {
  body: Record<string, unknown>;
  /** 代理是否需要把 {"items": [...]} 拆回数组。 */
  unwrapArray: boolean;
}

export function toOpenAiCompatBody(
  req: GenerateRequest,
  provider: ResolvedProvider,
): OpenAiCompatBody {
  const config = req.config ?? {};
  const wantsJson = config.responseMimeType === 'application/json';
  const unwrapArray = wantsJson && isArraySchema(config.responseSchema);

  const systemParts: string[] = [];
  if (config.systemInstruction) systemParts.push(config.systemInstruction);
  if (wantsJson) {
    const schema = toJsonSchema(config.responseSchema);
    const target = unwrapArray
      ? {
          type: 'object',
          properties: { [ARRAY_WRAPPER_KEY]: schema },
          required: [ARRAY_WRAPPER_KEY],
        }
      : schema;
    systemParts.push(
      [
        '输出格式要求：只输出一个合法的 JSON 对象，不要输出 Markdown 代码块或任何其他文字。',
        unwrapArray ? `结果数组放在顶层字段 "${ARRAY_WRAPPER_KEY}" 里。` : '',
        target ? `JSON 必须符合下面的 JSON Schema：\n${JSON.stringify(target)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  const messages: ChatMessage[] = [];
  if (systemParts.length > 0) messages.push({ role: 'system', content: systemParts.join('\n\n') });
  if (typeof req.contents === 'string') {
    messages.push({ role: 'user', content: req.contents });
  } else {
    for (const content of req.contents) {
      messages.push({
        role: content.role === 'model' ? 'assistant' : 'user',
        content: partsToText(content, provider.id),
      });
    }
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    max_tokens: OPENAI_COMPAT_MAX_TOKENS,
  };
  if (wantsJson) body.response_format = { type: 'json_object' };
  if (typeof config.temperature === 'number') {
    body.temperature = Math.min(config.temperature, provider.maxTemperature);
  }
  // thinkingConfig 是 Gemini 专属，其它服务商直接忽略。
  return { body, unwrapArray };
}

interface OpenAiCompatResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  error?: { message?: string; type?: string };
}

export class TruncatedOutputError extends Error {}

/** 取首个回答的文本；需要时把 {"items": [...]} 拆回数组文本。 */
export function extractOpenAiCompatText(
  data: OpenAiCompatResponse,
  unwrapArray: boolean,
): string | null {
  const choice = data.choices?.[0];
  const text = choice?.message?.content ?? null;
  if (choice?.finish_reason === 'length') {
    throw new TruncatedOutputError('模型输出超过长度上限被截断');
  }
  if (!text || !unwrapArray) return text;
  try {
    const parsed: unknown = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed)) return JSON.stringify(parsed);
    if (typeof parsed === 'object' && parsed !== null) {
      const inner = (parsed as Record<string, unknown>)[ARRAY_WRAPPER_KEY];
      if (Array.isArray(inner)) return JSON.stringify(inner);
    }
  } catch {
    // 原样返回，交给前端的解析失败分支处理。
  }
  return text;
}
