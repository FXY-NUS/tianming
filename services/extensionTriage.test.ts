import { describe, expect, it, vi } from 'vitest';
import type { Job, UserContext } from '../types';
import type { JobCardSnapshot, MatchLabel, MatchScore } from '../src/core/matchTypes';
import type { BatchScreenJobResult } from './geminiService';
import { DEFAULT_USER_CONTEXT } from './userContextStorage';
import { createCachedTriage, triageCards, verdictForMatch } from './extensionTriage';

const card = (id: string, title = `Engineer ${id}`): JobCardSnapshot => ({
  id,
  source: 'linkedin',
  title,
  company: 'Acme',
  locationText: 'Singapore',
  salaryText: '$8k/month',
  url: `https://www.linkedin.com/jobs/view/${id}/`,
  capturedAt: '2026-10-02T00:00:00.000Z',
});

const matchScore = (label: MatchLabel, hardRejected = false) =>
  ({ label, hardRejected, overall: 70 }) as MatchScore;

const screened = (id: string, label: MatchLabel, score = 70): BatchScreenJobResult =>
  ({ id, score, reason: '技能对得上', matchScore: matchScore(label) }) as BatchScreenJobResult;

describe('verdictForMatch', () => {
  it('引擎档位映射成徽章', () => {
    expect(verdictForMatch(matchScore('strong_fit'))).toBe('pass');
    expect(verdictForMatch(matchScore('good_fit'))).toBe('pass');
    expect(verdictForMatch(matchScore('stretch'))).toBe('maybe');
    expect(verdictForMatch(matchScore('investigate'))).toBe('need_full_jd');
    expect(verdictForMatch(matchScore('low_fit'))).toBe('reject');
    expect(verdictForMatch(matchScore('strong_fit', true))).toBe('reject');
  });
});

describe('triageCards', () => {
  it('卡片转成临时 Job 交给现有初筛，分数由引擎给出，只回档位和理由', async () => {
    const screen = vi.fn(async (jobs: Job[], _ctx: UserContext) => [
      screened(jobs[0].id, 'good_fit', 81.6),
    ]);
    const results = await triageCards([card('1')], DEFAULT_USER_CONTEXT, screen);

    const [jobs, ctx] = screen.mock.calls[0];
    expect(ctx).toBe(DEFAULT_USER_CONTEXT);
    expect(jobs[0]).toMatchObject({ id: '1', title: 'Engineer 1', company: 'Acme' });
    expect(jobs[0].content).toContain('Singapore');
    expect(results).toEqual([{ id: '1', verdict: 'pass', reason: '82 分 · 技能对得上' }]);
  });

  it('漏评的卡片和请求失败都标未评分', async () => {
    const partial = await triageCards([card('1'), card('2')], DEFAULT_USER_CONTEXT, async () => [
      screened('2', 'stretch'),
    ]);
    expect(partial.map((r) => r.verdict)).toEqual(['unscored', 'maybe']);

    const failed = await triageCards([card('1')], DEFAULT_USER_CONTEXT, async () => {
      throw new Error('429');
    });
    expect(failed[0].verdict).toBe('unscored');
  });
});

describe('createCachedTriage', () => {
  it('评过的卡片不再调用；未评分的下次重试', async () => {
    const triage = vi.fn(async (cards: JobCardSnapshot[]) =>
      cards.map((c) => ({
        id: c.id,
        verdict: c.id === '2' ? ('unscored' as const) : ('pass' as const),
      })),
    );
    const cached = createCachedTriage(triage);

    await cached([card('1'), card('2')], DEFAULT_USER_CONTEXT);
    const second = await cached([card('1'), card('2'), card('3')], DEFAULT_USER_CONTEXT);

    expect(triage).toHaveBeenCalledTimes(2);
    expect(triage.mock.calls[1][0].map((c) => c.id)).toEqual(['2', '3']);
    expect(second.map((r) => [r.id, r.verdict])).toEqual([
      ['1', 'pass'],
      ['2', 'unscored'],
      ['3', 'pass'],
    ]);
  });
});
