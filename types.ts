export interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  content: string;
  salary_text: string;
  status: 'New' | 'Screened' | 'High Match' | 'Applied' | 'Rejected';
  importedAt: string;
  tags: string[];
  isFavorite?: boolean;

  flashScore?: number;
  flashMatchReason?: string;

  analysis?: {
    score: number;
    summary: string;
    hexagram: string;
    judgment: string; // 强烈推荐 / 谨慎尝试 / 立即放弃
    detailed_analysis: {
      pros: string[];
      cons: string[];
    };
    cruel_truth_2026: string;
    career_growth: string;
    interview_tactics: string;
    contract_red_flags: string;
  };

  chatHistory: { role: 'user' | 'model'; text: string; time: string }[];
}

/**
 * @deprecated V7.0 flat profile. Superseded by `UserContext` in
 * `src/core/types.ts`. Kept for the legacy adapter (commit 6) and the
 * localStorage migration (commit 5); will be removed after Phase 2.
 */
export interface Profile {
  name: string;
  bg: string;
  astrology: string;
  preferences: string;
  resumeContent: string;
}

/** Semantic alias for migration code. */
export type LegacyProfile = Profile;
