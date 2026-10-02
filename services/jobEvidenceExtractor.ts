import { Type } from '@google/genai';
import type { Job, UserContext } from '../types';
import type { ExtractedEvidence, SkillEvidence } from '../src/core/matchTypes';
import { SKILL_BUCKET_RULES, buildResumeUnionSection } from '../constants';
import { generateContent } from './llmClient';

export type EvidenceExtractionErrorKind = 'gemini_error' | 'schema_violation' | 'empty_response';

export type EvidenceExtractionResult =
  | { status: 'ok'; data: ExtractedEvidence }
  | { status: 'error'; kind: EvidenceExtractionErrorKind; message: string };

const JOB_EVIDENCE_PROMPT = `
You are Tianming's job evidence extractor.

Task:
- Extract structured evidence from the JD and the user's resume/profile.
- Do not calculate the final match score.
- Do not invent missing facts.
- Use "unknown" priority when a skill's priority is unclear.
- When resume evidence supports a skill, include sourceResumeIds with resume ids from the resume context.
- If the source cannot be determined, omit sourceResumeIds instead of guessing.
- Sort skills into matchedSkills / missingSkills / transferableSkills by the rules below. Every entry is a JD requirement; never list resume skills the JD does not ask for.

${SKILL_BUCKET_RULES}

Return JSON only.
`;

export async function extractJobEvidence(
  job: Job,
  ctx: UserContext,
): Promise<EvidenceExtractionResult> {
  try {
    const response = await generateContent({
      model: 'gemini-3-pro-preview',
      contents: buildEvidencePrompt(job, ctx),
      config: {
        systemInstruction: JOB_EVIDENCE_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: defineEvidenceSchema(),
        temperature: 0.1,
      },
    });

    if (!response.text) {
      return {
        status: 'error',
        kind: 'empty_response',
        message: 'Gemini returned an empty evidence response',
      };
    }

    const parsed = safeParseEvidence(response.text);
    if (!parsed) {
      return {
        status: 'error',
        kind: 'schema_violation',
        message: 'Evidence JSON does not match schema',
      };
    }

    return { status: 'ok', data: parsed };
  } catch (err) {
    return {
      status: 'error',
      kind: 'gemini_error',
      message: err instanceof Error ? err.message : 'Gemini API error',
    };
  }
}

export function safeParseEvidence(text: string | undefined): ExtractedEvidence | null {
  if (!text) return null;

  try {
    const cleanText = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    return isValidExtractedEvidence(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function buildEvidencePrompt(job: Job, ctx: UserContext): string {
  const activePersonas = ctx.personas.filter((persona) =>
    ctx.activePersonaIds.includes(persona.id),
  );

  return `
User profile:
${JSON.stringify(ctx.preferences)}

Resume context:
${buildResumeUnionSection(ctx)}

Active personas:
${activePersonas.length > 0 ? JSON.stringify(activePersonas) : 'No active personas selected.'}

Job:
Title: ${job.title}
Company: ${job.company}
Salary: ${job.salary_text || 'unknown'}
JD:
${job.content}
`;
}

export function defineEvidenceSchema() {
  const skillEvidence = {
    type: Type.OBJECT,
    properties: {
      skill: { type: Type.STRING },
      priority: { type: Type.STRING },
      evidence: { type: Type.STRING },
      sourceResumeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['skill', 'priority'],
  };

  return {
    type: Type.OBJECT,
    properties: {
      matchedSkills: { type: Type.ARRAY, items: skillEvidence },
      missingSkills: { type: Type.ARRAY, items: skillEvidence },
      transferableSkills: { type: Type.ARRAY, items: skillEvidence },
      cultureSignals: { type: Type.ARRAY, items: { type: Type.STRING } },
      cultureScore: { type: Type.NUMBER },
      growthReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
      growthScore: { type: Type.NUMBER },
      personaReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
      personaScore: { type: Type.NUMBER },
    },
    required: [
      'matchedSkills',
      'missingSkills',
      'transferableSkills',
      'cultureSignals',
      'cultureScore',
      'growthReasons',
      'growthScore',
    ],
  };
}

function isValidExtractedEvidence(obj: unknown): obj is ExtractedEvidence {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;

  return (
    isSkillEvidenceArray(o.matchedSkills) &&
    isSkillEvidenceArray(o.missingSkills) &&
    isSkillEvidenceArray(o.transferableSkills) &&
    isStringArray(o.cultureSignals) &&
    isStringArray(o.growthReasons) &&
    isOptionalScore(o.cultureScore) &&
    isOptionalScore(o.growthScore) &&
    (o.personaReasons === undefined || isStringArray(o.personaReasons)) &&
    isOptionalScore(o.personaScore)
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
        (skill.evidence === undefined || typeof skill.evidence === 'string') &&
        (skill.sourceResumeIds === undefined || isStringArray(skill.sourceResumeIds))
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
