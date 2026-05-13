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

export const ZiweiPalaceSchema = z.object({
  mainStar: ZiweiMainStarSchema,
  sihua: ZiweiSihuaSchema,
  note: z.string().optional(),
});
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
});
export type ZiweiData = z.infer<typeof ZiweiDataSchema>;

export type PalaceKey = 'ming' | 'guanlu' | 'caibo' | 'fuqi' | 'shen' | 'liunian';

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
  return { mainStar: '紫微', sihua: '无' };
}
