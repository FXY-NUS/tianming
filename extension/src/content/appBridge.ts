import {
  EXTENSION_MESSAGE_SOURCE,
  parseAppMessage,
  type CapturedJob,
} from '../../../services/extensionProtocol';
import { PENDING_JOBS_KEY } from '../messages';
import { removeAcked } from '../pendingQueue';
import { unscoredResults, NO_APP_REASON } from '../scoring';
import { createTriageRelay } from '../triageRelay';
import { createCopyKitRelay } from '../copyKitRelay';
import type { CopyKitResponse } from '../messages';
import type { JobCardSnapshot } from '../../../src/core/matchTypes';
import type { CopyKitJob } from '../../../services/extensionProtocol';

/**
 * 注入到天命页面的桥：把 chrome.storage 里的待送队列用 postMessage 交给 App，
 * 收到 App 的 ack 后出队。页面 JS 拿不到 chrome.storage，所以必须经这一层。
 * 卡片粗筛也走这里：service worker 发来卡片 → 交给页面打分 → 结果回给 service worker。
 * 投递页复制侧栏同理：service worker 转来请求 → 页面拼好可复制内容 → 原路回给侧栏。
 */

const readQueue = async (): Promise<CapturedJob[]> => {
  const stored = await chrome.storage.local.get(PENDING_JOBS_KEY);
  const queue = stored[PENDING_JOBS_KEY];
  return Array.isArray(queue) ? (queue as CapturedJob[]) : [];
};

let appReady = false;

const triageRelay = createTriageRelay({
  post: (message) => window.postMessage(message, location.origin),
});

const copyKitRelay = createCopyKitRelay({
  post: (message) => window.postMessage(message, location.origin),
});

const deliver = async () => {
  if (!appReady) return;
  const jobs = await readQueue();
  if (!jobs.length) return;
  window.postMessage({ source: EXTENSION_MESSAGE_SOURCE, type: 'jobs', jobs }, location.origin);
};

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const message = parseAppMessage(event.data);
  if (!message) return;
  if (message.type === 'ready') {
    appReady = true;
    void deliver();
    return;
  }
  if (message.type === 'triage-result') {
    triageRelay.handleResult(message);
    return;
  }
  if (message.type === 'copy-kit-result') {
    copyKitRelay.handleResult(message);
    return;
  }
  void (async () => {
    const queue = await readQueue();
    await chrome.storage.local.set({ [PENDING_JOBS_KEY]: removeAcked(queue, message.externalIds) });
  })();
});

// 页面已打开时又抓了新岗位：队列一变就再送一次。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[PENDING_JOBS_KEY]) void deliver();
});

chrome.runtime.onMessage.addListener(
  (message: { type?: string; job?: CopyKitJob }, _sender, sendResponse) => {
    if (message?.type !== 'copy-kit') return false;
    if (!appReady) {
      sendResponse({ status: 'no-app' } satisfies CopyKitResponse);
      return false;
    }
    void copyKitRelay
      .request(message.job)
      .then((items) =>
        sendResponse(
          (items ? { status: 'ok', items } : { status: 'timeout' }) satisfies CopyKitResponse,
        ),
      );
    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: { type?: string; cards?: JobCardSnapshot[] }, _sender, sendResponse) => {
    if (message?.type !== 'triage' || !Array.isArray(message.cards)) return false;
    const cards = message.cards;
    if (!appReady) {
      sendResponse({ results: unscoredResults(cards, NO_APP_REASON) });
      return false;
    }
    void triageRelay.request(cards).then((results) =>
      sendResponse({
        results: results ?? unscoredResults(cards, '评分超时，刷新 LinkedIn 页面可重试'),
      }),
    );
    return true;
  },
);
