import { describe, expect, it } from 'vitest';
import {
  deriveHollandRawScores,
  hasUserScores,
  hollandPercentages,
  hollandPlugin,
  hollandPromptFragment,
} from './index';
import { HollandDataSchema, hollandCode } from './schema';

describe('holland schema', () => {
  it('accepts a primary-only code', () => {
    expect(HollandDataSchema.safeParse({ primary: 'I' }).success).toBe(true);
  });

  it('accepts a full 3-letter code', () => {
    expect(
      HollandDataSchema.safeParse({ primary: 'I', secondary: 'A', tertiary: 'S' }).success,
    ).toBe(true);
  });

  it('rejects duplicate letters across slots', () => {
    expect(HollandDataSchema.safeParse({ primary: 'I', secondary: 'I' }).success).toBe(false);
    expect(
      HollandDataSchema.safeParse({ primary: 'I', secondary: 'A', tertiary: 'I' }).success,
    ).toBe(false);
  });

  it('rejects unknown letters', () => {
    expect(HollandDataSchema.safeParse({ primary: 'Z' }).success).toBe(false);
  });

  it('accepts optional 6-dim scores object', () => {
    expect(
      HollandDataSchema.safeParse({
        primary: 'A',
        scores: { A: 21, C: 16, R: 15, S: 11, I: 9, E: 7 },
      }).success,
    ).toBe(true);
  });

  it('accepts partial scores (missing letters allowed)', () => {
    expect(HollandDataSchema.safeParse({ primary: 'A', scores: { A: 10, C: 5 } }).success).toBe(
      true,
    );
  });

  it('rejects negative scores', () => {
    expect(HollandDataSchema.safeParse({ primary: 'A', scores: { A: -1 } }).success).toBe(false);
  });

  it('rejects non-integer scores', () => {
    expect(HollandDataSchema.safeParse({ primary: 'A', scores: { A: 3.5 } }).success).toBe(false);
  });
});

describe('hollandCode', () => {
  it('joins picks left-to-right', () => {
    expect(hollandCode({ primary: 'I', secondary: 'A', tertiary: 'S' })).toBe('IAS');
  });

  it('skips empty slots', () => {
    expect(hollandCode({ primary: 'R', tertiary: 'C' })).toBe('RC');
    expect(hollandCode({ primary: 'E' })).toBe('E');
  });
});

describe('deriveHollandRawScores', () => {
  it('uses real scores when at least one is positive', () => {
    const raw = deriveHollandRawScores({
      primary: 'A',
      scores: { A: 21, C: 16, R: 15, S: 11, I: 9, E: 7 },
    });
    expect(raw).toEqual({ R: 15, I: 9, A: 21, S: 11, E: 7, C: 16 });
  });

  it('treats undefined letters in scores as 0', () => {
    const raw = deriveHollandRawScores({
      primary: 'A',
      scores: { A: 10, C: 5 },
    });
    expect(raw.A).toBe(10);
    expect(raw.C).toBe(5);
    expect(raw.R).toBe(0);
    expect(raw.S).toBe(0);
  });

  it('falls back to 3:2:1 raw weights when no scores provided', () => {
    const raw = deriveHollandRawScores({ primary: 'A', secondary: 'C', tertiary: 'R' });
    expect(raw).toEqual({ R: 1, I: 0, A: 3, S: 0, E: 0, C: 2 });
  });

  it('falls back to 3:2:1 when scores blob is empty / all zero', () => {
    const raw = deriveHollandRawScores({
      primary: 'I',
      secondary: 'A',
      scores: { A: 0, I: 0 },
    });
    expect(raw.I).toBe(3);
    expect(raw.A).toBe(2);
  });

  it('primary-only with no scores → only primary gets weight 3', () => {
    const raw = deriveHollandRawScores({ primary: 'E' });
    expect(raw.E).toBe(3);
    expect(raw.R).toBe(0);
  });
});

describe('hollandPercentages', () => {
  it('normalises to sum ≈ 100 (rounding may drift ±1-2)', () => {
    const pct = hollandPercentages({ R: 15, I: 9, A: 21, S: 11, E: 7, C: 16 });
    const sum = Object.values(pct).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(98);
    expect(sum).toBeLessThanOrEqual(102);
    // Highest score = A; lowest non-zero = E
    expect(pct.A).toBeGreaterThan(pct.C);
    expect(pct.E).toBeLessThan(pct.I);
  });

  it('returns all-zero when total is zero', () => {
    expect(hollandPercentages({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 })).toEqual({
      R: 0,
      I: 0,
      A: 0,
      S: 0,
      E: 0,
      C: 0,
    });
  });

  it('3:2:1 → 50/33/17 percentages', () => {
    const pct = hollandPercentages({ R: 0, I: 0, A: 3, S: 0, E: 0, C: 2 });
    expect(pct.A).toBe(60); // 3/5 = 60%
    expect(pct.C).toBe(40); // 2/5 = 40%
    const pct321 = hollandPercentages({ R: 1, I: 0, A: 3, S: 0, E: 0, C: 2 });
    expect(pct321.A).toBe(50); // 3/6
    expect(pct321.C).toBe(33); // 2/6
    expect(pct321.R).toBe(17); // 1/6
  });
});

describe('hasUserScores', () => {
  it('false when no scores blob', () => {
    expect(hasUserScores({ primary: 'I' })).toBe(false);
  });

  it('false when all scores are 0 / undefined', () => {
    expect(hasUserScores({ primary: 'I', scores: {} })).toBe(false);
    expect(hasUserScores({ primary: 'I', scores: { A: 0 } })).toBe(false);
  });

  it('true when at least one positive score', () => {
    expect(hasUserScores({ primary: 'I', scores: { A: 1 } })).toBe(true);
  });
});

describe('hollandPromptFragment', () => {
  it('renders primary description and combined code', () => {
    const out = hollandPromptFragment({ primary: 'I', secondary: 'A', tertiary: 'S' });
    expect(out).toContain('**I**');
    expect(out).toContain('Investigative');
    expect(out).toContain('综合编码: IAS');
  });

  it('omits empty secondary / tertiary lines', () => {
    const out = hollandPromptFragment({ primary: 'I' });
    expect(out).not.toMatch(/次要:/);
    expect(out).not.toMatch(/第三:/);
  });

  it('includes the note line when present', () => {
    const out = hollandPromptFragment({ primary: 'I', note: 'O*NET 自测' });
    expect(out).toMatch(/用户备注:\s*O\*NET 自测/);
  });

  it('shows raw scores + percentages when user provided real test scores', () => {
    const out = hollandPromptFragment({
      primary: 'A',
      secondary: 'C',
      tertiary: 'R',
      scores: { A: 21, C: 16, R: 15, S: 11, I: 9, E: 7 },
    });
    expect(out).toMatch(/6 维强度（占比）/);
    expect(out).toMatch(/A=27%/); // 21/79 = 26.58 → 27
    expect(out).toMatch(/原始分.*A=21/);
    expect(out).toMatch(/用户提供的 RIASEC 测评分数/);
  });

  it('falls back to 3:2:1 percentages when no real scores', () => {
    const out = hollandPromptFragment({ primary: 'I', secondary: 'A', tertiary: 'S' });
    expect(out).toMatch(/6 维强度（占比）/);
    expect(out).toMatch(/I=50%/);
    expect(out).toMatch(/A=33%/);
    expect(out).toMatch(/S=17%/);
    expect(out).toMatch(/3:2:1 默认权重/);
    expect(out).not.toMatch(/原始分:/);
  });

  it('sorts the strength line high-to-low', () => {
    const out = hollandPromptFragment({
      primary: 'A',
      scores: { A: 21, C: 16, R: 15, S: 11, I: 9, E: 7 },
    });
    const strengthLine = out.split('\n').find((l) => l.includes('6 维强度'));
    expect(strengthLine).toBeDefined();
    const aIdx = strengthLine!.indexOf('A=');
    const cIdx = strengthLine!.indexOf('C=');
    const eIdx = strengthLine!.indexOf('E=');
    expect(aIdx).toBeLessThan(cIdx);
    expect(cIdx).toBeLessThan(eIdx);
  });
});

describe('hollandPlugin definition', () => {
  it('is a core-category plugin with id "holland"', () => {
    expect(hollandPlugin.id).toBe('holland');
    expect(hollandPlugin.category).toBe('core');
  });

  it('description mentions optional 6-dim scoring and 3:2:1 fallback', () => {
    expect(hollandPlugin.description).toMatch(/6 维|3:2:1/);
  });

  it('emptyData passes its own schema', () => {
    expect(hollandPlugin.schema.safeParse(hollandPlugin.emptyData()).success).toBe(true);
  });
});
