import {
  EXTENSION_MESSAGE_SOURCE,
  type AppCopyKitResultMessage,
  type CopyKitItem,
  type CopyKitJob,
  type ExtensionCopyKitRequestMessage,
} from '../../services/extensionProtocol';

/**
 * bridge 里的复制内容中转：侧栏要内容 → postMessage 交给天命页面 → 按 requestId 等结果。
 * 拼内容只读本地数据、不调 LLM，正常瞬间就回；超时说明页面卡住或版本太旧，返回 null。
 */

export const COPY_KIT_TIMEOUT_MS = 5_000;

export interface CopyKitRelayDeps {
  post: (message: ExtensionCopyKitRequestMessage) => void;
  makeId?: () => string;
  timeoutMs?: number;
}

export const createCopyKitRelay = (deps: CopyKitRelayDeps) => {
  const makeId = deps.makeId ?? (() => Math.random().toString(36).slice(2));
  const timeoutMs = deps.timeoutMs ?? COPY_KIT_TIMEOUT_MS;
  const pending = new Map<string, (items: CopyKitItem[] | null) => void>();

  return {
    request(job?: CopyKitJob): Promise<CopyKitItem[] | null> {
      const requestId = makeId();
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve(null);
        }, timeoutMs);
        pending.set(requestId, (items) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(items);
        });
        deps.post({
          source: EXTENSION_MESSAGE_SOURCE,
          type: 'copy-kit-request',
          requestId,
          ...(job ? { job } : {}),
        });
      });
    },
    handleResult(message: AppCopyKitResultMessage) {
      pending.get(message.requestId)?.(message.items);
    },
  };
};
