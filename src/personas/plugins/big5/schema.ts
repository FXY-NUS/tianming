import { z } from 'zod';

const PERCENTILE = z.number().int().min(0).max(100);

export const Big5DataSchema = z.object({
  openness: PERCENTILE,
  conscientiousness: PERCENTILE,
  extraversion: PERCENTILE,
  agreeableness: PERCENTILE,
  neuroticism: PERCENTILE,
  note: z.string().optional(),
});

export type Big5Data = z.infer<typeof Big5DataSchema>;

export type Big5Dimension =
  | 'openness'
  | 'conscientiousness'
  | 'extraversion'
  | 'agreeableness'
  | 'neuroticism';

export const BIG5_DIMENSIONS: readonly Big5Dimension[] = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'neuroticism',
];

export const BIG5_LABELS: Record<Big5Dimension, string> = {
  openness: '开放性 (Openness)',
  conscientiousness: '尽责性 (Conscientiousness)',
  extraversion: '外向性 (Extraversion)',
  agreeableness: '宜人性 (Agreeableness)',
  neuroticism: '神经质 (Neuroticism)',
};

export const BIG5_HINTS: Record<Big5Dimension, string> = {
  openness: '低 → 务实保守；高 → 好奇求新',
  conscientiousness: '低 → 灵活随性；高 → 自律有序',
  extraversion: '低 → 内向独处；高 → 外向社交',
  agreeableness: '低 → 独立竞争；高 → 合作共情',
  neuroticism: '低 → 情绪稳定；高 → 敏感焦虑',
};

export function big5Band(percentile: number): '低' | '偏低' | '中等' | '偏高' | '高' {
  if (percentile <= 20) return '低';
  if (percentile <= 40) return '偏低';
  if (percentile <= 60) return '中等';
  if (percentile <= 80) return '偏高';
  return '高';
}
