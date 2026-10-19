import { Job, UserContext } from '../types';
import { CHAT_SYSTEM_PROMPT } from '../constants';
import type { BatchScreenMatchResult } from '../src/core/matchEngine';
import { scoreBatchScreenRecord, scoreDeepAuditRecord } from '../src/core/matchEngine';
import {
  buildBatchScreenContents,
  buildDeepAuditContents,
  buildResponseSchema,
  buildSystemPrompt,
} from './matchPromptBuilder';
import { generateContent } from './llmClient';

const FLASH_MODEL_ID = 'gemini-3-flash-preview';
const PRO_MODEL_ID = 'gemini-3-pro-preview';

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

export type BatchScreenJobResult = BatchScreenMatchResult;

export const batchScreenJobs = async (
  jobs: Job[],
  ctx: UserContext,
): Promise<BatchScreenJobResult[]> => {
  const response = await generateContent({
    model: FLASH_MODEL_ID,
    contents: buildBatchScreenContents(jobs),
    config: {
      systemInstruction: buildSystemPrompt(ctx, 'triage'),
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema('triage'),
    },
  });

  const parsed = safeParse(response.text);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((raw) => {
    const result = scoreBatchScreenRecord(raw, jobs, ctx, {
      providerId: response.provider,
      modelId: response.model,
    });
    return result ? [result] : [];
  });
};

export const deepAuditJob = async (job: Job, ctx: UserContext) => {
  const response = await generateContent({
    model: PRO_MODEL_ID,
    contents: buildDeepAuditContents(job),
    config: {
      systemInstruction: buildSystemPrompt(ctx, 'audit'),
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 32768 },
      responseSchema: buildResponseSchema('audit'),
    },
  });

  const parsed = safeParse(response.text);
  const result = scoreDeepAuditRecord(parsed, job, ctx, {
    providerId: response.provider,
    modelId: response.model,
  });

  if (!result) throw new Error('Pro Audit Parse Error');
  return result;
};

export const sendMessageToJobConsultant = async (job: Job, ctx: UserContext, message: string) => {
  // 每次都是新会话的单轮问答，等价于带 systemInstruction 的一次 generateContent。
  const response = await generateContent({
    model: FLASH_MODEL_ID,
    contents: `Context: ${job.content.substring(0, 2000)}\nUser: ${message}`,
    config: {
      systemInstruction: CHAT_SYSTEM_PROMPT(job.title, job.company, ctx),
    },
  });
  return response.text;
};
