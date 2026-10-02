import { describe, expect, it } from 'vitest';
import {
  MAX_TRIAGE_CARDS,
  parseAppMessage,
  parseExtensionMessage,
  parseTriageRequest,
} from './extensionProtocol';

const validJob = {
  externalId: '4001',
  source: 'linkedin',
  title: 'Data Analyst',
  company: 'Acme',
  url: 'https://www.linkedin.com/jobs/view/4001/',
  content: 'body',
  locationText: '',
  salaryText: '',
  workMode: '',
  capturedAt: '2026-10-02T00:00:00.000Z',
};

describe('parseExtensionMessage', () => {
  it('accepts a jobs message and drops malformed entries', () => {
    const message = parseExtensionMessage({
      source: 'tianming-extension',
      type: 'jobs',
      jobs: [validJob, { ...validJob, externalId: '' }, { title: 'no source' }, 'junk'],
    });
    expect(message?.jobs).toEqual([validJob]);
  });

  it('ignores messages from other senders or of other types', () => {
    expect(parseExtensionMessage({ source: 'react-devtools', type: 'jobs', jobs: [] })).toBeNull();
    expect(parseExtensionMessage({ source: 'tianming-extension', type: 'ping' })).toBeNull();
    expect(parseExtensionMessage(null)).toBeNull();
  });
});

describe('parseAppMessage', () => {
  it('parses ready and ack', () => {
    expect(parseAppMessage({ source: 'tianming-app', type: 'ready' })).toEqual({
      source: 'tianming-app',
      type: 'ready',
    });
    expect(
      parseAppMessage({ source: 'tianming-app', type: 'ack', externalIds: ['1', 2, '3'] }),
    ).toEqual({ source: 'tianming-app', type: 'ack', externalIds: ['1', '3'] });
  });

  it('rejects unknown shapes', () => {
    expect(parseAppMessage({ source: 'tianming-app', type: 'ack' })).toBeNull();
    expect(parseAppMessage({ source: 'other', type: 'ready' })).toBeNull();
  });
});

describe('triage messages', () => {
  const card = (id: string) => ({
    id,
    source: 'linkedin',
    title: `Job ${id}`,
    capturedAt: '2026-10-02T00:00:00.000Z',
  });

  it('parses a triage request, drops malformed cards and caps the batch', () => {
    const cards = [card('1'), { id: '', title: 'x' }, { ...card('2'), company: 42 }];
    for (let i = 3; i < MAX_TRIAGE_CARDS + 10; i += 1) cards.push(card(String(i)));
    const parsed = parseTriageRequest({
      source: 'tianming-extension',
      type: 'triage-request',
      requestId: 'r1',
      cards,
    });
    expect(parsed?.requestId).toBe('r1');
    expect(parsed?.cards).toHaveLength(MAX_TRIAGE_CARDS);
    expect(parsed?.cards[0].id).toBe('1');
    expect(parsed?.cards.some((c) => c.id === '2' || c.id === '')).toBe(false);
    expect(parseTriageRequest({ source: 'tianming-app', type: 'triage-request' })).toBeNull();
  });

  it('parses triage results and keeps only known verdicts', () => {
    expect(
      parseAppMessage({
        source: 'tianming-app',
        type: 'triage-result',
        requestId: 'r1',
        results: [
          { id: '1', verdict: 'pass', reason: '82 分' },
          { id: '2', verdict: 'great' },
          { id: '3', verdict: 'maybe', reason: 7 },
        ],
      }),
    ).toEqual({
      source: 'tianming-app',
      type: 'triage-result',
      requestId: 'r1',
      results: [{ id: '1', verdict: 'pass', reason: '82 分' }],
    });
  });
});
