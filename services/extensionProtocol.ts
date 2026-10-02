/**
 * 浏览器扩展 ↔ Web App 的消息协议（两边共用这一份定义）。
 *
 * 链路：LinkedIn content script 抽 JD → service worker 存进 chrome.storage.local 待送队列 →
 * 天命页面上的 bridge content script 用 window.postMessage 交给 App → App 入库后回 ack →
 * bridge 把已确认的条目移出队列。扩展全程不碰 Gemini（D5），也不碰用户画像（D6）。
 */

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

export const EXTENSION_MESSAGE_SOURCE = 'tianming-extension';
export const APP_MESSAGE_SOURCE = 'tianming-app';

/** bridge → App：把队列里的岗位交给页面。 */
export interface ExtensionJobsMessage {
  source: typeof EXTENSION_MESSAGE_SOURCE;
  type: 'jobs';
  jobs: CapturedJob[];
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

export type AppMessage = AppReadyMessage | AppAckMessage;

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
  return null;
};
