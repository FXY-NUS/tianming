import { describe, expect, it } from 'vitest';
import { mbtiPlugin, mbtiPromptFragment } from './index';
import { MbtiDataSchema } from './schema';

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

describe('mbtiPromptFragment', () => {
  it('renders type with description', () => {
    const out = mbtiPromptFragment({ type: 'ENFP' });
    expect(out).toContain('**ENFP**');
    expect(out).toContain('竞选者');
  });

  it('includes the note line when note is non-empty', () => {
    const out = mbtiPromptFragment({ type: 'INTJ', note: '自我评估' });
    expect(out).toMatch(/用户备注:\s*自我评估/);
  });

  it('omits the note line for empty or whitespace-only note', () => {
    expect(mbtiPromptFragment({ type: 'INTJ' })).not.toMatch(/用户备注/);
    expect(mbtiPromptFragment({ type: 'INTJ', note: '   ' })).not.toMatch(/用户备注/);
  });
});

describe('mbtiPlugin definition', () => {
  it('is a core-category plugin with id "mbti"', () => {
    expect(mbtiPlugin.id).toBe('mbti');
    expect(mbtiPlugin.category).toBe('core');
  });

  it('emptyData passes its own schema', () => {
    expect(mbtiPlugin.schema.safeParse(mbtiPlugin.emptyData()).success).toBe(true);
  });
});
