import type { JobCardSnapshot } from '../../src/core/matchTypes';
import {
  EXTENSION_MESSAGE_SOURCE,
  type AppTriageResultMessage,
  type ExtensionTriageRequestMessage,
  type TriageResult,
} from '../../services/extensionProtocol';

/**
 * bridge 里的粗筛中转：把 service worker 的请求用 postMessage 交给天命页面，按 requestId
 * 等页面回结果。页面迟迟不回（没登录画像、LLM 很慢）就超时返回 null，扩展那边标「未评分」。
 */

/** Flash 初筛 30 张卡片通常十几秒，留足余量。 */
export const TRIAGE_TIMEOUT_MS = 90_000;

export interface TriageRelayDeps {
  post: (message: ExtensionTriageRequestMessage) => void;
  makeId?: () => string;
  timeoutMs?: number;
}

export const createTriageRelay = (deps: TriageRelayDeps) => {
  const makeId = deps.makeId ?? (() => Math.random().toString(36).slice(2));
  const timeoutMs = deps.timeoutMs ?? TRIAGE_TIMEOUT_MS;
  const pending = new Map<string, (results: TriageResult[] | null) => void>();

  return {
    request(cards: JobCardSnapshot[]): Promise<TriageResult[] | null> {
      const requestId = makeId();
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve(null);
        }, timeoutMs);
        pending.set(requestId, (results) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(results);
        });
        deps.post({ source: EXTENSION_MESSAGE_SOURCE, type: 'triage-request', requestId, cards });
      });
    },
    handleResult(message: AppTriageResultMessage) {
      pending.get(message.requestId)?.(message.results);
    },
  };
};
