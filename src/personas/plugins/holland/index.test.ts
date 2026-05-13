import { describe, expect, it } from 'vitest';
import { hollandPlugin, hollandPromptFragment } from './index';
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
});

describe('hollandPlugin definition', () => {
  it('is a core-category plugin with id "holland"', () => {
    expect(hollandPlugin.id).toBe('holland');
    expect(hollandPlugin.category).toBe('core');
  });

  it('emptyData passes its own schema', () => {
    expect(hollandPlugin.schema.safeParse(hollandPlugin.emptyData()).success).toBe(true);
  });
});
