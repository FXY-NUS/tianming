import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type WorkerEnv } from './worker';

const assets = () => ({
  fetch: vi.fn(async (request: Request) => new Response(`asset:${new URL(request.url).pathname}`)),
});

describe('worker routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serves the web app from ASSETS for non-API paths', async () => {
    const env: WorkerEnv = { ASSETS: assets() };
    const res = await worker.fetch(new Request('https://tianming.test/jobs/42'), env);
    expect(await res.text()).toBe('asset:/jobs/42');
  });

  it('sends /api/* to the proxy handler, never to ASSETS', async () => {
    const env: WorkerEnv = { ASSETS: assets() };
    const res = await worker.fetch(new Request('https://tianming.test/api/health'), env);
    expect(await res.json()).toEqual({ ok: true, version: 'v1', provider: 'gemini' });
    expect(env.ASSETS!.fetch).not.toHaveBeenCalled();
  });

  it('passes the rate limit binding through to the handler', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const env: WorkerEnv = {
      GEMINI_API_KEY: 'k',
      RATE_LIMITER: { limit: async () => ({ success: false }) },
    };
    const res = await worker.fetch(
      new Request('https://tianming.test/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '9.9.9.9' },
        body: JSON.stringify({ model: 'gemini-3-flash-preview', contents: 'hi' }),
      }),
      env,
    );
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
