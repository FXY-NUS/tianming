import type { Job } from '../types';

// 单卡聚焦主页（North Star Layer 1）：一次只看一张卡，排序在后台做，界面不暴露桶和数字。

export const getJobScore = (job: Job): number | undefined =>
  job.analysis?.matchScore?.overall ??
  job.matchScore?.overall ??
  job.analysis?.score ??
  job.flashScore;

export const getUnknownRatio = (matchScore: Job['matchScore']): number => {
  if (!matchScore || matchScore.dimensions.length === 0) return 0;
  const unknownCount = matchScore.dimensions.filter(
    (dimension) => dimension.confidence === 'unknown' || dimension.score === undefined,
  ).length;
  return unknownCount / matchScore.dimensions.length;
};

export const hasInsufficientScoreData = (matchScore: Job['matchScore']): boolean =>
  getUnknownRatio(matchScore) > 0.5;

/** 低于这个分的卡片排到队尾（降权，不剔除）。和列表里灰色分数的阈值一致。 */
export const LOW_SCORE_THRESHOLD = 40;

/** 队列里预告的下一批张数。 */
export const UPCOMING_COUNT = 4;

/** 已投或已放弃的岗位不再进队列。 */
export const isFocusEligible = (job: Job): boolean =>
  job.status !== 'Applied' && job.status !== 'Rejected';

/**
 * 0：有可信分数；1：还没评分；2：低分或信息不足。
 * 先给用户看最可能合适的，没评过的居中，低分垫底但不删。
 */
const focusTier = (job: Job): 0 | 1 | 2 => {
  const score = getJobScore(job);
  if (score === undefined) return 1;
  const matchScore = job.analysis?.matchScore ?? job.matchScore;
  if (hasInsufficientScoreData(matchScore) || score < LOW_SCORE_THRESHOLD) return 2;
  return 0;
};

const importedTime = (job: Job): number => {
  const time = new Date(job.importedAt).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const compareFocus = (a: Job, b: Job): number => {
  const tierDiff = focusTier(a) - focusTier(b);
  if (tierDiff !== 0) return tierDiff;
  const scoreDiff = (getJobScore(b) ?? 0) - (getJobScore(a) ?? 0);
  if (scoreDiff !== 0) return scoreDiff;
  return importedTime(b) - importedTime(a);
};

/**
 * 单卡队列的顺序。`passedIds` 是本次已经点过「下一张」的卡片，按点的先后排到队尾，
 * 所以一直点下一张会循环回来，不会把卡片弄丢。
 */
export const orderFocusQueue = (jobs: Job[], passedIds: readonly string[] = []): Job[] => {
  const passedRank = new Map(passedIds.map((id, index) => [id, index]));
  const eligible = jobs.filter(isFocusEligible);
  const fresh = eligible.filter((job) => !passedRank.has(job.id)).sort(compareFocus);
  const passed = eligible
    .filter((job) => passedRank.has(job.id))
    .sort((a, b) => (passedRank.get(a.id) ?? 0) - (passedRank.get(b.id) ?? 0));
  return [...fresh, ...passed];
};

export interface FocusView {
  current?: Job;
  upcoming: Job[];
}

/**
 * 当前卡片优先用 `focusId`（用户正在看的那张，评分变化也不跳走）；
 * 它不在队列里了（被删、已投）就取队首。
 */
export const pickFocusView = (queue: Job[], focusId?: string): FocusView => {
  const current = queue.find((job) => job.id === focusId) ?? queue[0];
  const upcoming = queue.filter((job) => job.id !== current?.id).slice(0, UPCOMING_COUNT);
  return { current, upcoming };
};

/** 点「下一张」：把当前卡记到已看过的队尾。 */
export const passFocusJob = (passedIds: readonly string[], jobId: string): string[] => [
  ...passedIds.filter((id) => id !== jobId),
  jobId,
];
