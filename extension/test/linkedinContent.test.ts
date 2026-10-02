import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BADGE_CLASS } from '../src/badge';
import { CAPTURE_BUTTON_ID, startLinkedInContent } from '../src/content/linkedinContent';
import type { RuntimeRequest } from '../src/messages';

const SEARCH_URL = 'https://www.linkedin.com/jobs/search/?currentJobId=4001';

const start = (overrides: Partial<Parameters<typeof startLinkedInContent>[0]> = {}) => {
  document.body.innerHTML = readFileSync(
    resolve(__dirname, 'fixtures', 'linkedin-search.html'),
    'utf8',
  );
  const sent: RuntimeRequest[] = [];
  const send = vi.fn(async (message: RuntimeRequest) => {
    sent.push(message);
    if (message.type === 'triage') {
      return {
        results: message.cards.map((card) => ({
          id: card.id,
          verdict: card.id === '4001' ? 'pass' : 'unscored',
        })),
      };
    }
    return { ok: true };
  });
  const url = { current: SEARCH_URL };
  const controller = startLinkedInContent({
    doc: document,
    getUrl: () => url.current,
    send,
    createIntersectionObserver: null,
    rescanDelayMs: 0,
    triageBatchDelayMs: 0,
    ...overrides,
  });
  return { controller, sent, send, url };
};

const badges = () =>
  Array.from(document.querySelectorAll<HTMLElement>(`.${BADGE_CLASS}`)).map((badge) => ({
    jobId: badge.closest('[data-occludable-job-id]')?.getAttribute('data-occludable-job-id'),
    state: badge.dataset.state,
  }));

const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 5));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('startLinkedInContent · cards', () => {
  it('badges every loaded card and sends one triage batch', async () => {
    const { controller, sent } = start();
    expect(badges()).toEqual([
      { jobId: '4001', state: 'pending' },
      { jobId: '4002', state: 'pending' },
    ]);

    await controller.flushTriage();
    expect(sent.filter((m) => m.type === 'triage')).toHaveLength(1);
    expect(badges()).toEqual([
      { jobId: '4001', state: 'pass' },
      { jobId: '4002', state: 'unscored' },
    ]);
    controller.stop();
  });

  it('falls back to unscored when the triage call fails', async () => {
    const { controller } = start({
      send: vi.fn(async () => {
        throw new Error('no worker');
      }),
    });
    await controller.flushTriage();
    expect(badges().map((b) => b.state)).toEqual(['unscored', 'unscored']);
    controller.stop();
  });

  it('picks up a placeholder card once its content renders', async () => {
    const { controller } = start();
    await controller.flushTriage();
    const placeholder = document.querySelector('[data-job-id="4003"]')!;
    placeholder.innerHTML =
      '<a class="job-card-list__title--link" href="/jobs/view/4003/"><strong>Late Card</strong></a>';
    await flushTimers();
    expect(badges().map((b) => b.jobId)).toEqual(['4001', '4002', '4003']);
    controller.stop();
  });
});

describe('startLinkedInContent · detail capture', () => {
  it('inserts the capture button and sends the opened job on click', async () => {
    const { controller, sent } = start();
    const button = document.getElementById(CAPTURE_BUTTON_ID) as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.dataset.jobId).toBe('4001');
    expect(document.querySelector('.jobs-search__job-details--wrapper')?.firstChild).toBe(button);

    button.click();
    await flushTimers();
    const capture = sent.find((m) => m.type === 'capture');
    expect(capture?.type === 'capture' && capture.job).toMatchObject({
      externalId: '4001',
      title: 'Data Analyst',
      company: 'Acme Analytics',
    });
    expect(button.dataset.state).toBe('sent');

    button.click();
    expect(sent.at(-1)).toEqual({ type: 'open-app' });
    controller.stop();
  });

  it('does not capture when the URL points at a job whose details are not rendered', async () => {
    const { controller, sent, url } = start();
    url.current = 'https://www.linkedin.com/jobs/search/?currentJobId=4002';
    controller.rescan();
    const button = document.getElementById(CAPTURE_BUTTON_ID) as HTMLButtonElement;
    expect(button.dataset.jobId).toBe('4002');

    button.click();
    await flushTimers();
    expect(sent.some((m) => m.type === 'capture')).toBe(false);
    expect(button.dataset.state).toBe('notReady');
    controller.stop();
  });

  it('removes the button when no job is open', () => {
    const { controller, url } = start();
    url.current = 'https://www.linkedin.com/jobs/search/?keywords=data';
    controller.rescan();
    expect(document.getElementById(CAPTURE_BUTTON_ID)).toBeNull();
    controller.stop();
  });
});
