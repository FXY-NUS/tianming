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

export const MBTI_DESCRIPTIONS: Record<MbtiType, string> = {
  INTJ: '建筑师 · 战略思考者',
  INTP: '逻辑学家 · 系统分析师',
  ENTJ: '指挥官 · 果断的统帅',
  ENTP: '辩论家 · 创意辩论者',
  INFJ: '提倡者 · 安静的理想主义者',
  INFP: '调停者 · 共情的诗人',
  ENFJ: '主人公 · 鼓舞他人的导师',
  ENFP: '竞选者 · 热情的创造者',
  ISTJ: '物流师 · 可靠的实干家',
  ISFJ: '守护者 · 温暖的保护者',
  ESTJ: '总经理 · 有序的组织者',
  ESFJ: '执政官 · 关怀的协调者',
  ISTP: '鉴赏家 · 灵活的工匠',
  ISFP: '探险家 · 敏感的艺术家',
  ESTP: '企业家 · 行动派',
  ESFP: '表演者 · 热情的社交者',
};

export const MbtiDataSchema = z.object({
  type: MbtiTypeSchema,
  note: z.string().optional(),
});

export type MbtiData = z.infer<typeof MbtiDataSchema>;
