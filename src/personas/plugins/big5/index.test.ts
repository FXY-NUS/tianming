import { describe, expect, it } from 'vitest';
import { big5Plugin, big5PromptFragment } from './index';
import { Big5DataSchema, big5Band } from './schema';

const fullData = {
  openness: 80,
  conscientiousness: 60,
  extraversion: 35,
  agreeableness: 70,
  neuroticism: 25,
};

describe('big5 schema', () => {
  it('accepts the full 5 percentiles', () => {
    expect(Big5DataSchema.safeParse(fullData).success).toBe(true);
  });

  it('rejects out-of-range scores', () => {
    expect(Big5DataSchema.safeParse({ ...fullData, openness: -1 }).success).toBe(false);
    expect(Big5DataSchema.safeParse({ ...fullData, neuroticism: 101 }).success).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(Big5DataSchema.safeParse({ ...fullData, openness: 50.5 }).success).toBe(false);
  });

  it('rejects missing dimensions', () => {
    const { openness, ...rest } = fullData;
    void openness;
    expect(Big5DataSchema.safeParse(rest).success).toBe(false);
  });
});

describe('big5Band', () => {
  it('maps percentiles to bands', () => {
    expect(big5Band(0)).toBe('低');
    expect(big5Band(20)).toBe('低');
    expect(big5Band(21)).toBe('偏低');
    expect(big5Band(50)).toBe('中等');
    expect(big5Band(80)).toBe('偏高');
    expect(big5Band(81)).toBe('高');
    expect(big5Band(100)).toBe('高');
  });
});

describe('big5PromptFragment', () => {
  it('lists every dimension with score and band', () => {
    const out = big5PromptFragment(fullData);
    expect(out).toContain('开放性');
    expect(out).toContain('80/100');
    expect(out).toContain('(偏高)');
    expect(out).toContain('神经质');
    expect(out).toContain('25/100');
    expect(out).toContain('(偏低)');
  });

  it('includes the note line when present', () => {
    const out = big5PromptFragment({ ...fullData, note: 'IPIP-NEO 短表' });
    expect(out).toMatch(/用户备注:\s*IPIP-NEO 短表/);
  });
});

describe('big5Plugin definition', () => {
  it('is a core-category plugin with id "big5"', () => {
    expect(big5Plugin.id).toBe('big5');
    expect(big5Plugin.category).toBe('core');
  });

  it('emptyData passes its own schema', () => {
    expect(big5Plugin.schema.safeParse(big5Plugin.emptyData()).success).toBe(true);
  });
});
