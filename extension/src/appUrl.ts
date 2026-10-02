/**
 * 天命 Web App 的地址。默认值在构建时注入（环境变量 TIANMING_APP_URL，缺省本地开发版），
 * 用户也可以在扩展设置页改成部署后的网址，存在 chrome.storage.local 里，优先于默认值。
 */

declare const __TIANMING_APP_URL__: string | undefined;

const FALLBACK_APP_URL = 'http://localhost:3000/';

/** chrome.storage.local 里用户自填网址的 key。 */
export const APP_URL_KEY = 'tianming.appUrl';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * 规范成「来源 + /」。只接受 https，或本机的 http（开发用）；其余返回 null。
 * 路径、查询、hash 一律丢掉：bridge 按来源注入，整个站点都算天命页面。
 */
export const normalizeAppUrl = (input: string | null | undefined): string | null => {
  const raw = input?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const secure = url.protocol === 'https:';
  const local = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (!secure && !local) return null;
  return `${url.origin}/`;
};

export const DEFAULT_APP_URL =
  normalizeAppUrl(typeof __TIANMING_APP_URL__ === 'string' ? __TIANMING_APP_URL__ : '') ??
  FALLBACK_APP_URL;

/** Chrome match pattern。match pattern 不支持端口，host 相同就匹配（端口不同也会注入，bridge 只和本页通信，无害）。 */
export const originPattern = (appUrl: string) => {
  const url = new URL(appUrl);
  return `${url.protocol}//${url.hostname}/*`;
};

/** tabs.query 用的 pattern；本地默认值额外认 127.0.0.1。 */
export const appTabPatterns = (appUrl: string): string[] => {
  const url = new URL(appUrl);
  const patterns = [originPattern(appUrl)];
  if (url.hostname === 'localhost') patterns.push(`${url.protocol}//127.0.0.1/*`);
  return patterns;
};

export const isDefaultAppUrl = (appUrl: string) => appUrl === DEFAULT_APP_URL;

/** 读当前生效的天命网址：用户自填的优先，否则构建时默认值。 */
export const readAppUrl = async (storage: chrome.storage.StorageArea): Promise<string> => {
  const stored = await storage.get(APP_URL_KEY);
  return normalizeAppUrl(stored[APP_URL_KEY] as string | undefined) ?? DEFAULT_APP_URL;
};
