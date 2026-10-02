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
 *
 * 投递页复制侧栏（Phase 6.5 / D11 L3）：用户在投递页点开侧栏时，扩展经 bridge 向打开着的
 * 天命页面要一份「可复制内容」（copy-kit-request），App 用投递档案、已存回答和当前简历拼好
 * 回给扩展（copy-kit-result）。内容只在侧栏打开期间留在内存里，不进 chrome.storage（D6）；
 * 扩展只负责「点按钮复制」，粘贴和提交都由用户自己做（D11：不 autofill、不自动提交）。
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

/**
 * 卡片徽章档位。unscored = 没评上（天命页面没开、评分失败等）；
 * retry_later = 被限流（代理 429），扩展过一会儿自动补评一次。
 */
export type TriageVerdict =
  | 'pass'
  | 'maybe'
  | 'reject'
  | 'need_full_jd'
  | 'unscored'
  | 'retry_later';

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
  'retry_later',
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

/** 侧栏所在投递页对应的岗位（能认出来时才有），App 用它拼邮件正文。 */
export interface CopyKitJob {
  title: string;
  company: string;
}

/** bridge → App：侧栏打开了，请给一份可复制内容。 */
export interface ExtensionCopyKitRequestMessage {
  source: typeof EXTENSION_MESSAGE_SOURCE;
  type: 'copy-kit-request';
  requestId: string;
  job?: CopyKitJob;
}

export type ExtensionMessage =
  | ExtensionJobsMessage
  | ExtensionTriageRequestMessage
  | ExtensionCopyKitRequestMessage;

/** 侧栏分组：投递档案字段 / 简历要点 / 已存回答 / 邮件正文。 */
export type CopyKitGroup = 'profile' | 'resume' | 'answers' | 'email';

export interface CopyKitItem {
  id: string;
  group: CopyKitGroup;
  label: string;
  value: string;
}

/** App → bridge：可复制内容。items 为空说明还没填投递档案。 */
export interface AppCopyKitResultMessage {
  source: typeof APP_MESSAGE_SOURCE;
  type: 'copy-kit-result';
  requestId: string;
  items: CopyKitItem[];
}

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

export type AppMessage =
  | AppReadyMessage
  | AppAckMessage
  | AppTriageResultMessage
  | AppCopyKitResultMessage;

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

/** 侧栏一次最多显示这么多条，单条最长这么多字，防止异常数据把页面撑爆。 */
export const MAX_COPY_KIT_ITEMS = 60;
export const MAX_COPY_KIT_VALUE_LENGTH = 8_000;

const COPY_KIT_GROUPS: readonly CopyKitGroup[] = ['profile', 'resume', 'answers', 'email'];

const isCopyKitJob = (value: unknown): value is CopyKitJob =>
  isRecord(value) && typeof value.title === 'string' && typeof value.company === 'string';

/** 解析 bridge 发来的复制内容请求；岗位信息不合法就当没有。 */
export const parseCopyKitRequest = (data: unknown): ExtensionCopyKitRequestMessage | null => {
  if (!isRecord(data) || data.source !== EXTENSION_MESSAGE_SOURCE) return null;
  if (data.type !== 'copy-kit-request' || typeof data.requestId !== 'string') return null;
  const job = isCopyKitJob(data.job) && data.job.title.trim() ? data.job : undefined;
  return {
    source: EXTENSION_MESSAGE_SOURCE,
    type: 'copy-kit-request',
    requestId: data.requestId,
    ...(job ? { job: { title: job.title, company: job.company } } : {}),
  };
};

const isCopyKitItem = (value: unknown): value is CopyKitItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  typeof value.value === 'string' &&
  value.value.trim().length > 0 &&
  value.value.length <= MAX_COPY_KIT_VALUE_LENGTH &&
  COPY_KIT_GROUPS.includes(value.group as CopyKitGroup);

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
  if (data.type === 'copy-kit-result' && typeof data.requestId === 'string') {
    return {
      source: APP_MESSAGE_SOURCE,
      type: 'copy-kit-result',
      requestId: data.requestId,
      items: Array.isArray(data.items)
        ? data.items.filter(isCopyKitItem).slice(0, MAX_COPY_KIT_ITEMS)
        : [],
    };
  }
  return null;
};
