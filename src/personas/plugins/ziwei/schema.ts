import { z } from 'zod';

export const ZIWEI_MAIN_STARS = [
  '紫微',
  '天机',
  '太阳',
  '武曲',
  '天同',
  '廉贞',
  '天府',
  '太阴',
  '贪狼',
  '巨门',
  '天相',
  '天梁',
  '七杀',
  '破军',
  '空宫',
] as const;
export const ZiweiMainStarSchema = z.enum(ZIWEI_MAIN_STARS);
export type ZiweiMainStar = z.infer<typeof ZiweiMainStarSchema>;

export const ZIWEI_SIHUA = ['无', '化禄', '化权', '化科', '化忌'] as const;
export const ZiweiSihuaSchema = z.enum(ZIWEI_SIHUA);
export type ZiweiSihua = z.infer<typeof ZiweiSihuaSchema>;

export const ZIWEI_STRENGTH = ['庙', '旺', '得', '利', '平', '不', '陷'] as const;
export const ZiweiStrengthSchema = z.enum(ZIWEI_STRENGTH);
export type ZiweiStrength = z.infer<typeof ZiweiStrengthSchema>;

export const ZiweiPalaceSchema = z
  .object({
    mainStars: z
      .array(ZiweiMainStarSchema)
      .min(1, '至少 1 颗主星')
      .max(2, '最多 2 颗主星')
      .refine((arr) => new Set(arr).size === arr.length, '主星不能重复'),
    mainStarStrengths: z.array(ZiweiStrengthSchema).optional(),
    sihua: ZiweiSihuaSchema,
    note: z.string().optional(),
  })
  .refine(
    (palace) =>
      palace.mainStarStrengths === undefined ||
      palace.mainStarStrengths.length === palace.mainStars.length,
    { message: 'mainStarStrengths 必须与 mainStars 等长（或留空）', path: ['mainStarStrengths'] },
  );
export type ZiweiPalace = z.infer<typeof ZiweiPalaceSchema>;

export const ZiweiDataSchema = z.object({
  ming: ZiweiPalaceSchema,
  guanlu: ZiweiPalaceSchema,
  caibo: ZiweiPalaceSchema,
  fuqi: ZiweiPalaceSchema,
  shen: ZiweiPalaceSchema.optional(),
  liunian: ZiweiPalaceSchema.optional(),
  liunianYear: z.string().optional(),
  note: z.string().optional(),
  /**
   * The 8 non-schema palaces (兄弟/子女/父母/福德/田宅/疾厄/迁移/交友) when
   * imported from a complete chart. Each key is optional because manual
   * users won't fill them. Populated by parseWenmoChart so the audit prompt
   * can reference 对宫 main stars (e.g. 财帛空宫→借福德).
   */
  opposingPalaces: z
    .object({
      qianyi: ZiweiPalaceSchema.optional(),
      fude: ZiweiPalaceSchema.optional(),
      xiongdi: ZiweiPalaceSchema.optional(),
      jiaoyou: ZiweiPalaceSchema.optional(),
      fumu: ZiweiPalaceSchema.optional(),
      jie: ZiweiPalaceSchema.optional(),
      tianzhai: ZiweiPalaceSchema.optional(),
      zinv: ZiweiPalaceSchema.optional(),
    })
    .optional(),
});
export type ZiweiData = z.infer<typeof ZiweiDataSchema>;

export type PalaceKey = 'ming' | 'guanlu' | 'caibo' | 'fuqi' | 'shen' | 'liunian';

export type OpposingPalaceKey =
  | 'qianyi' // 迁移宫 — 命宫对宫
  | 'fude' // 福德宫 — 财帛宫对宫
  | 'xiongdi' // 兄弟宫
  | 'jiaoyou' // 交友宫 — 兄弟宫对宫
  | 'fumu' // 父母宫
  | 'jie' // 疾厄宫 — 父母宫对宫
  | 'tianzhai' // 田宅宫
  | 'zinv'; // 子女宫 — 田宅宫对宫

export const OPPOSING_PALACE_LABEL: Record<OpposingPalaceKey, string> = {
  qianyi: '迁移宫',
  fude: '福德宫',
  xiongdi: '兄弟宫',
  jiaoyou: '交友宫',
  fumu: '父母宫',
  jie: '疾厄宫',
  tianzhai: '田宅宫',
  zinv: '子女宫',
};

/**
 * For each schema palace, which OpposingPalaceKey is its 对宫. This is the
 * fact紫微 practitioners use when reading "借星": an empty palace borrows its
 * 对宫's main stars as proxy. Pre-encoding it here removes Gemini's freedom
 * to invent "借" relationships that don't exist in 紫微.
 */
export const SCHEMA_PALACE_OPPOSITE: Partial<Record<PalaceKey, OpposingPalaceKey>> = {
  ming: 'qianyi',
  caibo: 'fude',
  // 官 ↔ 夫 already both in schema, no opposing entry needed.
};

export const PALACE_LABEL: Record<PalaceKey, string> = {
  ming: '命宫',
  guanlu: '官禄宫',
  caibo: '财帛宫',
  fuqi: '夫妻宫',
  shen: '身宫',
  liunian: '流年宫',
};

export const PALACE_HINT: Record<PalaceKey, string> = {
  ming: '人生主轴 · 三方四正之一',
  guanlu: '事业本宫 · 最重要',
  caibo: '金钱观 · 三方四正之一',
  fuqi: '合伙互动 · 官禄对宫',
  shen: '后天倾向 · 35 岁后影响渐增',
  liunian: '当年运势 · 每年换宫',
};

export const REQUIRED_PALACES: readonly PalaceKey[] = ['ming', 'guanlu', 'caibo', 'fuqi'];
export const OPTIONAL_PALACES: readonly PalaceKey[] = ['shen', 'liunian'];

export function emptyPalace(): ZiweiPalace {
  return { mainStars: ['紫微'], sihua: '无' };
}
