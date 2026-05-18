import type { Job, ResumeProfile, UserContext } from '../../types';

export type MatchGoal = 'triage' | 'audit' | 'cover_letter' | 'resume_tailor';

export type JobSource =
  | 'manual'
  | 'extension'
  | 'linkedin'
  | 'jobsdb'
  | 'talent_connect'
  | 'boss'
  | 'zhilian'
  | 'indeed'
  | 'liepin'
  | string;

export type ScoreConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type MatchLabel = 'strong_fit' | 'good_fit' | 'stretch' | 'investigate' | 'low_fit';

export type SkillPriority = 'must' | 'preferred' | 'unknown';

export type DimensionKey =
  | 'experience'
  | 'location'
  | 'compensation'
  | 'avoid_keywords'
  | 'skill'
  | 'culture'
  | 'growth'
  | 'persona';

export interface JobCardSnapshot {
  id: string;
  source: JobSource;
  title: string;
  company?: string;
  locationText?: string;
  salaryText?: string;
  snippet?: string;
  url?: string;
  capturedAt: string;
}

export interface JobDetail extends JobCardSnapshot {
  content: string;
  importedAt: string;
}

export interface SkillEvidence {
  skill: string;
  priority: SkillPriority;
  evidence?: string;
}

export interface ExtractedEvidence {
  matchedSkills: SkillEvidence[];
  missingSkills: SkillEvidence[];
  transferableSkills: SkillEvidence[];
  cultureSignals: string[];
  cultureScore?: number;
  growthReasons: string[];
  growthScore?: number;
  personaReasons?: string[];
  personaScore?: number;
}

export interface DimensionScore {
  key: DimensionKey;
  label: string;
  score?: number;
  confidence: ScoreConfidence;
  evidence: string[];
  warnings: string[];
  hardFail?: boolean;
}

export interface ScoringRubricDimension {
  key: DimensionKey;
  label: string;
  weight: number;
  enabled: boolean;
}

export interface ScoringRubric {
  version: string;
  dimensions: ScoringRubricDimension[];
  personaWeightCap: number;
}

export interface HardFilterSettings {
  requireExperienceFit?: boolean;
  requireLocationFit?: boolean;
  requireCompensationFit?: boolean;
  rejectAvoidKeywords?: boolean;
}

export interface MatchContext {
  job: Job;
  user: UserContext;
  activeResumeId?: string;
  activePersonaIds: string[];
  goal: MatchGoal;
}

export interface ScoringInput {
  job: Job | JobDetail | JobCardSnapshot;
  user: UserContext;
  goal: MatchGoal;
  evidence?: ExtractedEvidence;
  rubric?: ScoringRubric;
  hardFilters?: HardFilterSettings;
  providerId?: string;
  modelId?: string;
}

export interface MatchScore {
  overall: number;
  label: MatchLabel;
  dimensions: DimensionScore[];
  hardRejected: boolean;
  rubricVersion: string;
  scoringVersion: string;
  providerId?: string;
  modelId?: string;
  createdAt: string;
}

export interface MatchFeedbackRecord {
  id: string;
  jobId: string;
  resumeId?: string;
  scoringVersion: string;
  dimensionScores: Record<string, number>;
  userRating?: 1 | 2 | 3 | 4 | 5;
  userAction?: 'save' | 'reject' | 'apply' | 'ignore';
  createdAt: string;
}

export interface ActiveResumeSnapshot {
  resume?: ResumeProfile;
  estimatedYears?: number;
  confidence: ScoreConfidence;
}
