import { isDefaultAppUrl, originPattern } from './appUrl';

/**
 * 用户在设置页填了部署后的天命网址时，把 appBridge 动态注册到那个站点。
 * 默认网址（构建时注入）已经写在 manifest 的 content_scripts 里，不需要动态注册。
 * 动态注册要先拿到该站点的 host 权限（optional_host_permissions，设置页点保存时申请）。
 */

export const BRIDGE_SCRIPT_ID = 'tianming-app-bridge';

export interface BridgeRegistrationDeps {
  scripting: Pick<
    typeof chrome.scripting,
    'getRegisteredContentScripts' | 'registerContentScripts' | 'unregisterContentScripts'
  >;
  permissions: Pick<typeof chrome.permissions, 'contains'>;
}

export type BridgeRegistrationResult = 'default' | 'registered' | 'missing-permission';

export const syncBridgeRegistration = async (
  appUrl: string,
  deps: BridgeRegistrationDeps,
): Promise<BridgeRegistrationResult> => {
  const existing = await deps.scripting.getRegisteredContentScripts({ ids: [BRIDGE_SCRIPT_ID] });
  if (existing.length) await deps.scripting.unregisterContentScripts({ ids: [BRIDGE_SCRIPT_ID] });
  if (isDefaultAppUrl(appUrl)) return 'default';

  const pattern = originPattern(appUrl);
  if (!(await deps.permissions.contains({ origins: [pattern] }))) return 'missing-permission';
  await deps.scripting.registerContentScripts([
    {
      id: BRIDGE_SCRIPT_ID,
      matches: [pattern],
      js: ['appBridge.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
    },
  ]);
  return 'registered';
};
