import type { CapturedJob } from '../../services/extensionProtocol';

/** 队列上限：天命页面长期没打开时，最多攒这么多条，丢最早的。 */
export const MAX_PENDING_JOBS = 50;

/** 同一个岗位再次送入时用新抓的内容替换旧条目，并挪到队尾。 */
export const enqueueJob = (queue: CapturedJob[], job: CapturedJob): CapturedJob[] =>
  [...queue.filter((item) => item.externalId !== job.externalId), job].slice(-MAX_PENDING_JOBS);

export const removeAcked = (queue: CapturedJob[], externalIds: string[]): CapturedJob[] => {
  const acked = new Set(externalIds);
  return queue.filter((item) => !acked.has(item.externalId));
};
