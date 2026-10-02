import { describe, expect, it } from 'vitest';
import { parseAppMessage, parseExtensionMessage } from './extensionProtocol';

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
