import type { Job, UserContext } from '../types';
import type { JobCardSnapshot, MatchScore } from '../src/core/matchTypes';
import type { BatchScreenJobResult } from './geminiService';
import type { TriageResult, TriageVerdict } from './extensionProtocol';
import { buildJobFromInput } from './jobImport';

/**
 * 扩展卡片粗筛（Phase 6.2）在 Web App 侧的落点：卡片快照 → 临时 Job → 现有批量初筛
 * （Flash 抽证据 + scoreBatchScreenRecord 代码算分，goal = 'triage'）→ 映射成徽章档位。
 * 不改评分逻辑和提示词，也不把卡片存进岗位列表；画像和分数明细不回给扩展（D6）。
 */

export type BatchScreen = (jobs: Job[], ctx: UserContext) => Promise<BatchScreenJobResult[]>;

/** 卡片上只有标题、公司、地点、薪资这几行，拼成初筛用的「正文」。 */
const cardContent = (card: JobCardSnapshot) =>
  [card.title, card.company, card.locationText, card.salaryText, card.snippet]
    .filter((line): line is string => !!line?.trim())
    .join('\n');

const cardToJob = (card: JobCardSnapshot, now: Date): Job =>
  buildJobFromInput(
    {
      id: card.id,
      title: card.title,
      company: card.company,
      url: card.url,
      content: cardContent(card),
      salaryText: card.salaryText,
      locationText: card.locationText,
    },
    now,
  );

/** 引擎档位 → 徽章。stretch 可以看看；investigate 是信息不够，提示点开看全文。 */
export const verdictForMatch = (matchScore: MatchScore): TriageVerdict => {
  if (matchScore.hardRejected) return 'reject';
  switch (matchScore.label) {
    case 'strong_fit':
    case 'good_fit':
      return 'pass';
    case 'stretch':
      return 'maybe';
    case 'investigate':
      return 'need_full_jd';
    case 'low_fit':
      return 'reject';
  }
};

const unscored = (cards: JobCardSnapshot[], reason: string): TriageResult[] =>
  cards.map((card) => ({ id: card.id, verdict: 'unscored', reason }));

export const RATE_LIMITED_REASON = '请求太频繁，稍后自动补评';

/** 代理限流（429）或 Gemini 配额用尽：llmClient 抛出的错误信息里带状态码或错误码。 */
export const isRateLimitError = (error: unknown) =>
  /\b429\b|RESOURCE_EXHAUSTED|RATE_LIMIT/i.test(
    error instanceof Error ? error.message : String(error),
  );

const retryLater = (cards: JobCardSnapshot[]): TriageResult[] =>
  cards.map((card) => ({ id: card.id, verdict: 'retry_later', reason: RATE_LIMITED_REASON }));

export const triageCards = async (
  cards: JobCardSnapshot[],
  ctx: UserContext,
  screen: BatchScreen,
  now: Date = new Date(),
): Promise<TriageResult[]> => {
  if (!cards.length) return [];
  let screened: BatchScreenJobResult[];
  try {
    screened = await screen(
      cards.map((card) => cardToJob(card, now)),
      ctx,
    );
  } catch (error) {
    if (isRateLimitError(error)) return retryLater(cards);
    return unscored(cards, '评分请求失败，刷新 LinkedIn 页面可重试');
  }
  const byId = new Map(screened.map((result) => [String(result.id), result]));
  return cards.map((card) => {
    const result = byId.get(card.id);
    if (!result) return { id: card.id, verdict: 'unscored', reason: '这张卡片没评出来' };
    return {
      id: card.id,
      verdict: verdictForMatch(result.matchScore),
      reason: `${Math.round(result.score)} 分 · ${result.reason}`,
    };
  });
};

/** 被限流后这段时间内不再调 LLM，直接回 retry_later，避免连环撞 429。 */
export const RATE_LIMIT_COOLDOWN_MS = 60_000;

/**
 * 同一张卡片一个会话里只评一次：LinkedIn 换页回来、节点复用时扩展会再问，命中缓存就不再调 LLM。
 * 没评上的（unscored / retry_later）不缓存，下次还会重试。
 */
export const createCachedTriage = (
  triage: (cards: JobCardSnapshot[], ctx: UserContext) => Promise<TriageResult[]>,
  now: () => number = Date.now,
) => {
  const cache = new Map<string, TriageResult>();
  let cooldownUntil = 0;
  return async (cards: JobCardSnapshot[], ctx: UserContext): Promise<TriageResult[]> => {
    const missing = cards.filter((card) => !cache.has(card.id));
    const latest = new Map<string, TriageResult>();
    if (missing.length && now() < cooldownUntil) {
      for (const result of retryLater(missing)) latest.set(result.id, result);
    } else if (missing.length) {
      for (const result of await triage(missing, ctx)) {
        latest.set(result.id, result);
        if (result.verdict === 'retry_later') cooldownUntil = now() + RATE_LIMIT_COOLDOWN_MS;
        else if (result.verdict !== 'unscored') cache.set(result.id, result);
      }
    }
    return cards.map(
      (card) =>
        cache.get(card.id) ??
        latest.get(card.id) ?? { id: card.id, verdict: 'unscored', reason: '这张卡片没评出来' },
    );
  };
};
