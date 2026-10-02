import type { CapturedJob } from '../../services/extensionProtocol';
import { APP_URL_KEY, appTabPatterns, readAppUrl } from './appUrl';
import { syncBridgeRegistration } from './bridgeRegistration';
import { PENDING_JOBS_KEY, type RuntimeRequest } from './messages';
import { enqueueJob } from './pendingQueue';
import { createAppTabScorer } from './scoring';
import { canShowSidebar, createCopyKitFetcher } from './copyKitFetch';

/**
 * Service worker：收 content script 的消息。
 * - capture：岗位入待送队列（chrome.storage.local），天命页面打开着就会被 bridge 立刻送过去。
 * - triage：交给打开着的天命页面打分（见 scoring.ts），没打开就「未评分」。
 * - open-app：切到已打开的天命标签页，没有就新开一个。
 * - copy-kit：复制侧栏要内容，转给打开着的天命页面（见 copyKitFetch.ts）。
 * 点扩展图标：在投递页上开关复制侧栏（activeTab 授权，只注入用户点图标的那一页）；
 * 在天命页面或注入不了的页面上仍是打开天命。
 * 天命网址可在设置页改（见 appUrl.ts）；改了就把 bridge 重新注册到新网址。
 */

const enqueue = async (job: CapturedJob) => {
  const stored = await chrome.storage.local.get(PENDING_JOBS_KEY);
  const queue = Array.isArray(stored[PENDING_JOBS_KEY])
    ? (stored[PENDING_JOBS_KEY] as CapturedJob[])
    : [];
  await chrome.storage.local.set({ [PENDING_JOBS_KEY]: enqueueJob(queue, job) });
};

/** match pattern 不区分端口，再按来源精确筛一遍，免得切到本机别的端口上的页面。 */
const sameOrigin = (tabUrl: string | undefined, appUrl: string) => {
  if (!tabUrl) return false;
  const tab = new URL(tabUrl);
  const app = new URL(appUrl);
  const host = (hostname: string) => (hostname === '127.0.0.1' ? 'localhost' : hostname);
  return (
    tab.protocol === app.protocol &&
    tab.port === app.port &&
    host(tab.hostname) === host(app.hostname)
  );
};

const findAppTab = async () => {
  const appUrl = await readAppUrl(chrome.storage.local);
  const tabs = await chrome.tabs.query({ url: appTabPatterns(appUrl) });
  return { appUrl, tab: tabs.find((tab) => sameOrigin(tab.url, appUrl)) };
};

const triageScorer = createAppTabScorer({
  findAppTab: async () => (await findAppTab()).tab?.id ?? null,
  sendToTab: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
});

const fetchCopyKit = createCopyKitFetcher({
  findAppTab: async () => (await findAppTab()).tab?.id ?? null,
  sendToTab: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
});

const openApp = async () => {
  const { appUrl, tab: existing } = await findAppTab();
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined)
      await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: appUrl });
};

const syncBridge = async () => {
  const appUrl = await readAppUrl(chrome.storage.local);
  await syncBridgeRegistration(appUrl, {
    scripting: chrome.scripting,
    permissions: chrome.permissions,
  });
};

chrome.runtime.onInstalled.addListener(() => void syncBridge());
chrome.runtime.onStartup.addListener(() => void syncBridge());
chrome.permissions.onAdded.addListener(() => void syncBridge());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[APP_URL_KEY]) void syncBridge();
});

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case 'capture':
        await enqueue(message.job);
        return { ok: true as const };
      case 'triage':
        return { results: await triageScorer.score(message.cards) };
      case 'open-app':
        await openApp();
        return { ok: true as const };
      case 'copy-kit':
        return fetchCopyKit(message.job);
      default:
        return { ok: false as const, error: 'unknown message' };
    }
  };
  handle().then(sendResponse, (error: unknown) =>
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
  return true;
});

const toggleSidebarOrOpenApp = async (tab: chrome.tabs.Tab) => {
  const appUrl = await readAppUrl(chrome.storage.local);
  if (tab.id === undefined || !canShowSidebar(tab.url, (url) => sameOrigin(url, appUrl))) {
    await openApp();
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['copySidebar.js'] });
  } catch {
    // 有些页面（其他扩展的页面、浏览器设置页、PDF 查看器）不让注入，退回打开天命。
    await openApp();
  }
};

chrome.action.onClicked.addListener((tab) => void toggleSidebarOrOpenApp(tab));
