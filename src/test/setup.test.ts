import { describe, it, expect } from 'vitest';

describe('test runner sanity check', () => {
  it('runs Vitest with jsdom + Zod available', async () => {
    expect(typeof document).toBe('object');
    const { z } = await import('zod');
    const schema = z.object({ ok: z.boolean() });
    expect(schema.parse({ ok: true })).toEqual({ ok: true });
  });
});
