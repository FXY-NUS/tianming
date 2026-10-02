import type { JobCardSnapshot } from '../../src/core/matchTypes';
import type { CapturedJob } from '../../services/extensionProtocol';
import type { TriageResult } from './scoring';

/** content script → service worker 的消息（chrome.runtime.sendMessage）。 */
export type RuntimeRequest =
  | { type: 'capture'; job: CapturedJob }
  | { type: 'triage'; cards: JobCardSnapshot[] }
  | { type: 'open-app' };

export type CaptureResponse = { ok: true } | { ok: false; error: string };
export interface TriageResponse {
  results: TriageResult[];
}

export type RuntimeResponse = CaptureResponse | TriageResponse;

/** 待送队列在 chrome.storage.local 里的 key。 */
export const PENDING_JOBS_KEY = 'tianming.pendingJobs';

/** 天命 Web App 的地址。现在只有本地开发版；部署上线后在这里加正式域名（manifest 同步改）。 */
export const APP_URL = 'http://localhost:3000/';
export const APP_URL_PATTERNS = ['http://localhost:3000/*', 'http://127.0.0.1:3000/*'];
