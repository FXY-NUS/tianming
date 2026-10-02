import { describe, expect, it, vi } from 'vitest';
import { syncBridgeRegistration, BRIDGE_SCRIPT_ID } from '../src/bridgeRegistration';
import {
  APP_URL_KEY,
  DEFAULT_APP_URL,
  appTabPatterns,
  normalizeAppUrl,
  originPattern,
  readAppUrl,
} from '../src/appUrl';
import { saveAppUrl } from '../src/options/saveAppUrl';

const memoryStorage = (initial: Record<string, unknown> = {}) => {
  const data = { ...initial };
  return {
    data,
    get: vi.fn(async (key: string) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => void Object.assign(data, items)),
    remove: vi.fn(async (key: string) => void delete data[key]),
  };
};

describe('normalizeAppUrl', () => {
  it('只留来源，补 https', () => {
    expect(normalizeAppUrl('https://tianming.example.workers.dev/jobs?x=1#a')).toBe(
      'https://tianming.example.workers.dev/',
    );
    expect(normalizeAppUrl('  tianming.example.com ')).toBe('https://tianming.example.com/');
  });

  it('本机 http 可以，其他 http 和怪协议都不行', () => {
    expect(normalizeAppUrl('http://localhost:3000/')).toBe('http://localhost:3000/');
    expect(normalizeAppUrl('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173/');
    expect(normalizeAppUrl('http://tianming.example.com')).toBeNull();
    expect(normalizeAppUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeAppUrl('https://user:pw@tianming.example.com')).toBeNull();
    expect(normalizeAppUrl('')).toBeNull();
  });

  it('构建时没传网址就用本地开发版', () => {
    expect(DEFAULT_APP_URL).toBe('http://localhost:3000/');
  });
});

describe('match pattern', () => {
  it('不带端口，localhost 额外认 127.0.0.1', () => {
    expect(originPattern('https://tianming.example.com/')).toBe('https://tianming.example.com/*');
    expect(appTabPatterns('http://localhost:3000/')).toEqual([
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
  });
});

describe('readAppUrl', () => {
  it('用户填过就用用户的，否则默认值；存坏了也回到默认值', async () => {
    expect(await readAppUrl(memoryStorage() as never)).toBe(DEFAULT_APP_URL);
    expect(
      await readAppUrl(memoryStorage({ [APP_URL_KEY]: 'https://tianming.example.com/' }) as never),
    ).toBe('https://tianming.example.com/');
    expect(await readAppUrl(memoryStorage({ [APP_URL_KEY]: 'http://evil.com' }) as never)).toBe(
      DEFAULT_APP_URL,
    );
  });
});

describe('saveAppUrl', () => {
  it('合法网址：先申请该站点权限，同意后才保存', async () => {
    const storage = memoryStorage();
    const requestPermission = vi.fn(async () => true);
    const result = await saveAppUrl('https://tianming.example.com/app', {
      storage,
      requestPermission,
    });
    expect(result).toEqual({ kind: 'saved', appUrl: 'https://tianming.example.com/' });
    expect(requestPermission).toHaveBeenCalledWith(['https://tianming.example.com/*']);
    expect(storage.data[APP_URL_KEY]).toBe('https://tianming.example.com/');
  });

  it('用户拒绝授权就不保存', async () => {
    const storage = memoryStorage();
    const result = await saveAppUrl('https://tianming.example.com', {
      storage,
      requestPermission: async () => false,
    });
    expect(result).toEqual({ kind: 'denied' });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('留空或填默认网址 = 恢复默认，不弹授权', async () => {
    const storage = memoryStorage({ [APP_URL_KEY]: 'https://tianming.example.com/' });
    const requestPermission = vi.fn(async () => true);
    expect(await saveAppUrl('  ', { storage, requestPermission })).toEqual({
      kind: 'reset',
      appUrl: DEFAULT_APP_URL,
    });
    expect(await saveAppUrl('http://localhost:3000', { storage, requestPermission })).toEqual({
      kind: 'reset',
      appUrl: DEFAULT_APP_URL,
    });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(APP_URL_KEY in storage.data).toBe(false);
  });

  it('非法网址直接拒绝', async () => {
    const requestPermission = vi.fn(async () => true);
    expect(
      await saveAppUrl('http://tianming.example.com', {
        storage: memoryStorage(),
        requestPermission,
      }),
    ).toEqual({ kind: 'invalid' });
    expect(requestPermission).not.toHaveBeenCalled();
  });
});

describe('syncBridgeRegistration', () => {
  const makeDeps = (registered: boolean, granted: boolean) => ({
    scripting: {
      getRegisteredContentScripts: vi.fn(async () =>
        registered ? [{ id: BRIDGE_SCRIPT_ID, js: ['appBridge.js'] }] : [],
      ),
      registerContentScripts: vi.fn(async () => undefined),
      unregisterContentScripts: vi.fn(async () => undefined),
    },
    permissions: { contains: vi.fn(async () => granted) },
  });

  it('自填网址且已授权：注册 bridge 到该站点', async () => {
    const deps = makeDeps(false, true);
    expect(await syncBridgeRegistration('https://tianming.example.com/', deps as never)).toBe(
      'registered',
    );
    expect(deps.scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: BRIDGE_SCRIPT_ID,
        matches: ['https://tianming.example.com/*'],
        js: ['appBridge.js'],
      }),
    ]);
  });

  it('换网址时先注销旧的；没授权就不注册', async () => {
    const deps = makeDeps(true, false);
    expect(await syncBridgeRegistration('https://other.example.com/', deps as never)).toBe(
      'missing-permission',
    );
    expect(deps.scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: [BRIDGE_SCRIPT_ID],
    });
    expect(deps.scripting.registerContentScripts).not.toHaveBeenCalled();
  });

  it('默认网址走 manifest 里的静态注入，不动态注册', async () => {
    const deps = makeDeps(true, true);
    expect(await syncBridgeRegistration(DEFAULT_APP_URL, deps as never)).toBe('default');
    expect(deps.scripting.registerContentScripts).not.toHaveBeenCalled();
  });
});
