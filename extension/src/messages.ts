import type { JobCardSnapshot } from '../../src/core/matchTypes';
import type { CapturedJob, CopyKitItem, CopyKitJob } from '../../services/extensionProtocol';
import type { TriageResult } from './scoring';

/** content script → service worker 的消息（chrome.runtime.sendMessage）。 */
export type RuntimeRequest =
  | { type: 'capture'; job: CapturedJob }
  | { type: 'triage'; cards: JobCardSnapshot[] }
  | { type: 'open-app' }
  | { type: 'copy-kit'; job?: CopyKitJob };

export type CaptureResponse = { ok: true } | { ok: false; error: string };
export interface TriageResponse {
  results: TriageResult[];
}

/**
 * 复制侧栏要内容的结果。no-app：天命页面没开（或没装好 bridge）；timeout：页面没回；
 * ok 且 items 为空：天命里还没填投递档案。
 */
export type CopyKitResponse =
  | { status: 'ok'; items: CopyKitItem[] }
  | { status: 'no-app' }
  | { status: 'timeout' };

export type RuntimeResponse = CaptureResponse | TriageResponse | CopyKitResponse;

/** 待送队列在 chrome.storage.local 里的 key。 */
export const PENDING_JOBS_KEY = 'tianming.pendingJobs';
