import { describe, expect, it } from 'vitest';
import { emptyZiweiData, ziweiPlugin, ziweiPromptFragment } from './index';
import { ZiweiDataSchema, emptyPalace } from './schema';

const fullData = {
  ming: { mainStar: '紫微' as const, sihua: '无' as const },
  guanlu: { mainStar: '天相' as const, sihua: '化科' as const, note: '左辅同宫' },
  caibo: { mainStar: '天府' as const, sihua: '化禄' as const },
  fuqi: { mainStar: '太阴' as const, sihua: '化忌' as const },
};

describe('ziwei schema', () => {
  it('accepts the 4 required palaces alone', () => {
    expect(ZiweiDataSchema.safeParse(fullData).success).toBe(true);
  });

  it('accepts data with optional 身宫 and 流年宫', () => {
    const parsed = ZiweiDataSchema.safeParse({
      ...fullData,
      shen: { mainStar: '贪狼', sihua: '化权' },
      liunian: { mainStar: '廉贞', sihua: '化忌' },
      liunianYear: '2026 丙午',
      note: '坐贵向贵',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown main star', () => {
    expect(
      ZiweiDataSchema.safeParse({ ...fullData, ming: { mainStar: '北斗主', sihua: '无' } }).success,
    ).toBe(false);
  });

  it('rejects an unknown sihua', () => {
    expect(
      ZiweiDataSchema.safeParse({ ...fullData, guanlu: { mainStar: '天相', sihua: '化吉' } })
        .success,
    ).toBe(false);
  });

  it('rejects missing required palaces', () => {
    const { guanlu, ...rest } = fullData;
    void guanlu;
    expect(ZiweiDataSchema.safeParse(rest).success).toBe(false);
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
      liunian: { mainStar: '廉贞', sihua: '化忌' },
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
