import { describe, expect, it } from 'vitest';
import { mbtiPlugin, mbtiPromptFragment } from './index';
import { MBTI_DESCRIPTIONS, MBTI_DIMENSION_LABEL, MbtiDataSchema, mbtiLetters } from './schema';

describe('mbti schema', () => {
  it('accepts a valid type', () => {
    expect(MbtiDataSchema.safeParse({ type: 'ENFP' }).success).toBe(true);
  });

  it('accepts a valid type with note', () => {
    const parsed = MbtiDataSchema.parse({ type: 'INTJ', note: '2024-08 16personalities.com' });
    expect(parsed.note).toBe('2024-08 16personalities.com');
  });

  it('rejects a lowercase type', () => {
    expect(MbtiDataSchema.safeParse({ type: 'enfp' }).success).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(MbtiDataSchema.safeParse({ type: 'XXXX' }).success).toBe(false);
  });

  it('rejects missing type', () => {
    expect(MbtiDataSchema.safeParse({}).success).toBe(false);
  });
});

describe('MBTI_DESCRIPTIONS', () => {
  it('renders each type as 4-dimension expansion (no career stereotypes)', () => {
    expect(MBTI_DESCRIPTIONS.INTJ).toBe('内倾 · 直觉 · 思维 · 判断');
    expect(MBTI_DESCRIPTIONS.ENFP).toBe('外倾 · 直觉 · 情感 · 感知');
  });

  it('never references career stereotypes', () => {
    const blocklist = ['建筑师', '指挥官', '竞选者', '物流师', '总经理', '提倡者', '逻辑学家'];
    for (const cliché of blocklist) {
      for (const label of Object.values(MBTI_DESCRIPTIONS)) {
        expect(label).not.toContain(cliché);
      }
    }
  });
});

describe('mbtiLetters', () => {
  it('splits the 4-letter type code', () => {
    expect(mbtiLetters('ENFP')).toEqual(['E', 'N', 'F', 'P']);
    expect(mbtiLetters('INTJ')).toEqual(['I', 'N', 'T', 'J']);
  });
});

describe('mbtiPromptFragment', () => {
  it('renders the type code plus 4 dimension descriptions', () => {
    const out = mbtiPromptFragment({ type: 'ENFP' });
    expect(out).toContain('**ENFP**');
    expect(out).toContain('外倾 (E)');
    expect(out).toContain('直觉 (N)');
    expect(out).toContain('情感 (F)');
    expect(out).toContain('感知 (P)');
  });

  it('omits career-stereotype labels', () => {
    const out = mbtiPromptFragment({ type: 'ENFP' });
    expect(out).not.toContain('竞选者');
    expect(out).not.toContain('创造者');
  });

  it('includes Pittenger 1993 critique reference', () => {
    const out = mbtiPromptFragment({ type: 'INTJ' });
    expect(out).toMatch(/Pittenger/);
    expect(out).toMatch(/辅助参考|不构成职业诊断/);
  });

  it('includes the note line when note is non-empty', () => {
    const out = mbtiPromptFragment({ type: 'INTJ', note: '自我评估' });
    expect(out).toMatch(/用户备注:\s*自我评估/);
  });

  it('omits the note line for empty or whitespace-only note', () => {
    expect(mbtiPromptFragment({ type: 'INTJ' })).not.toMatch(/用户备注/);
    expect(mbtiPromptFragment({ type: 'INTJ', note: '   ' })).not.toMatch(/用户备注/);
  });

  it('exposes the same dimension labels for all 16 types', () => {
    for (const type of Object.keys(MBTI_DESCRIPTIONS)) {
      const out = mbtiPromptFragment({ type: type as keyof typeof MBTI_DESCRIPTIONS });
      for (const letter of mbtiLetters(type as keyof typeof MBTI_DESCRIPTIONS)) {
        expect(out).toContain(MBTI_DIMENSION_LABEL[letter]);
      }
    }
  });
});

describe('mbtiPlugin definition', () => {
  it('is a core-category plugin with id "mbti"', () => {
    expect(mbtiPlugin.id).toBe('mbti');
    expect(mbtiPlugin.category).toBe('core');
  });

  it('description references Pittenger 1993 + non-diagnostic framing', () => {
    expect(mbtiPlugin.description).toMatch(/Pittenger/);
  });

  it('emptyData passes its own schema', () => {
    expect(mbtiPlugin.schema.safeParse(mbtiPlugin.emptyData()).success).toBe(true);
  });
});
