import { z } from 'zod';

export const MbtiTypeSchema = z.enum([
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
]);

export type MbtiType = z.infer<typeof MbtiTypeSchema>;

export const MBTI_TYPES: readonly MbtiType[] = MbtiTypeSchema.options;

export type MbtiLetter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

/** Short labels (used in dropdown / inline display). */
export const MBTI_DIMENSION_LABEL: Record<MbtiLetter, string> = {
  E: '外倾',
  I: '内倾',
  S: '实感',
  N: '直觉',
  T: '思维',
  F: '情感',
  J: '判断',
  P: '感知',
};

/** Full descriptions (used in promptFragment so Gemini sees the dimension semantics). */
export const MBTI_DIMENSION_DESCRIPTION: Record<MbtiLetter, string> = {
  E: '外倾 (E) · 能量与注意力优先朝向外部互动',
  I: '内倾 (I) · 能量与注意力优先朝向内省与独处',
  S: '实感 (S) · 信息加工偏向具体事实与细节',
  N: '直觉 (N) · 信息加工偏向模式与可能性',
  T: '思维 (T) · 决策偏向逻辑分析',
  F: '情感 (F) · 决策偏向价值与关系',
  J: '判断 (J) · 节奏偏向计划与结构化',
  P: '感知 (P) · 节奏偏向灵活与开放性',
};

/**
 * 4 letters of a given type, e.g. ENFP → ['E', 'N', 'F', 'P'].
 * Type system guarantees each char is a valid MbtiLetter because MbtiTypeSchema
 * is an enum of well-formed 4-letter strings.
 */
export function mbtiLetters(type: MbtiType): [MbtiLetter, MbtiLetter, MbtiLetter, MbtiLetter] {
  return type.split('') as [MbtiLetter, MbtiLetter, MbtiLetter, MbtiLetter];
}

/**
 * Neutral dimension expansion shown next to each type code in the dropdown.
 * Replaces the previous career-stereotype labels ("建筑师"、"指挥官" etc.) so
 * the prompt no longer primes Gemini to output "INTJ 适合 X 职业" style
 * advice — Gemini should weigh the 4 dimensions against the actual JD.
 */
export const MBTI_DESCRIPTIONS: Record<MbtiType, string> = Object.fromEntries(
  MBTI_TYPES.map((t) => [
    t,
    mbtiLetters(t)
      .map((l) => MBTI_DIMENSION_LABEL[l])
      .join(' · '),
  ]),
) as Record<MbtiType, string>;

export const MbtiDataSchema = z.object({
  type: MbtiTypeSchema,
  note: z.string().optional(),
});

export type MbtiData = z.infer<typeof MbtiDataSchema>;
