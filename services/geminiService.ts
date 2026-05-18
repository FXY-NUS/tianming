import { GoogleGenAI } from '@google/genai';
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

export type BatchScreenJobResult = BatchScreenMatchResult;

export const batchScreenJobs = async (
  jobs: Job[],
  ctx: UserContext,
): Promise<BatchScreenJobResult[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const response = await ai.models.generateContent({
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
      providerId: 'gemini',
      modelId: FLASH_MODEL_ID,
    });
    return result ? [result] : [];
  });
};

export const deepAuditJob = async (job: Job, ctx: UserContext) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
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
    providerId: 'gemini',
    modelId: PRO_MODEL_ID,
  });

  if (!result) throw new Error('Pro Audit Parse Error');
  return result;
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
