import type { JobCardSnapshot } from '../../src/core/matchTypes';
import type { TriageResult } from '../../services/extensionProtocol';

export type { TriageResult, TriageVerdict } from '../../services/extensionProtocol';

/**
 * 卡片粗筛（triage）的评分适配层。扩展自己不调 Gemini、手里也没有用户画像（D5 / D6），
 * 所以把卡片交给打开着的天命页面：Web App 用自己的画像走现有初筛，只回档位和一句理由。
 * 天命页面没打开、或者请求失败，就标「未评分」。
 */

export interface TriageScorer {
  score(cards: JobCardSnapshot[]): Promise<TriageResult[]>;
}

export const unscoredResults = (cards: JobCardSnapshot[], reason: string): TriageResult[] =>
  cards.map((card) => ({ id: card.id, verdict: 'unscored', reason }));

export const NO_APP_REASON = '打开天命页面后刷新 LinkedIn，就能给卡片评分';

export interface AppTabScorerDeps {
  /** 找到已打开的天命标签页，没有返回 null（不会替用户新开标签页）。 */
  findAppTab: () => Promise<number | null>;
  sendToTab: (
    tabId: number,
    message: { type: 'triage'; cards: JobCardSnapshot[] },
  ) => Promise<unknown>;
}

const isResults = (value: unknown): value is { results: TriageResult[] } =>
  !!value && Array.isArray((value as { results?: unknown }).results);

export const createAppTabScorer = (deps: AppTabScorerDeps): TriageScorer => ({
  async score(cards) {
    if (!cards.length) return [];
    const tabId = await deps.findAppTab();
    if (tabId === null) return unscoredResults(cards, NO_APP_REASON);
    try {
      const response = await deps.sendToTab(tabId, { type: 'triage', cards });
      if (!isResults(response)) return unscoredResults(cards, NO_APP_REASON);
      const byId = new Map(response.results.map((result) => [result.id, result]));
      return cards.map(
        (card) =>
          byId.get(card.id) ?? { id: card.id, verdict: 'unscored', reason: '这张卡片没评出来' },
      );
    } catch {
      return unscoredResults(cards, NO_APP_REASON);
    }
  },
});
