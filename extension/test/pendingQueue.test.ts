import { describe, expect, it } from 'vitest';
import type { CapturedJob } from '../../services/extensionProtocol';
import { MAX_PENDING_JOBS, enqueueJob, removeAcked } from '../src/pendingQueue';

const job = (externalId: string, content = 'body'): CapturedJob => ({
  externalId,
  source: 'linkedin',
  title: `Job ${externalId}`,
  company: 'Acme',
  url: `https://www.linkedin.com/jobs/view/${externalId}/`,
  content,
  locationText: '',
  salaryText: '',
  workMode: '',
  capturedAt: '2026-10-02T00:00:00.000Z',
});

describe('pendingQueue', () => {
  it('replaces an existing entry for the same job and moves it last', () => {
    const queue = enqueueJob([job('1', 'old'), job('2')], job('1', 'new'));
    expect(queue.map((j) => j.externalId)).toEqual(['2', '1']);
    expect(queue[1].content).toBe('new');
  });

  it('caps the queue by dropping the oldest entries', () => {
    let queue: CapturedJob[] = [];
    for (let i = 0; i < MAX_PENDING_JOBS + 3; i += 1) queue = enqueueJob(queue, job(String(i)));
    expect(queue).toHaveLength(MAX_PENDING_JOBS);
    expect(queue[0].externalId).toBe('3');
  });

  it('removes acked jobs only', () => {
    const queue = removeAcked([job('1'), job('2'), job('3')], ['1', '3', 'missing']);
    expect(queue.map((j) => j.externalId)).toEqual(['2']);
  });
});
