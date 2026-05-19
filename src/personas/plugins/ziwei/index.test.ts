import { describe, expect, it } from 'vitest';
import { emptyZiweiData, normalizeZiweiData, ziweiPlugin, ziweiPromptFragment } from './index';
import { ZiweiDataSchema, emptyPalace } from './schema';
import type { ZiweiData } from './schema';

const fullData: ZiweiData = {
  ming: { mainStars: ['紫微'], sihua: '无' },
  guanlu: { mainStars: ['天相'], sihua: '化科', note: '左辅同宫' },
  caibo: { mainStars: ['天府'], sihua: '化禄' },
  fuqi: { mainStars: ['太阴'], sihua: '化忌' },
};

describe('ziwei schema', () => {
  it('accepts the 4 required palaces alone', () => {
    expect(ZiweiDataSchema.safeParse(fullData).success).toBe(true);
  });

  it('accepts data with optional 身宫 and 流年宫', () => {
    const parsed = ZiweiDataSchema.safeParse({
      ...fullData,
      shen: { mainStars: ['贪狼'], sihua: '化权' },
      liunian: { mainStars: ['廉贞'], sihua: '化忌' },
      liunianYear: '2026 丙午',
      note: '坐贵向贵',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a palace with 1-2 main stars and matching strengths', () => {
    const parsed = ZiweiDataSchema.safeParse({
      ...fullData,
      fuqi: {
        mainStars: ['紫微', '破军'],
        mainStarStrengths: ['庙', '旺'],
        sihua: '化科',
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown main star', () => {
    expect(
      ZiweiDataSchema.safeParse({
        ...fullData,
        ming: { mainStars: ['北斗主'], sihua: '无' },
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown sihua', () => {
    expect(
      ZiweiDataSchema.safeParse({
        ...fullData,
        guanlu: { mainStars: ['天相'], sihua: '化吉' },
      }).success,
    ).toBe(false);
  });

  it('rejects missing required palaces', () => {
    const { guanlu: _guanlu, ...rest } = fullData;
    void _guanlu;
    expect(ZiweiDataSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an empty mainStars array', () => {
    expect(
      ZiweiDataSchema.safeParse({
        ...fullData,
        ming: { mainStars: [], sihua: '无' },
      }).success,
    ).toBe(false);
  });

  it('rejects more than 2 main stars', () => {
    expect(
      ZiweiDataSchema.safeParse({
        ...fullData,
        ming: { mainStars: ['紫微', '破军', '天府'], sihua: '无' },
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate main stars in the same palace', () => {
    expect(
      ZiweiDataSchema.safeParse({
        ...fullData,
        ming: { mainStars: ['紫微', '紫微'], sihua: '无' },
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown strength', () => {
    expect(
      ZiweiDataSchema.safeParse({
        ...fullData,
        ming: { mainStars: ['紫微'], mainStarStrengths: ['超庙'], sihua: '无' },
      }).success,
    ).toBe(false);
  });

  it('rejects strength length mismatched with mainStars', () => {
    expect(
      ZiweiDataSchema.safeParse({
        ...fullData,
        ming: { mainStars: ['紫微', '破军'], mainStarStrengths: ['庙'], sihua: '无' },
      }).success,
    ).toBe(false);
  });
});

describe('ziweiPromptFragment', () => {
  it('renders required palaces with context labels and main+sihua', () => {
    const out = ziweiPromptFragment(fullData);
    expect(out).toContain('官禄宫（本宫·事业核心）');
    expect(out).toContain('**天相** + 化科');
    expect(out).toContain('[左辅同宫]');
    expect(out).toContain('命宫（三合·人生主轴）');
    expect(out).toContain('财帛宫（三合·金钱观）');
    expect(out).toContain('夫妻宫（对宫·合伙互动）');
  });

  it('omits the 辅助宫位 section when 身/流年 unset', () => {
    expect(ziweiPromptFragment(fullData)).not.toContain('辅助宫位');
  });

  it('includes 流年 year tag when provided', () => {
    const out = ziweiPromptFragment({
      ...fullData,
      liunian: { mainStars: ['廉贞'], sihua: '化忌' },
      liunianYear: '2026 丙午',
    });
    expect(out).toContain('辅助宫位');
    expect(out).toContain('流年宫（2026 丙午）');
    expect(out).toContain('**廉贞** + 化忌');
  });

  it('includes 用户备注 section when note present', () => {
    const out = ziweiPromptFragment({ ...fullData, note: '坐贵向贵\n命财官三方俱吉' });
    expect(out).toContain('### 用户备注');
    expect(out).toContain('坐贵向贵');
  });

  it('drops sihua label when 无', () => {
    expect(ziweiPromptFragment(fullData)).not.toMatch(/紫微 \+ 无/);
  });

  it('renders a double-star palace with inline + separator and strengths', () => {
    const out = ziweiPromptFragment({
      ...fullData,
      fuqi: {
        mainStars: ['紫微', '破军'],
        mainStarStrengths: ['庙', '旺'],
        sihua: '化科',
      },
    });
    expect(out).toContain('**紫微[庙] + 破军[旺]** + 化科');
  });

  it('renders a single-star palace with strength inline', () => {
    const out = ziweiPromptFragment({
      ...fullData,
      ming: { mainStars: ['天府'], mainStarStrengths: ['得'], sihua: '无' },
    });
    expect(out).toContain('**天府[得]**');
  });

  it('omits strengths when array length does not match (defensive)', () => {
    const out = ziweiPromptFragment({
      ...fullData,
      // formatMainStars only emits brackets when strengths.length === mainStars.length.
      ming: { mainStars: ['紫微'], sihua: '无' },
    });
    expect(out).toContain('**紫微**');
    expect(out).not.toContain('紫微[');
  });
});

describe('normalizeZiweiData', () => {
  it('passes already-canonical data through unchanged', () => {
    const normalized = normalizeZiweiData(fullData);
    expect(ZiweiDataSchema.safeParse(normalized).success).toBe(true);
    expect(normalized.ming.mainStars).toEqual(['紫微']);
  });

  it('migrates legacy { mainStar: X } palaces to { mainStars: [X] }', () => {
    const legacy = {
      ming: { mainStar: '紫微', sihua: '无' },
      guanlu: { mainStar: '天相', sihua: '化科', note: '左辅同宫' },
      caibo: { mainStar: '天府', sihua: '化禄' },
      fuqi: { mainStar: '太阴', sihua: '化忌' },
    };
    const normalized = normalizeZiweiData(legacy);
    expect(normalized.ming.mainStars).toEqual(['紫微']);
    expect(normalized.guanlu.mainStars).toEqual(['天相']);
    expect(normalized.guanlu.note).toBe('左辅同宫');
    expect(ZiweiDataSchema.safeParse(normalized).success).toBe(true);
  });

  it('preserves optional palaces during legacy migration', () => {
    const legacy = {
      ming: { mainStar: '紫微', sihua: '无' },
      guanlu: { mainStar: '天相', sihua: '化科' },
      caibo: { mainStar: '天府', sihua: '化禄' },
      fuqi: { mainStar: '太阴', sihua: '化忌' },
      shen: { mainStar: '贪狼', sihua: '化权' },
      liunianYear: '2026 丙午',
      note: '坐贵向贵',
    };
    const normalized = normalizeZiweiData(legacy);
    expect(normalized.shen?.mainStars).toEqual(['贪狼']);
    expect(normalized.liunianYear).toBe('2026 丙午');
    expect(normalized.note).toBe('坐贵向贵');
    expect(ZiweiDataSchema.safeParse(normalized).success).toBe(true);
  });

  it('falls back to emptyZiweiData() for completely invalid input', () => {
    expect(normalizeZiweiData(null)).toEqual(emptyZiweiData());
    expect(normalizeZiweiData('not an object')).toEqual(emptyZiweiData());
  });

  it('fills missing required palaces with empty defaults', () => {
    const partial = { ming: { mainStars: ['紫微'], sihua: '无' as const } };
    const normalized = normalizeZiweiData(partial);
    expect(normalized.guanlu).toEqual(emptyPalace());
    expect(normalized.caibo).toEqual(emptyPalace());
    expect(normalized.fuqi).toEqual(emptyPalace());
    expect(ZiweiDataSchema.safeParse(normalized).success).toBe(true);
  });

  it('drops unknown main stars rather than crashing', () => {
    const dirty = {
      ming: { mainStars: ['北斗主', '紫微'], sihua: '无' },
      guanlu: { mainStars: ['天相'], sihua: '化科' },
      caibo: { mainStars: ['天府'], sihua: '化禄' },
      fuqi: { mainStars: ['太阴'], sihua: '化忌' },
    };
    const normalized = normalizeZiweiData(dirty);
    expect(normalized.ming.mainStars).toEqual(['紫微']);
    expect(ZiweiDataSchema.safeParse(normalized).success).toBe(true);
  });

  it('keeps a valid double-star palace through round-trip', () => {
    const data = {
      ...fullData,
      fuqi: {
        mainStars: ['紫微', '破军'] as const,
        mainStarStrengths: ['庙', '旺'] as const,
        sihua: '化科' as const,
      },
    };
    const normalized = normalizeZiweiData(data);
    expect(normalized.fuqi.mainStars).toEqual(['紫微', '破军']);
    expect(normalized.fuqi.mainStarStrengths).toEqual(['庙', '旺']);
  });
});

describe('ziweiPlugin definition', () => {
  it('is an esoteric plugin with id "ziwei"', () => {
    expect(ziweiPlugin.id).toBe('ziwei');
    expect(ziweiPlugin.category).toBe('esoteric');
    expect(ziweiPlugin.tokenHint).toBeDefined();
  });

  it('emptyData passes its own schema and uses the empty palace default', () => {
    const empty = emptyZiweiData();
    expect(ziweiPlugin.schema.safeParse(empty).success).toBe(true);
    expect(empty.ming).toEqual(emptyPalace());
    expect(empty.shen).toBeUndefined();
    expect(empty.liunian).toBeUndefined();
  });
});
