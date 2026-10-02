import { describe, expect, it, vi } from 'vitest';
import {
  extractText,
  handleProxyRequest,
  toGeminiRestBody,
  type FetchLike,
  type RateLimiter,
} from './handler';

const env = { GEMINI_API_KEY: 'server-secret-key' };

const post = (body: unknown, headers: Record<string, string> = {}, url = 'http://proxy.test') =>
  new Request(`${url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const validBody = {
  model: 'gemini-3-flash-preview',
  contents: 'hello',
  config: { systemInstruction: 'be brief', responseMimeType: 'application/json' },
};

const geminiOk = (text: string) =>
  vi.fn<FetchLike>(
    async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
        status: 200,
      }),
  );

describe('handleProxyRequest', () => {
  it('answers the health check', async () => {
    const res = await handleProxyRequest(new Request('http://proxy.test/api/health'), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 'v1' });
  });

  it('forwards a valid request to Gemini with the server key and returns the text', async () => {
    const fetchMock = geminiOk('{"ok":true}');
    const res = await handleProxyRequest(post(validBody), env, fetchMock);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: '{"ok":true}', model: 'gemini-3-flash-preview' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
    );
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('server-secret-key');
    expect(JSON.parse(init!.body as string)).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      systemInstruction: { parts: [{ text: 'be brief' }] },
      generationConfig: { responseMimeType: 'application/json' },
    });
  });

  it('never leaks the key into the response', async () => {
    const res = await handleProxyRequest(post(validBody), env, geminiOk('x'));
    const raw = await res.text();
    expect(raw).not.toContain('server-secret-key');
  });

  it('rejects models outside the allow list', async () => {
    const fetchMock = geminiOk('x');
    const res = await handleProxyRequest(
      post({ ...validBody, model: 'gemini-2.0-pro' }),
      env,
      fetchMock,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('MODEL_NOT_ALLOWED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unknown config keys and oversized thinking budgets', async () => {
    const fetchMock = geminiOk('x');
    const badKey = await handleProxyRequest(
      post({ ...validBody, config: { tools: [] } }),
      env,
      fetchMock,
    );
    expect(badKey.status).toBe(400);

    const badBudget = await handleProxyRequest(
      post({ ...validBody, config: { thinkingConfig: { thinkingBudget: 999999 } } }),
      env,
      fetchMock,
    );
    expect(badBudget.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed bodies', async () => {
    expect((await handleProxyRequest(post('not json'), env)).status).toBe(400);
    expect((await handleProxyRequest(post({ model: 'gemini-3-flash-preview' }), env)).status).toBe(
      400,
    );
    expect(
      (
        await handleProxyRequest(
          post({ model: 'gemini-3-flash-preview', contents: [{ parts: [{ nope: 1 }] }] }),
          env,
        )
      ).status,
    ).toBe(400);
  });

  it('accepts multimodal inlineData contents', async () => {
    const fetchMock = geminiOk('parsed');
    const res = await handleProxyRequest(
      post({
        model: 'gemini-3-pro-preview',
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: 'application/pdf', data: 'QUJD' } }, { text: 'go' }],
          },
        ],
      }),
      env,
      fetchMock,
    );
    expect(res.status).toBe(200);
  });

  it('fails loudly when the key is missing on the server', async () => {
    const res = await handleProxyRequest(post(validBody), {});
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('SERVER_MISCONFIGURED');
  });

  it('maps upstream 429 to RESOURCE_EXHAUSTED and other errors to UPSTREAM_ERROR', async () => {
    const quota = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { message: 'quota', status: 'RESOURCE_EXHAUSTED' } }),
          {
            status: 429,
          },
        ),
    );
    const res429 = await handleProxyRequest(post(validBody), env, quota);
    expect(res429.status).toBe(429);
    expect((await res429.json()).error.code).toBe('RESOURCE_EXHAUSTED');

    const boom = vi.fn<FetchLike>(
      async () => new Response('{"error":{"message":"bad"}}', { status: 500 }),
    );
    const res502 = await handleProxyRequest(post(validBody), env, boom);
    expect(res502.status).toBe(502);
    expect((await res502.json()).error.code).toBe('UPSTREAM_ERROR');
  });

  it('enforces the bearer token when PROXY_TOKEN is set', async () => {
    const guarded = { ...env, PROXY_TOKEN: 'shh' };
    const denied = await handleProxyRequest(post(validBody), guarded, geminiOk('x'));
    expect(denied.status).toBe(401);

    const allowed = await handleProxyRequest(
      post(validBody, { Authorization: 'Bearer shh' }),
      guarded,
      geminiOk('x'),
    );
    expect(allowed.status).toBe(200);
  });

  it('handles CORS: same origin and allow-listed origins pass, others are refused', async () => {
    const corsEnv = { ...env, ALLOWED_ORIGINS: 'chrome-extension://abc, https://app.example' };

    const ext = await handleProxyRequest(
      post(validBody, { Origin: 'chrome-extension://abc' }),
      corsEnv,
      geminiOk('x'),
    );
    expect(ext.status).toBe(200);
    expect(ext.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://abc');

    const preflight = await handleProxyRequest(
      new Request('http://proxy.test/api/generate', {
        method: 'OPTIONS',
        headers: { Origin: 'https://app.example' },
      }),
      corsEnv,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');

    const same = await handleProxyRequest(
      post(validBody, { Origin: 'http://proxy.test' }),
      env,
      geminiOk('x'),
    );
    expect(same.status).toBe(200);

    const stranger = await handleProxyRequest(
      post(validBody, { Origin: 'https://evil.example' }),
      corsEnv,
      geminiOk('x'),
    );
    expect(stranger.status).toBe(403);
    expect(stranger.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns 404 / 405 for unknown routes and methods', async () => {
    expect((await handleProxyRequest(new Request('http://proxy.test/nope'), env)).status).toBe(404);
    expect(
      (await handleProxyRequest(new Request('http://proxy.test/api/generate'), env)).status,
    ).toBe(405);
  });
});

describe('rate limiting', () => {
  /** 假的 Cloudflare 限流绑定：每个 key 前 `limit` 次放行，之后拒绝。 */
  const fakeLimiter = (limit: number) => {
    const counts = new Map<string, number>();
    return {
      limit: vi.fn<RateLimiter['limit']>(async ({ key }) => {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return { success: next <= limit };
      }),
    };
  };

  const fromIp = (ip: string, headers: Record<string, string> = {}) =>
    post(validBody, { 'CF-Connecting-IP': ip, ...headers });

  it('returns 429 RATE_LIMITED with Retry-After once an IP goes over the limit', async () => {
    const limiter = fakeLimiter(2);
    const fetchMock = geminiOk('x');
    const limitedEnv = { ...env, RATE_LIMITER: limiter };

    expect((await handleProxyRequest(fromIp('1.1.1.1'), limitedEnv, fetchMock)).status).toBe(200);
    expect((await handleProxyRequest(fromIp('1.1.1.1'), limitedEnv, fetchMock)).status).toBe(200);
    const blocked = await handleProxyRequest(fromIp('1.1.1.1'), limitedEnv, fetchMock);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
    const body = await blocked.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toMatch(/Retry in 60 seconds/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(limiter.limit).toHaveBeenLastCalledWith({ key: 'ip:1.1.1.1' });
  });

  it('counts each IP separately', async () => {
    const limitedEnv = { ...env, RATE_LIMITER: fakeLimiter(1) };
    expect((await handleProxyRequest(fromIp('1.1.1.1'), limitedEnv, geminiOk('x'))).status).toBe(
      200,
    );
    expect((await handleProxyRequest(fromIp('2.2.2.2'), limitedEnv, geminiOk('x'))).status).toBe(
      200,
    );
    expect((await handleProxyRequest(fromIp('1.1.1.1'), limitedEnv, geminiOk('x'))).status).toBe(
      429,
    );
  });

  it('limits before checking the token, so token guessing is throttled too', async () => {
    const limitedEnv = { ...env, PROXY_TOKEN: 'secret', RATE_LIMITER: fakeLimiter(1) };
    const wrong = { Authorization: 'Bearer guess' };
    expect((await handleProxyRequest(fromIp('3.3.3.3', wrong), limitedEnv)).status).toBe(401);
    expect((await handleProxyRequest(fromIp('3.3.3.3', wrong), limitedEnv)).status).toBe(429);
  });

  it('keeps CORS headers on a 429 so the extension can read the error', async () => {
    const limitedEnv = {
      ...env,
      ALLOWED_ORIGINS: 'chrome-extension://abc',
      RATE_LIMITER: fakeLimiter(0),
    };
    const res = await handleProxyRequest(
      fromIp('4.4.4.4', { Origin: 'chrome-extension://abc' }),
      limitedEnv,
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://abc');
  });

  it('does not count health checks or CORS preflights', async () => {
    const limiter = fakeLimiter(0);
    const limitedEnv = { ...env, RATE_LIMITER: limiter };
    const health = await handleProxyRequest(
      new Request('http://proxy.test/api/health'),
      limitedEnv,
    );
    const preflight = await handleProxyRequest(
      new Request('http://proxy.test/api/generate', { method: 'OPTIONS' }),
      limitedEnv,
    );
    expect(health.status).toBe(200);
    expect(preflight.status).toBe(204);
    expect(limiter.limit).not.toHaveBeenCalled();
  });

  it('lets requests through when the limiter itself fails', async () => {
    const broken: RateLimiter = {
      limit: async () => {
        throw new Error('limiter down');
      },
    };
    const res = await handleProxyRequest(
      fromIp('5.5.5.5'),
      { ...env, RATE_LIMITER: broken },
      geminiOk('x'),
    );
    expect(res.status).toBe(200);
  });

  it('does not limit when no binding is configured (local dev)', async () => {
    const fetchMock = geminiOk('x');
    for (let i = 0; i < 5; i += 1) {
      expect((await handleProxyRequest(fromIp('6.6.6.6'), env, fetchMock)).status).toBe(200);
    }
  });
});

describe('toGeminiRestBody / extractText', () => {
  it('defaults content role to user and drops systemInstruction from generationConfig', () => {
    const body = toGeminiRestBody({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: 'a' }] }],
      config: { systemInstruction: 'sys', temperature: 0.1 },
    });
    expect(body).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'a' }] }],
      systemInstruction: { parts: [{ text: 'sys' }] },
      generationConfig: { temperature: 0.1 },
    });
  });

  it('skips thought parts and returns null when there is no text', () => {
    expect(
      extractText({
        candidates: [
          { content: { parts: [{ text: 'thinking', thought: true }, { text: 'answer' }] } },
        ],
      }),
    ).toBe('answer');
    expect(extractText({ candidates: [] })).toBeNull();
    expect(extractText({})).toBeNull();
  });
});
