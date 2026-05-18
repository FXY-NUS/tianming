import type { Job, UserContext } from '../../types';
import type { ExtractedEvidence, MatchLabel, MatchScore, SkillEvidence } from './matchTypes';
import { buildMatchScore } from './scoringEngine';

export interface BatchScreenMatchResult {
  id: string;
  score: number;
  reason: string;
  matchScore: MatchScore;
  extractedEvidence?: ExtractedEvidence;
}

export interface DeepAuditNarrative {
  summary: string;
  hexagram: string;
  detailed_analysis: {
    pros: string[];
    cons: string[];
  };
  cruel_truth_2026: string;
  career_growth: string;
  interview_tactics: string;
  contract_red_flags: string;
}

export interface DeepAuditMatchResult extends DeepAuditNarrative {
  score: number;
  judgment: string;
  matchScore: MatchScore;
  extractedEvidence?: ExtractedEvidence;
  evidenceStatus: 'ok' | 'missing';
}

interface ProviderScoringOptions {
  providerId?: string;
  modelId?: string;
}

export function scoreBatchScreenRecord(
  raw: unknown,
  jobs: Job[],
  user: UserContext,
  options: ProviderScoringOptions = {},
): BatchScreenMatchResult | null {
  const record = asRecord(raw);
  if (!record) return null;

  const rawId = record.id;
  const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
  const job = jobs.find((j) => String(j.id) === id);
  if (!job) return null;

  const extractedEvidence = extractEvidenceFromRecord(record);
  const matchScore = buildMatchScore({
    job,
    user,
    goal: 'triage',
    evidence: extractedEvidence,
    providerId: options.providerId,
    modelId: options.modelId,
  });

  return {
    id,
    score: matchScore.overall,
    reason: reasonForBatchResult(record.reason, matchScore),
    matchScore,
    extractedEvidence,
  };
}

export function scoreDeepAuditRecord(
  raw: unknown,
  job: Job,
  user: UserContext,
  options: ProviderScoringOptions = {},
): DeepAuditMatchResult | null {
  if (!isDeepAuditNarrative(raw)) return null;

  const record = raw as unknown as Record<string, unknown>;
  const extractedEvidence = extractEvidenceFromRecord(record);
  const matchScore = buildMatchScore({
    job,
    user,
    goal: 'audit',
    evidence: extractedEvidence,
    providerId: options.providerId,
    modelId: options.modelId,
  });

  return {
    ...raw,
    score: matchScore.overall,
    judgment: judgmentForMatch(matchScore),
    matchScore,
    extractedEvidence,
    evidenceStatus: extractedEvidence ? 'ok' : 'missing',
  };
}

export function extractEvidenceFromRecord(
  record: Record<string, unknown>,
): ExtractedEvidence | undefined {
  const evidenceKeys = [
    'matchedSkills',
    'missingSkills',
    'transferableSkills',
    'cultureSignals',
    'growthReasons',
    'personaReasons',
  ];
  if (!evidenceKeys.some((key) => key in record)) return undefined;

  const candidate: ExtractedEvidence = {
    matchedSkills: Array.isArray(record.matchedSkills) ? record.matchedSkills : [],
    missingSkills: Array.isArray(record.missingSkills) ? record.missingSkills : [],
    transferableSkills: Array.isArray(record.transferableSkills) ? record.transferableSkills : [],
    cultureSignals: Array.isArray(record.cultureSignals) ? record.cultureSignals : [],
    growthReasons: Array.isArray(record.growthReasons) ? record.growthReasons : [],
    personaReasons: Array.isArray(record.personaReasons) ? record.personaReasons : [],
  } as ExtractedEvidence;

  if (typeof record.cultureScore === 'number') candidate.cultureScore = record.cultureScore;
  if (typeof record.growthScore === 'number') candidate.growthScore = record.growthScore;
  if (typeof record.personaScore === 'number') candidate.personaScore = record.personaScore;

  return isExtractedEvidence(candidate) ? candidate : undefined;
}

export function isDeepAuditNarrative(value: unknown): value is DeepAuditNarrative {
  const record = asRecord(value);
  const detailed = asRecord(record?.detailed_analysis);

  return Boolean(
    record &&
    typeof record.summary === 'string' &&
    typeof record.hexagram === 'string' &&
    detailed &&
    isStringArray(detailed.pros) &&
    isStringArray(detailed.cons) &&
    typeof record.cruel_truth_2026 === 'string' &&
    typeof record.career_growth === 'string' &&
    typeof record.interview_tactics === 'string' &&
    typeof record.contract_red_flags === 'string',
  );
}

export function judgmentForMatch(matchScore: MatchScore): string {
  if (matchScore.hardRejected) return '【立即放弃】硬性筛选失败';

  switch (matchScore.label) {
    case 'strong_fit':
    case 'good_fit':
      return '【强烈推荐】';
    case 'stretch':
    case 'investigate':
      return '谨慎尝试';
    case 'low_fit':
      return '立即放弃';
    default:
      return labelText(matchScore.label);
  }
}

function reasonForBatchResult(rawReason: unknown, matchScore: MatchScore): string {
  if (typeof rawReason === 'string' && rawReason.trim()) {
    return rawReason.trim().slice(0, 80);
  }

  if (matchScore.hardRejected) return 'Hard filter risk';

  const warning = matchScore.dimensions.find((dimension) => dimension.warnings.length > 0)
    ?.warnings[0];
  if (warning) return warning.slice(0, 80);

  const strongest = matchScore.dimensions
    .filter((dimension) => typeof dimension.score === 'number')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  if (strongest) return `${strongest.label}: ${strongest.score}`;

  return labelText(matchScore.label);
}

function labelText(label: MatchLabel): string {
  switch (label) {
    case 'strong_fit':
      return 'Strong fit';
    case 'good_fit':
      return 'Good fit';
    case 'stretch':
      return 'Stretch';
    case 'investigate':
      return 'Investigate';
    case 'low_fit':
      return 'Low fit';
    default:
      return 'Unknown';
  }
}

function isExtractedEvidence(value: unknown): value is ExtractedEvidence {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  return (
    isSkillEvidenceArray(record.matchedSkills) &&
    isSkillEvidenceArray(record.missingSkills) &&
    isSkillEvidenceArray(record.transferableSkills) &&
    isStringArray(record.cultureSignals) &&
    isStringArray(record.growthReasons) &&
    isOptionalScore(record.cultureScore) &&
    isOptionalScore(record.growthScore) &&
    (record.personaReasons === undefined || isStringArray(record.personaReasons)) &&
    isOptionalScore(record.personaScore)
  );
}

function isSkillEvidenceArray(value: unknown): value is SkillEvidence[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const skill = item as Record<string, unknown>;
      return (
        typeof skill.skill === 'string' &&
        (skill.priority === 'must' ||
          skill.priority === 'preferred' ||
          skill.priority === 'unknown') &&
        (skill.evidence === undefined || typeof skill.evidence === 'string')
      );
    })
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item): item is string => typeof item === 'string');
}

function isOptionalScore(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && value >= 0 && value <= 100);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
