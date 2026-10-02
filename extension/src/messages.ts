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
