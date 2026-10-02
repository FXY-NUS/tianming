import {
  EXTENSION_MESSAGE_SOURCE,
  parseAppMessage,
  type CapturedJob,
} from '../../../services/extensionProtocol';
import { PENDING_JOBS_KEY } from '../messages';
import { removeAcked } from '../pendingQueue';

/**
 * 注入到天命页面的桥：把 chrome.storage 里的待送队列用 postMessage 交给 App，
 * 收到 App 的 ack 后出队。页面 JS 拿不到 chrome.storage，所以必须经这一层。
 */

const readQueue = async (): Promise<CapturedJob[]> => {
  const stored = await chrome.storage.local.get(PENDING_JOBS_KEY);
  const queue = stored[PENDING_JOBS_KEY];
  return Array.isArray(queue) ? (queue as CapturedJob[]) : [];
};

let appReady = false;

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
  void (async () => {
    const queue = await readQueue();
    await chrome.storage.local.set({ [PENDING_JOBS_KEY]: removeAcked(queue, message.externalIds) });
  })();
});

// 页面已打开时又抓了新岗位：队列一变就再送一次。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[PENDING_JOBS_KEY]) void deliver();
});
