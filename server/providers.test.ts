import { describe, expect, it } from 'vitest';
import {
  extractOpenAiCompatText,
  resolveProvider,
  toJsonSchema,
  toOpenAiCompatBody,
  TruncatedOutputError,
  UnsupportedInputError,
} from './providers';

const deepseek = resolveProvider(
  { LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'k' },
  'gemini-3-flash-preview',
)!;
const kimi = resolveProvider({ LLM_PROVIDER: 'kimi', KIMI_API_KEY: 'k' }, 'gemini-3-pro-preview')!;

describe('resolveProvider', () => {
  it('defaults to Gemini and keeps the requested model', () => {
    const p = resolveProvider({ GEMINI_API_KEY: 'g' }, 'gemini-3-pro-preview')!;
    expect(p).toMatchObject({ id: 'gemini', apiKey: 'g', model: 'gemini-3-pro-preview' });
  });

  it('maps flash / pro to the fast / strong tier of the chosen provider', () => {
    expect(deepseek).toMatchObject({ id: 'deepseek', model: 'deepseek-chat', apiKey: 'k' });
    expect(kimi.baseUrl).toBe('https://api.moonshot.cn/v1');
    const overridden = resolveProvider(
      { LLM_PROVIDER: 'deepseek', LLM_MODEL_FAST: 'a', LLM_MODEL_STRONG: 'b' },
      'gemini-3-pro-preview',
    );
    expect(overridden?.model).toBe('b');
  });

  it('returns null for an unknown provider', () => {
    expect(resolveProvider({ LLM_PROVIDER: 'openai' }, 'gemini-3-flash-preview')).toBeNull();
  });
});

describe('toJsonSchema', () => {
  it('lowercases Gemini Type values recursively, including property names that look like keys', () => {
    expect(
      toJsonSchema({
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING' },
          tags: { type: 'ARRAY', items: { type: 'STRING' } },
          note: { type: 'STRING', nullable: true },
        },
        required: ['type'],
        propertyOrdering: ['type', 'tags'],
      }),
    ).toEqual({
      type: 'object',
      properties: {
        type: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        note: { type: ['string', 'null'] },
      },
      required: ['type'],
    });
  });
});

describe('toOpenAiCompatBody', () => {
  it('puts system instruction and JSON schema into the system message', () => {
    const { body, unwrapArray } = toOpenAiCompatBody(
      {
        model: 'gemini-3-flash-preview',
        contents: 'jd',
        config: {
          systemInstruction: 'sys',
          responseMimeType: 'application/json',
          responseSchema: { type: 'OBJECT', properties: { a: { type: 'STRING' } } },
          thinkingConfig: { thinkingBudget: 100 },
        },
      },
      deepseek,
    );
    expect(unwrapArray).toBe(false);
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toMatch(/^sys\n\n/);
    expect(messages[0].content).toContain('"properties":{"a":{"type":"string"}}');
    expect(messages[0].content).toContain('JSON');
    expect(body).not.toHaveProperty('thinkingConfig');
    expect(body.max_tokens).toBe(8192);
  });

  it('wraps array schemas under "items" and maps model role to assistant', () => {
    const { body, unwrapArray } = toOpenAiCompatBody(
      {
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: 'q' }, { text: 'more' }] },
          { role: 'model', parts: [{ text: 'a' }] },
        ],
        config: { responseMimeType: 'application/json', responseSchema: { type: 'ARRAY' } },
      },
      deepseek,
    );
    expect(unwrapArray).toBe(true);
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain('"required":["items"]');
    expect(messages.slice(1)).toEqual([
      { role: 'user', content: 'q\nmore' },
      { role: 'assistant', content: 'a' },
    ]);
  });

  it('clamps temperature to what Kimi accepts and omits JSON mode for plain text', () => {
    const { body } = toOpenAiCompatBody(
      { model: 'gemini-3-pro-preview', contents: 'hi', config: { temperature: 1.5 } },
      kimi,
    );
    expect(body.temperature).toBe(1);
    expect(body).not.toHaveProperty('response_format');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('refuses inline files', () => {
    expect(() =>
      toOpenAiCompatBody(
        {
          model: 'gemini-3-pro-preview',
          contents: [{ parts: [{ inlineData: { mimeType: 'application/pdf', data: 'x' } }] }],
        },
        kimi,
      ),
    ).toThrow(UnsupportedInputError);
  });
});

describe('extractOpenAiCompatText', () => {
  it('returns the first answer, unwrapping arrays when asked', () => {
    const data = (content: string) => ({ choices: [{ message: { content } }] });
    expect(extractOpenAiCompatText(data('plain'), false)).toBe('plain');
    expect(extractOpenAiCompatText(data('{"items":[1,2]}'), true)).toBe('[1,2]');
    expect(extractOpenAiCompatText(data('```json\n[3]\n```'), true)).toBe('[3]');
    expect(extractOpenAiCompatText(data('not json'), true)).toBe('not json');
    expect(extractOpenAiCompatText({}, false)).toBeNull();
  });

  it('throws on truncated output instead of returning half a JSON', () => {
    expect(() =>
      extractOpenAiCompatText(
        { choices: [{ message: { content: '{' }, finish_reason: 'length' }] },
        false,
      ),
    ).toThrow(TruncatedOutputError);
  });
});
