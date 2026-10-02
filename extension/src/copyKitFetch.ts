import type { CopyKitJob } from '../../services/extensionProtocol';
import type { CopyKitResponse } from './messages';

/**
 * service worker 侧：侧栏要可复制内容时，转给打开着的天命标签页（bridge 再交给页面）。
 * 天命页面没开就回 no-app，不替用户新开标签页；内容不经过 chrome.storage（D6）。
 */

export interface CopyKitFetchDeps {
  findAppTab: () => Promise<number | null>;
  sendToTab: (tabId: number, message: { type: 'copy-kit'; job?: CopyKitJob }) => Promise<unknown>;
}

const isCopyKitResponse = (value: unknown): value is CopyKitResponse => {
  if (!value || typeof value !== 'object') return false;
  const { status, items } = value as { status?: unknown; items?: unknown };
  if (status === 'ok') return Array.isArray(items);
  return status === 'no-app' || status === 'timeout';
};

export const createCopyKitFetcher =
  (deps: CopyKitFetchDeps) =>
  async (job?: CopyKitJob): Promise<CopyKitResponse> => {
    const tabId = await deps.findAppTab();
    if (tabId === null) return { status: 'no-app' };
    try {
      const response = await deps.sendToTab(tabId, { type: 'copy-kit', ...(job ? { job } : {}) });
      return isCopyKitResponse(response) ? response : { status: 'no-app' };
    } catch {
      // 天命标签页里没有 bridge（扩展装好前就打开的页面）时 sendMessage 会抛错。
      return { status: 'no-app' };
    }
  };

/**
 * 点扩展图标时：普通网页（投递页）上开关复制侧栏；天命页面本身、chrome:// 之类注入不了的页面，
 * 仍然是「打开天命」。
 */
export const canShowSidebar = (tabUrl: string | undefined, isAppTab: (url: string) => boolean) => {
  if (!tabUrl) return false;
  let url: URL;
  try {
    url = new URL(tabUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.hostname === 'chromewebstore.google.com') return false;
  return !isAppTab(tabUrl);
};
