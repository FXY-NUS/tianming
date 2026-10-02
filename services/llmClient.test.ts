import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateContent, getLlmMode } from './llmClient';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe('llmClient (proxy mode)', () => {
  it('defaults to proxy mode', () => {
    expect(getLlmMode()).toBe('proxy');
  });

  it('posts the request to /api/generate and unwraps text', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ text: 'hi', model: 'gemini-3-flash-preview' }), {
        status: 200,
      }),
    );

    const result = await generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'hello',
      config: { systemInstruction: 'sys' },
    });

    expect(result.text).toBe('hi');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/generate');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      model: 'gemini-3-flash-preview',
      contents: 'hello',
      config: { systemInstruction: 'sys' },
    });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('honours VITE_TIANMING_API_BASE and VITE_TIANMING_PROXY_TOKEN', async () => {
    vi.stubEnv('VITE_TIANMING_API_BASE', 'https://proxy.example/');
    vi.stubEnv('VITE_TIANMING_PROXY_TOKEN', 'tok');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: null, model: 'm' })));

    const result = await generateContent({ model: 'gemini-3-pro-preview', contents: 'x' });

    expect(result.text).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proxy.example/api/generate');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('surfaces proxy error code and message', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'RESOURCE_EXHAUSTED', message: 'Gemini 429: quota' } }),
        { status: 429 },
      ),
    );

    await expect(
      generateContent({ model: 'gemini-3-flash-preview', contents: 'x' }),
    ).rejects.toThrow('Proxy 429 RESOURCE_EXHAUSTED: Gemini 429: quota');
  });
});
