/**
 * 浏览器扩展 ↔ Web App 的消息协议（两边共用这一份定义）。
 *
 * 链路：LinkedIn content script 抽 JD → service worker 存进 chrome.storage.local 待送队列 →
 * 天命页面上的 bridge content script 用 window.postMessage 交给 App → App 入库后回 ack →
 * bridge 把已确认的条目移出队列。扩展全程不碰 Gemini（D5），也不碰用户画像（D6）。
 *
 * 卡片粗筛：扩展把卡片快照经 bridge 交给打开着的天命页面（triage-request），App 用自己的
 * 用户画像走现有初筛（LLM 抽证据、代码算分），只把档位和一句理由回给扩展（triage-result）。
 * 画像和分数明细都不出 Web App。
 */

import type { JobCardSnapshot } from '../src/core/matchTypes';

/** 扩展抽到的一条岗位，字段与 JobImportInput 对齐，额外带站点自己的岗位 ID 用来确认收货。 */
export interface CapturedJob {
  /** 站点岗位 ID，如 LinkedIn 的 jobId；队列去重和 ack 都靠它。 */
  externalId: string;
  source: 'linkedin';
  title: string;
  company: string;
  url: string;
  content: string;
  locationText: string;
  salaryText: string;
  workMode: string;
  capturedAt: string;
}

/** 卡片徽章档位。unscored = 没评上（天命页面没开、评分失败等）。 */
export type TriageVerdict = 'pass' | 'maybe' | 'reject' | 'need_full_jd' | 'unscored';

export interface TriageResult {
  id: string;
  verdict: TriageVerdict;
  reason?: string;
}

const TRIAGE_VERDICTS: readonly TriageVerdict[] = [
  'pass',
  'maybe',
  'reject',
  'need_full_jd',
  'unscored',
];

/** 一次最多送这么多张卡片去评分，和天命「批量初筛」的 30 份上限对齐。 */
export const MAX_TRIAGE_CARDS = 30;

export const EXTENSION_MESSAGE_SOURCE = 'tianming-extension';
export const APP_MESSAGE_SOURCE = 'tianming-app';

/** bridge → App：把队列里的岗位交给页面。 */
export interface ExtensionJobsMessage {
  source: typeof EXTENSION_MESSAGE_SOURCE;
  type: 'jobs';
  jobs: CapturedJob[];
}

/** bridge → App：请 App 给这些卡片做粗筛。 */
export interface ExtensionTriageRequestMessage {
  source: typeof EXTENSION_MESSAGE_SOURCE;
  type: 'triage-request';
  requestId: string;
  cards: JobCardSnapshot[];
}

export type ExtensionMessage = ExtensionJobsMessage | ExtensionTriageRequestMessage;

/** App → bridge：粗筛结果，只有档位和一句理由。 */
export interface AppTriageResultMessage {
  source: typeof APP_MESSAGE_SOURCE;
  type: 'triage-result';
  requestId: string;
  results: TriageResult[];
}

/** App → bridge：App 存储就绪，可以收货了（bridge 可能比 App 先加载）。 */
export interface AppReadyMessage {
  source: typeof APP_MESSAGE_SOURCE;
  type: 'ready';
}

/** App → bridge：这些岗位已入库（含判定为重复的），可以出队。 */
export interface AppAckMessage {
  source: typeof APP_MESSAGE_SOURCE;
  type: 'ack';
  externalIds: string[];
}

export type AppMessage = AppReadyMessage | AppAckMessage | AppTriageResultMessage;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const STRING_FIELDS = [
  'externalId',
  'title',
  'company',
  'url',
  'content',
  'locationText',
  'salaryText',
  'workMode',
  'capturedAt',
] as const;

export const isCapturedJob = (value: unknown): value is CapturedJob =>
  isRecord(value) &&
  value.source === 'linkedin' &&
  STRING_FIELDS.every((field) => typeof value[field] === 'string') &&
  (value.externalId as string).length > 0;

/** 解析页面收到的 postMessage；不是扩展发来的或结构不对都返回 null。不合法的单条岗位直接丢弃。 */
export const parseExtensionMessage = (data: unknown): ExtensionJobsMessage | null => {
  if (!isRecord(data) || data.source !== EXTENSION_MESSAGE_SOURCE || data.type !== 'jobs') {
    return null;
  }
  if (!Array.isArray(data.jobs)) return null;
  return { source: EXTENSION_MESSAGE_SOURCE, type: 'jobs', jobs: data.jobs.filter(isCapturedJob) };
};

const isCardSnapshot = (value: unknown): value is JobCardSnapshot =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  value.id.length > 0 &&
  typeof value.title === 'string' &&
  typeof value.source === 'string' &&
  typeof value.capturedAt === 'string' &&
  (['company', 'locationText', 'salaryText', 'snippet', 'url'] as const).every(
    (field) => value[field] === undefined || typeof value[field] === 'string',
  );

/** 解析 bridge 发来的粗筛请求；不合法的卡片丢弃，超过上限的截断。 */
export const parseTriageRequest = (data: unknown): ExtensionTriageRequestMessage | null => {
  if (!isRecord(data) || data.source !== EXTENSION_MESSAGE_SOURCE) return null;
  if (data.type !== 'triage-request' || typeof data.requestId !== 'string') return null;
  if (!Array.isArray(data.cards)) return null;
  return {
    source: EXTENSION_MESSAGE_SOURCE,
    type: 'triage-request',
    requestId: data.requestId,
    cards: data.cards.filter(isCardSnapshot).slice(0, MAX_TRIAGE_CARDS),
  };
};

const isTriageResult = (value: unknown): value is TriageResult =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  TRIAGE_VERDICTS.includes(value.verdict as TriageVerdict) &&
  (value.reason === undefined || typeof value.reason === 'string');

export const parseAppMessage = (data: unknown): AppMessage | null => {
  if (!isRecord(data) || data.source !== APP_MESSAGE_SOURCE) return null;
  if (data.type === 'ready') return { source: APP_MESSAGE_SOURCE, type: 'ready' };
  if (data.type === 'ack' && Array.isArray(data.externalIds)) {
    return {
      source: APP_MESSAGE_SOURCE,
      type: 'ack',
      externalIds: data.externalIds.filter((id): id is string => typeof id === 'string'),
    };
  }
  if (data.type === 'triage-result' && typeof data.requestId === 'string') {
    return {
      source: APP_MESSAGE_SOURCE,
      type: 'triage-result',
      requestId: data.requestId,
      results: Array.isArray(data.results) ? data.results.filter(isTriageResult) : [],
    };
  }
  return null;
};
