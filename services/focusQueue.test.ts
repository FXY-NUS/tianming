import { describe, expect, it } from 'vitest';
import type { Job } from '../types';
import type { MatchScore } from '../src/core/matchTypes';
import { orderFocusQueue, passFocusJob, pickFocusView, UPCOMING_COUNT } from './focusQueue';

const job = (id: string, overrides: Partial<Job> = {}): Job => ({
  chatHistory: [],
  id,
  title: id,
  company: 'Acme',
  url: '',
  content: '',
  salary_text: '',
  status: 'New',
  importedAt: '2026-10-01T00:00:00.000Z',
  tags: [],
  ...overrides,
});

const unknownHeavyScore = (overall: number): MatchScore =>
  ({
    overall,
    dimensions: [
      { key: 'a', confidence: 'unknown' },
      { key: 'b', confidence: 'unknown' },
      { key: 'c', confidence: 'high', score: 90 },
    ],
  }) as unknown as MatchScore;

const ids = (jobs: Job[]) => jobs.map((j) => j.id);

describe('orderFocusQueue', () => {
  it('puts scored cards first by score, then unscored, then low-score cards last', () => {
    const queue = orderFocusQueue([
      job('unscored'),
      job('low', { flashScore: 20, status: 'Screened' }),
      job('mid', { flashScore: 65, status: 'Screened' }),
      job('high', { flashScore: 88, status: 'High Match' }),
    ]);
    expect(ids(queue)).toEqual(['high', 'mid', 'unscored', 'low']);
  });

  it('keeps low-score cards in the queue instead of dropping them', () => {
    expect(ids(orderFocusQueue([job('low', { flashScore: 5 })]))).toEqual(['low']);
  });

  it('treats a high score with mostly unknown dimensions as low priority', () => {
    const queue = orderFocusQueue([
      job('shaky', { flashScore: 95, matchScore: unknownHeavyScore(95) }),
      job('unscored'),
    ]);
    expect(ids(queue)).toEqual(['unscored', 'shaky']);
  });

  it('prefers the deep-audit score over the screening score', () => {
    const queue = orderFocusQueue([
      job('a', { flashScore: 90, analysis: { score: 50 } as Job['analysis'] }),
      job('b', { flashScore: 70 }),
    ]);
    expect(ids(queue)).toEqual(['b', 'a']);
  });

  it('orders unscored cards newest first', () => {
    const queue = orderFocusQueue([
      job('old', { importedAt: '2026-09-01T00:00:00.000Z' }),
      job('new', { importedAt: '2026-10-03T00:00:00.000Z' }),
    ]);
    expect(ids(queue)).toEqual(['new', 'old']);
  });

  it('leaves out applied and rejected jobs', () => {
    const queue = orderFocusQueue([
      job('applied', { status: 'Applied' }),
      job('rejected', { status: 'Rejected' }),
      job('open'),
    ]);
    expect(ids(queue)).toEqual(['open']);
  });

  it('moves passed cards to the back in the order they were passed', () => {
    const jobs = [
      job('a', { flashScore: 90 }),
      job('b', { flashScore: 80 }),
      job('c', { flashScore: 70 }),
    ];
    expect(ids(orderFocusQueue(jobs, ['b', 'a']))).toEqual(['c', 'b', 'a']);
  });
});

describe('pickFocusView', () => {
  const queue = orderFocusQueue(
    Array.from({ length: 7 }, (_, i) => job(`j${i}`, { flashScore: 90 - i })),
  );

  it('shows the head of the queue and previews the next few', () => {
    const view = pickFocusView(queue);
    expect(view.current?.id).toBe('j0');
    expect(ids(view.upcoming)).toEqual(['j1', 'j2', 'j3', 'j4']);
    expect(view.upcoming).toHaveLength(UPCOMING_COUNT);
  });

  it('keeps the card the user is looking at even if it is not first', () => {
    const view = pickFocusView(queue, 'j3');
    expect(view.current?.id).toBe('j3');
    expect(ids(view.upcoming)).toEqual(['j0', 'j1', 'j2', 'j4']);
  });

  it('falls back to the head when the focused card left the queue', () => {
    expect(pickFocusView(queue, 'gone').current?.id).toBe('j0');
  });

  it('is empty when there is nothing to look at', () => {
    expect(pickFocusView([])).toEqual({ current: undefined, upcoming: [] });
  });
});

describe('passFocusJob', () => {
  it('cycles through every card and comes back to the first', () => {
    const jobs = [job('a', { flashScore: 90 }), job('b', { flashScore: 80 })];
    let passed: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const current = pickFocusView(orderFocusQueue(jobs, passed)).current!;
      seen.push(current.id);
      passed = passFocusJob(passed, current.id);
    }
    expect(seen).toEqual(['a', 'b', 'a']);
  });
});
