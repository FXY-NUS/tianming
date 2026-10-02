import { APP_URL_KEY, DEFAULT_APP_URL, normalizeAppUrl, originPattern } from '../appUrl';

export interface SaveAppUrlDeps {
  storage: Pick<chrome.storage.StorageArea, 'set' | 'remove'>;
  /** 必须在用户点击里调用（Chrome 只在用户手势里弹授权框）。 */
  requestPermission: (origins: string[]) => Promise<boolean>;
}

export type SaveAppUrlResult =
  | { kind: 'saved'; appUrl: string }
  | { kind: 'reset'; appUrl: string }
  | { kind: 'invalid' }
  | { kind: 'denied' };

/** 设置页「保存」：留空或填默认网址 = 恢复默认；否则校验、申请该站点权限、存起来。 */
export const saveAppUrl = async (
  input: string,
  deps: SaveAppUrlDeps,
): Promise<SaveAppUrlResult> => {
  if (!input.trim()) {
    await deps.storage.remove(APP_URL_KEY);
    return { kind: 'reset', appUrl: DEFAULT_APP_URL };
  }
  const appUrl = normalizeAppUrl(input);
  if (!appUrl) return { kind: 'invalid' };
  if (appUrl === DEFAULT_APP_URL) {
    await deps.storage.remove(APP_URL_KEY);
    return { kind: 'reset', appUrl };
  }
  if (!(await deps.requestPermission([originPattern(appUrl)]))) return { kind: 'denied' };
  await deps.storage.set({ [APP_URL_KEY]: appUrl });
  return { kind: 'saved', appUrl };
};
