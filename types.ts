import type { ExtractedEvidence, MatchFeedbackRecord, MatchScore } from './src/core/matchTypes';

export interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  content: string;
  salary_text: string;
  locationText?: string;
  salaryText?: string;
  workMode?: string;
  status: 'New' | 'Screened' | 'High Match' | 'Applied' | 'Rejected';
  importedAt: string;
  tags: string[];
  isFavorite?: boolean;

  flashScore?: number;
  flashMatchReason?: string;
  matchScore?: MatchScore;
  extractedEvidence?: ExtractedEvidence;

  analysis?: {
    score: number;
    matchScore?: MatchScore;
    extractedEvidence?: ExtractedEvidence;
    evidenceStatus?: 'ok' | 'missing' | 'error';
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
  salaryRange?: [number, number];
  workMode?: 'remote' | 'onsite' | 'hybrid' | 'any';
  preferredLocations: string[];
  avoidKeywords: string[];
}

export interface ResumeStructured {
  basic: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
  };
  summary?: string;
  education: Array<{
    school: string;
    degree: string;
    major: string;
    gpa?: string;
    years: string;
  }>;
  experience: Array<{
    company: string;
    title: string;
    period: string;
    bullets: string[];
  }>;
  skills: {
    hard: string[];
    soft: string[];
    languages: string[];
    tools: string[];
  };
  projects: Array<{
    name: string;
    role: string;
    bullets: string[];
    tech: string[];
  }>;
  certifications?: string[];
  rawHighlights?: string[];
}

export interface ResumeProfile {
  id: string;
  label: string;
  rawText?: string;
  rawFileRef?: { mime: string; blobId: string };
  structured: ResumeStructured;
  piiPolicy: 'keep' | 'mask' | 'strip';
  createdAt: string;
}

/** Legacy V1 type kept only for migration reading — do not use in new code */
export interface LegacyV1ResumeProfile {
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
  // Reserved for Phase 8+ lightweight ML: user-supplied ratings + observed actions
  // per scored JD. Optional so older saved contexts keep loading.
  feedbackRecords?: MatchFeedbackRecord[];
}

// Legacy type kept only for migration reading — do not use in new code
export interface LegacyProfile {
  name: string;
  bg: string;
  astrology: string;
  preferences: string;
  resumeContent: string;
}
