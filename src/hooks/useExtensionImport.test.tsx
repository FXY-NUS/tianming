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

  it('answers triage requests with the handler results under the same requestId', async () => {
    const posted: unknown[] = [];
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      posted.push(message);
    });
    const onTriage = vi.fn(async (cards: { id: string }[]) =>
      cards.map((card) => ({ id: card.id, verdict: 'pass' as const })),
    );
    renderHook(() => useExtensionImport({ ready: true, onJobs: vi.fn(), onTriage }));
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            source: 'tianming-extension',
            type: 'triage-request',
            requestId: 'r1',
            cards: [
              { id: '9', source: 'linkedin', title: 'X', capturedAt: '2026-10-02T00:00:00.000Z' },
            ],
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onTriage).toHaveBeenCalledTimes(1);
    expect(posted.at(-1)).toEqual({
      source: 'tianming-app',
      type: 'triage-result',
      requestId: 'r1',
      results: [{ id: '9', verdict: 'pass' }],
    });
  });

  it('answers copy kit requests with the handler items, passing the job through', async () => {
    const posted: unknown[] = [];
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      posted.push(message);
    });
    const items = [
      { id: 'profile.email', group: 'profile' as const, label: 'Email', value: 'a@b.c' },
    ];
    const onCopyKit = vi.fn(() => items);
    renderHook(() => useExtensionImport({ ready: true, onJobs: vi.fn(), onCopyKit }));
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            source: 'tianming-extension',
            type: 'copy-kit-request',
            requestId: 'c1',
            job: { title: 'Analyst', company: 'Acme' },
          },
        }),
      );
      await Promise.resolve();
    });
    expect(onCopyKit).toHaveBeenCalledWith({ title: 'Analyst', company: 'Acme' });
    expect(posted.at(-1)).toEqual({
      source: 'tianming-app',
      type: 'copy-kit-result',
      requestId: 'c1',
      items,
    });
  });
});
