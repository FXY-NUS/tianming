import { describe, expect, it } from 'vitest';
import type { LegacyProfile } from '../../types';
import { legacyProfileView, syncResumeFromLegacy } from './legacyAdapter';
import { EMPTY_USER_CONTEXT, type UserContext } from './types';

const legacy: LegacyProfile = {
  name: '阿棠',
  bg: 'bg',
  astrology: 'astro',
  preferences: 'pref',
  resumeContent: '简历文本 v1',
};

describe('legacyProfileView', () => {
  it('returns the legacy profile unchanged when no active resume exists', () => {
    expect(legacyProfileView(EMPTY_USER_CONTEXT, legacy)).toEqual(legacy);
  });

  it('overrides resumeContent with the active resume rawText', () => {
    const ctx = syncResumeFromLegacy(EMPTY_USER_CONTEXT, legacy);
    const updatedLegacy = { ...legacy, resumeContent: 'stale' };

    const view = legacyProfileView(ctx, updatedLegacy);

    expect(view.resumeContent).toBe(legacy.resumeContent);
    expect(view.bg).toBe(updatedLegacy.bg);
  });
});

describe('syncResumeFromLegacy', () => {
  it('is a no-op when resumeContent is blank', () => {
    const result = syncResumeFromLegacy(EMPTY_USER_CONTEXT, { ...legacy, resumeContent: '  ' });
    expect(result).toEqual(EMPTY_USER_CONTEXT);
  });

  it('creates the first resume and marks it active', () => {
    const result = syncResumeFromLegacy(EMPTY_USER_CONTEXT, legacy);
    expect(result.resumes).toHaveLength(1);
    expect(result.resumes[0].rawText).toBe(legacy.resumeContent);
    expect(result.activeResumeId).toBe(result.resumes[0].id);
  });

  it('updates the rawText of the existing active resume', () => {
    const first = syncResumeFromLegacy(EMPTY_USER_CONTEXT, legacy);
    const second = syncResumeFromLegacy(first, { ...legacy, resumeContent: '简历文本 v2' });

    expect(second.resumes).toHaveLength(1);
    expect(second.resumes[0].rawText).toBe('简历文本 v2');
    expect(second.activeResumeId).toBe(first.activeResumeId);
  });

  it('does not mutate the input context', () => {
    const before: UserContext = JSON.parse(JSON.stringify(EMPTY_USER_CONTEXT));
    syncResumeFromLegacy(before, legacy);
    expect(before).toEqual(EMPTY_USER_CONTEXT);
  });
});
