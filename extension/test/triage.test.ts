import { describe, expect, it, vi } from 'vitest';
import type { JobCardSnapshot } from '../../src/core/matchTypes';
import type { ExtensionTriageRequestMessage } from '../../services/extensionProtocol';
import { NO_APP_REASON, createAppTabScorer } from '../src/scoring';
import { createTriageRelay } from '../src/triageRelay';

const card = (id: string): JobCardSnapshot => ({
  id,
  source: 'linkedin',
  title: `Job ${id}`,
  capturedAt: '2026-10-02T00:00:00.000Z',
});

describe('createAppTabScorer', () => {
  it('天命页面没打开：不新开标签页，全部未评分', async () => {
    const sendToTab = vi.fn();
    const scorer = createAppTabScorer({ findAppTab: async () => null, sendToTab });
    const results = await scorer.score([card('1')]);
    expect(results).toEqual([{ id: '1', verdict: 'unscored', reason: NO_APP_REASON }]);
    expect(sendToTab).not.toHaveBeenCalled();
  });

  it('交给天命标签页打分，按卡片顺序回结果，缺的补未评分', async () => {
    const sendToTab = vi.fn(async () => ({ results: [{ id: '2', verdict: 'pass' }] }));
    const scorer = createAppTabScorer({ findAppTab: async () => 7, sendToTab });
    const results = await scorer.score([card('1'), card('2')]);
    expect(sendToTab).toHaveBeenCalledWith(7, { type: 'triage', cards: [card('1'), card('2')] });
    expect(results.map((r) => r.verdict)).toEqual(['unscored', 'pass']);
  });

  it('发消息失败（页面刚关、bridge 没注入）降级为未评分', async () => {
    const scorer = createAppTabScorer({
      findAppTab: async () => 7,
      sendToTab: async () => {
        throw new Error('Receiving end does not exist');
      },
    });
    expect((await scorer.score([card('1')]))[0].verdict).toBe('unscored');
  });
});

describe('createTriageRelay', () => {
  it('按 requestId 把页面的结果交回请求方', async () => {
    const posted: ExtensionTriageRequestMessage[] = [];
    let n = 0;
    const relay = createTriageRelay({ post: (m) => posted.push(m), makeId: () => `r${++n}` });

    const first = relay.request([card('1')]);
    const second = relay.request([card('2')]);
    expect(posted.map((m) => [m.type, m.requestId])).toEqual([
      ['triage-request', 'r1'],
      ['triage-request', 'r2'],
    ]);

    relay.handleResult({
      source: 'tianming-app',
      type: 'triage-result',
      requestId: 'r2',
      results: [{ id: '2', verdict: 'maybe' }],
    });
    relay.handleResult({
      source: 'tianming-app',
      type: 'triage-result',
      requestId: 'r1',
      results: [{ id: '1', verdict: 'reject' }],
    });
    expect(await first).toEqual([{ id: '1', verdict: 'reject' }]);
    expect(await second).toEqual([{ id: '2', verdict: 'maybe' }]);
  });

  it('页面不回就超时返回 null', async () => {
    vi.useFakeTimers();
    const relay = createTriageRelay({ post: () => {}, timeoutMs: 1000 });
    const pending = relay.request([card('1')]);
    vi.advanceTimersByTime(1000);
    expect(await pending).toBeNull();
    vi.useRealTimers();
  });
});
