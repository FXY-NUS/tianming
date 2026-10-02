import type { CapturedJob } from '../../services/extensionProtocol';
import { APP_URL, APP_URL_PATTERNS, PENDING_JOBS_KEY, type RuntimeRequest } from './messages';
import { enqueueJob } from './pendingQueue';
import { getTriageScorer } from './scoring';

/**
 * Service worker：收 content script 的消息。
 * - capture：岗位入待送队列（chrome.storage.local），天命页面打开着就会被 bridge 立刻送过去。
 * - triage：转给评分适配层（代理接好前一律「未评分」）。
 * - open-app：切到已打开的天命标签页，没有就新开一个。
 */

const enqueue = async (job: CapturedJob) => {
  const stored = await chrome.storage.local.get(PENDING_JOBS_KEY);
  const queue = Array.isArray(stored[PENDING_JOBS_KEY])
    ? (stored[PENDING_JOBS_KEY] as CapturedJob[])
    : [];
  await chrome.storage.local.set({ [PENDING_JOBS_KEY]: enqueueJob(queue, job) });
};

const openApp = async () => {
  const [existing] = await chrome.tabs.query({ url: APP_URL_PATTERNS });
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined)
      await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: APP_URL });
};

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case 'capture':
        await enqueue(message.job);
        return { ok: true as const };
      case 'triage':
        return { results: await getTriageScorer().score(message.cards) };
      case 'open-app':
        await openApp();
        return { ok: true as const };
      default:
        return { ok: false as const, error: 'unknown message' };
    }
  };
  handle().then(sendResponse, (error: unknown) =>
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
  return true;
});

chrome.action.onClicked.addListener(() => void openApp());
