import type { RuntimeRequest } from '../messages';
import { startLinkedInContent } from './linkedinContent';

const send = (message: RuntimeRequest) => chrome.runtime.sendMessage(message);

const controller = startLinkedInContent({
  doc: document,
  getUrl: () => location.href,
  send,
  createIntersectionObserver:
    typeof IntersectionObserver === 'undefined'
      ? null
      : (callback) => new IntersectionObserver(callback, { threshold: 0.2 }),
});

// LinkedIn 是 SPA，点卡片只改 URL 不整页刷新；URL 变了就重扫一次。
let lastUrl = location.href;
setInterval(() => {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  controller.rescan();
}, 500);
