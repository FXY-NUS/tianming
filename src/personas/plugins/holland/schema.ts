import { z } from 'zod';

export const HollandLetterSchema = z.enum(['R', 'I', 'A', 'S', 'E', 'C']);
export type HollandLetter = z.infer<typeof HollandLetterSchema>;

export const HOLLAND_LETTERS: readonly HollandLetter[] = HollandLetterSchema.options;

export const HOLLAND_DESCRIPTIONS: Record<HollandLetter, string> = {
  R: 'Realistic 实际型 · 工具、实操、户外、机械',
  I: 'Investigative 研究型 · 分析、研究、思考、解题',
  A: 'Artistic 艺术型 · 创造、表达、设计、自由',
  S: 'Social 社会型 · 帮助、教学、沟通、协作',
  E: 'Enterprising 企业型 · 说服、领导、商业、决策',
  C: 'Conventional 常规型 · 组织、数据、规则、稳定',
};

/** Short labels for compact UI / prompt lines. */
export const HOLLAND_SHORT_LABEL: Record<HollandLetter, string> = {
  R: '实际型',
  I: '研究型',
  A: '艺术型',
  S: '社会型',
  E: '企业型',
  C: '常规型',
};

/**
 * Optional 6-dimension raw scores (e.g. from O*NET Interest Profiler / SDS).
 * No fixed scale — we normalise relative weight by sum.
 * Empty / undefined letters mean "not measured" rather than "score = 0".
 */
export const HollandScoresSchema = z
  .object({
    R: z.number().int().nonnegative().optional(),
    I: z.number().int().nonnegative().optional(),
    A: z.number().int().nonnegative().optional(),
    S: z.number().int().nonnegative().optional(),
    E: z.number().int().nonnegative().optional(),
    C: z.number().int().nonnegative().optional(),
  })
  .optional();

export type HollandScores = z.infer<typeof HollandScoresSchema>;

export const HollandDataSchema = z
  .object({
    primary: HollandLetterSchema,
    secondary: HollandLetterSchema.optional(),
    tertiary: HollandLetterSchema.optional(),
    scores: HollandScoresSchema,
    note: z.string().optional(),
  })
  .refine(
    (d) => {
      const picks = [d.primary, d.secondary, d.tertiary].filter((x): x is HollandLetter =>
        Boolean(x),
      );
      return new Set(picks).size === picks.length;
    },
    { message: 'primary / secondary / tertiary must all be distinct' },
  );

export type HollandData = z.infer<typeof HollandDataSchema>;

export function hollandCode(data: HollandData): string {
  return [data.primary, data.secondary, data.tertiary].filter(Boolean).join('');
}
