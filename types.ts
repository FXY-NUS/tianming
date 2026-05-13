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

// ── Phase 1: UserContext data model ──────────────────────────────────────────

export interface UserPreferences {
  displayName: string;
  backgroundSummary: string; // education, skills, background
  astrologyProfile: string; // 命理 + 流年
  jobPreferences: string; // salary, direction, avoidance (freeform)
  preferredLocations: string[];
  avoidKeywords: string[];
}

export interface ResumeProfile {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaInstance {
  id: string;
  /** Plugin id from the persona registry (e.g. 'mbti', 'holland', 'big5', 'ziwei'). */
  type: string;
  label: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface UserContext {
  personas: PersonaInstance[];
  resumes: ResumeProfile[];
  preferences: UserPreferences;
  activeResumeId?: string;
  activePersonaIds: string[];
}

// Legacy type kept only for migration reading — do not use in new code
export interface LegacyProfile {
  name: string;
  bg: string;
  astrology: string;
  preferences: string;
  resumeContent: string;
}
