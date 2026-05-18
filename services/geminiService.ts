import { GoogleGenAI, Type } from '@google/genai';
import { Job, UserContext } from '../types';
import { CHAT_SYSTEM_PROMPT, FLASH_FILTER_PROMPT, PRO_AUDIT_PROMPT } from '../constants';
import type { ExtractedEvidence, MatchLabel, MatchScore } from '../src/core/matchTypes';
import { buildMatchScore } from '../src/core/scoringEngine';
import { defineEvidenceSchema, safeParseEvidence } from './jobEvidenceExtractor';

const FLASH_MODEL_ID = 'gemini-3-flash-preview';
const PRO_MODEL_ID = 'gemini-3-pro-preview';

const getApiKey = (): string => {
  const fromLocal = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
  const fromEnv = (import.meta as { env?: { VITE_GEMINI_API_KEY?: string } }).env
    ?.VITE_GEMINI_API_KEY;
  return fromLocal || fromEnv || '';
};

const safeParse = (text: string | undefined): unknown => {
  if (!text) return null;
  try {
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText);
  } catch {
    console.error('JSON Parse Error:', text);
    return null;
  }
};

export interface BatchScreenJobResult {
  id: string;
  score: number;
  reason: string;
  matchScore: MatchScore;
  extractedEvidence?: ExtractedEvidence;
}

interface GeminiDeepAuditPayload {
  summary: string;
  hexagram: string;
  judgment: string;
  detailed_analysis: {
    pros: string[];
    cons: string[];
  };
  cruel_truth_2026: string;
  career_growth: string;
  interview_tactics: string;
  contract_red_flags: string;
}

export const batchScreenJobs = async (
  jobs: Job[],
  ctx: UserContext,
): Promise<BatchScreenJobResult[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const chunkedJobs = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    snippet: j.content.substring(0, 800),
    salaryText: j.salary_text,
  }));

  const response = await ai.models.generateContent({
    model: FLASH_MODEL_ID,
    contents: `执行初筛：${JSON.stringify(chunkedJobs)}`,
    config: {
      systemInstruction: FLASH_FILTER_PROMPT(ctx),
      responseMimeType: 'application/json',
      responseSchema: defineBatchScreenSchema(),
    },
  });

  const parsed = safeParse(response.text);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((raw) => {
    const result = normalizeBatchResult(raw, jobs, ctx);
    return result ? [result] : [];
  });
};

export const deepAuditJob = async (job: Job, ctx: UserContext) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: PRO_MODEL_ID,
    contents: `启动天命深度审计。公司：${job.company}。职位：${job.title}。JD原文：${job.content}

请同时抽取 matchedSkills、missingSkills、transferableSkills、cultureSignals、growthReasons 等评分证据。
score 字段可以返回占位值；最终分数会由代码评分引擎覆盖。`,
    config: {
      systemInstruction: PRO_AUDIT_PROMPT(ctx),
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 32768 },
      responseSchema: defineDeepAuditSchema(),
    },
  });

  const parsed = safeParse(response.text);
  if (!isDeepAuditPayload(parsed)) throw new Error('Pro Audit Parse Error');

  const record = parsed as unknown as Record<string, unknown>;
  const extractedEvidence = extractEvidence(record);
  const matchScore = buildMatchScore({
    job,
    user: ctx,
    goal: 'audit',
    evidence: extractedEvidence,
    providerId: 'gemini',
    modelId: PRO_MODEL_ID,
  });

  return {
    ...parsed,
    score: matchScore.overall,
    judgment: judgmentForMatch(matchScore),
    matchScore,
    extractedEvidence,
    evidenceStatus: extractedEvidence ? ('ok' as const) : ('missing' as const),
  };
};

export const sendMessageToJobConsultant = async (job: Job, ctx: UserContext, message: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const chat = ai.chats.create({
    model: FLASH_MODEL_ID,
    config: {
      systemInstruction: CHAT_SYSTEM_PROMPT(job.title, job.company, ctx),
    },
  });

  const response = await chat.sendMessage({
    message: `Context: ${job.content.substring(0, 2000)}\nUser: ${message}`,
  });
  return response.text;
};

function defineBatchScreenSchema() {
  const evidenceSchema = defineEvidenceSchema();
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        reason: { type: Type.STRING },
        ...evidenceSchema.properties,
      },
      required: ['id', 'reason', ...evidenceSchema.required],
    },
  };
}

function defineDeepAuditSchema() {
  const evidenceSchema = defineEvidenceSchema();
  return {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER },
      summary: { type: Type.STRING },
      hexagram: { type: Type.STRING },
      judgment: { type: Type.STRING },
      detailed_analysis: {
        type: Type.OBJECT,
        properties: {
          pros: { type: Type.ARRAY, items: { type: Type.STRING } },
          cons: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['pros', 'cons'],
      },
      cruel_truth_2026: { type: Type.STRING },
      career_growth: { type: Type.STRING },
      interview_tactics: { type: Type.STRING },
      contract_red_flags: { type: Type.STRING },
      ...evidenceSchema.properties,
    },
    required: [
      'score',
      'summary',
      'hexagram',
      'judgment',
      'detailed_analysis',
      'cruel_truth_2026',
      'career_growth',
      'interview_tactics',
      'contract_red_flags',
      ...evidenceSchema.required,
    ],
  };
}

function normalizeBatchResult(
  raw: unknown,
  jobs: Job[],
  ctx: UserContext,
): BatchScreenJobResult | null {
  const record = asRecord(raw);
  if (!record) return null;

  const rawId = record.id;
  const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
  const job = jobs.find((j) => String(j.id) === id);
  if (!job) return null;

  const extractedEvidence = extractEvidence(record);
  const matchScore = buildMatchScore({
    job,
    user: ctx,
    goal: 'triage',
    evidence: extractedEvidence,
    providerId: 'gemini',
    modelId: FLASH_MODEL_ID,
  });

  return {
    id,
    score: matchScore.overall,
    reason: reasonForBatchResult(record.reason, matchScore),
    matchScore,
    extractedEvidence,
  };
}

function extractEvidence(record: Record<string, unknown>): ExtractedEvidence | undefined {
  const evidenceKeys = [
    'matchedSkills',
    'missingSkills',
    'transferableSkills',
    'cultureSignals',
    'growthReasons',
    'personaReasons',
  ];
  if (!evidenceKeys.some((key) => key in record)) return undefined;

  const candidate: Record<string, unknown> = {
    matchedSkills: Array.isArray(record.matchedSkills) ? record.matchedSkills : [],
    missingSkills: Array.isArray(record.missingSkills) ? record.missingSkills : [],
    transferableSkills: Array.isArray(record.transferableSkills) ? record.transferableSkills : [],
    cultureSignals: Array.isArray(record.cultureSignals) ? record.cultureSignals : [],
    growthReasons: Array.isArray(record.growthReasons) ? record.growthReasons : [],
    personaReasons: Array.isArray(record.personaReasons) ? record.personaReasons : [],
  };

  for (const key of ['cultureScore', 'growthScore', 'personaScore']) {
    if (typeof record[key] === 'number') candidate[key] = record[key];
  }

  return safeParseEvidence(JSON.stringify(candidate)) ?? undefined;
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

function judgmentForMatch(matchScore: MatchScore): string {
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

function isDeepAuditPayload(value: unknown): value is GeminiDeepAuditPayload {
  const record = asRecord(value);
  const detailed = asRecord(record?.detailed_analysis);

  return Boolean(
    record &&
    typeof record.summary === 'string' &&
    typeof record.hexagram === 'string' &&
    typeof record.judgment === 'string' &&
    detailed &&
    isStringArray(detailed.pros) &&
    isStringArray(detailed.cons) &&
    typeof record.cruel_truth_2026 === 'string' &&
    typeof record.career_growth === 'string' &&
    typeof record.interview_tactics === 'string' &&
    typeof record.contract_red_flags === 'string',
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item): item is string => typeof item === 'string');
}
