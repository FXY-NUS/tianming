import type { JobCardSnapshot } from '../../src/core/matchTypes';

/**
 * 卡片粗筛（triage）的评分适配层。扩展自己不调 Gemini、手里也没有用户画像（D5 / D6），
 * 真正的评分要等后端代理（Phase 6.4）就绪后接到这里；在那之前所有卡片都标「未评分」。
 */

export type TriageVerdict = 'pass' | 'maybe' | 'reject' | 'need_full_jd' | 'unscored';

export interface TriageResult {
  id: string;
  verdict: TriageVerdict;
  reason?: string;
}

export interface TriageScorer {
  score(cards: JobCardSnapshot[]): Promise<TriageResult[]>;
}

export const unscoredScorer: TriageScorer = {
  async score(cards) {
    return cards.map((card) => ({
      id: card.id,
      verdict: 'unscored',
      reason: '评分服务还没接上，点开详情后可以送进天命做完整分析',
    }));
  },
};

/** 唯一的切换点：后端代理接好后，在这里返回调代理的实现。 */
export const getTriageScorer = (): TriageScorer => unscoredScorer;
