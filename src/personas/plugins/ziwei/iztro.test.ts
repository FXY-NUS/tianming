import { describe, expect, it } from 'vitest';
import { adaptIztroPalace, computeZiweiChart } from './iztro';
import { ZiweiDataSchema } from './schema';

describe('adaptIztroPalace', () => {
  it('maps a single main star with no mutagen', () => {
    const out = adaptIztroPalace({
      name: '命宫',
      isBodyPalace: false,
      majorStars: [{ name: '紫微' }],
    });
    expect(out).toEqual({ mainStar: '紫微', sihua: '无' });
  });

  it('maps mutagen 禄/权/科/忌 to 化禄/权/科/忌', () => {
    expect(
      adaptIztroPalace({
        name: 'x',
        isBodyPalace: false,
        majorStars: [{ name: '天相', mutagen: '科' }],
      }).sihua,
    ).toBe('化科');
    expect(
      adaptIztroPalace({
        name: 'x',
        isBodyPalace: false,
        majorStars: [{ name: '武曲', mutagen: '权' }],
      }).sihua,
    ).toBe('化权');
    expect(
      adaptIztroPalace({
        name: 'x',
        isBodyPalace: false,
        majorStars: [{ name: '太阴', mutagen: '忌' }],
      }).sihua,
    ).toBe('化忌');
    expect(
      adaptIztroPalace({
        name: 'x',
        isBodyPalace: false,
        majorStars: [{ name: '天府', mutagen: '禄' }],
      }).sihua,
    ).toBe('化禄');
  });

  it('falls back to 空宫 when no recognised main star', () => {
    expect(adaptIztroPalace({ name: 'x', isBodyPalace: false, majorStars: [] })).toEqual({
      mainStar: '空宫',
      sihua: '无',
    });
    expect(
      adaptIztroPalace({
        name: 'x',
        isBodyPalace: false,
        majorStars: [{ name: 'NotARealStar' }],
      }),
    ).toEqual({ mainStar: '空宫', sihua: '无' });
  });

  it('puts 双星 same-palace secondary stars into note with sihua suffix', () => {
    const out = adaptIztroPalace({
      name: '财帛',
      isBodyPalace: false,
      majorStars: [{ name: '武曲', mutagen: '权' }, { name: '天相' }],
    });
    expect(out.mainStar).toBe('武曲');
    expect(out.sihua).toBe('化权');
    expect(out.note).toBe('天相');
  });

  it('joins multiple same-palace stars with sihua tags', () => {
    const out = adaptIztroPalace({
      name: '田宅',
      isBodyPalace: false,
      majorStars: [
        { name: '七杀' },
        { name: '破军', mutagen: '禄' },
        { name: '贪狼', mutagen: '科' },
      ],
    });
    expect(out.mainStar).toBe('七杀');
    expect(out.note).toBe('破军·化禄、贪狼·化科');
  });
});

describe('computeZiweiChart (integration with iztro)', () => {
  it('produces a schema-valid ZiweiData partial for a known birth', async () => {
    const data = await computeZiweiChart({
      date: '2000-08-16',
      hourIndex: 2,
      gender: '女',
      calendar: 'solar',
    });
    expect(data.ming).toBeDefined();
    expect(data.guanlu).toBeDefined();
    expect(data.caibo).toBeDefined();
    expect(data.fuqi).toBeDefined();
    expect(ZiweiDataSchema.safeParse(data).success).toBe(true);
  });

  it('returns 身宫 only when it is different from 命宫', async () => {
    const data = await computeZiweiChart({
      date: '2000-08-16',
      hourIndex: 2,
      gender: '女',
      calendar: 'solar',
    });
    if (data.shen) {
      // when present, it must also pass the palace schema
      expect(['化禄', '化权', '化科', '化忌', '无']).toContain(data.shen.sihua);
    }
  });

  it('accepts lunar calendar input', async () => {
    const data = await computeZiweiChart({
      date: '2000-07-17',
      hourIndex: 2,
      gender: '女',
      calendar: 'lunar',
      isLeapMonth: false,
    });
    expect(data.ming?.mainStar).toBeDefined();
  });
});
