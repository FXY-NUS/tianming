import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExtensionImport } from './useExtensionImport';

const capturedJob = (externalId: string, title: string, company = 'Acme') => ({
  externalId,
  source: 'linkedin' as const,
  title,
  company,
  url: `https://www.linkedin.com/jobs/view/${externalId}/`,
  content: `${title} body`,
  locationText: 'Singapore',
  salaryText: '',
  workMode: 'Hybrid',
  capturedAt: '2026-10-02T00:00:00.000Z',
});

const dispatchFromExtension = (jobs: unknown[]) =>
  act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        origin: window.location.origin,
        data: { source: 'tianming-extension', type: 'jobs', jobs },
      }),
    );
    await Promise.resolve();
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useExtensionImport', () => {
  it('announces ready, hands over valid jobs and acks every delivered id', async () => {
    const posted: unknown[] = [];
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      posted.push(message);
    });
    const onJobs = vi.fn();

    renderHook(() => useExtensionImport({ ready: true, onJobs }));
    expect(posted).toEqual([{ source: 'tianming-app', type: 'ready' }]);

    await dispatchFromExtension([
      capturedJob('1', 'Data Analyst'),
      capturedJob('2', 'Product Manager Intern', 'Beta'),
      { externalId: 'broken' },
    ]);

    expect(onJobs).toHaveBeenCalledTimes(1);
    expect(onJobs.mock.calls[0][0].map((job: { externalId: string }) => job.externalId)).toEqual([
      '1',
      '2',
    ]);
    expect(posted[1]).toEqual({ source: 'tianming-app', type: 'ack', externalIds: ['1', '2'] });
  });

  it('ignores messages that are not from the extension', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const onJobs = vi.fn();
    renderHook(() => useExtensionImport({ ready: true, onJobs }));
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: { source: 'react-devtools', type: 'jobs', jobs: [capturedJob('1', 'X')] },
        }),
      );
    });
    expect(onJobs).not.toHaveBeenCalled();
  });

  it('does nothing until storage is ready', async () => {
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const onJobs = vi.fn();
    renderHook(() => useExtensionImport({ ready: false, onJobs }));
    await dispatchFromExtension([capturedJob('1', 'Data Analyst')]);
    expect(postMessage).not.toHaveBeenCalled();
    expect(onJobs).not.toHaveBeenCalled();
  });
});
