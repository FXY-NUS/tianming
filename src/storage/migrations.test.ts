import { beforeEach, describe, expect, it } from 'vitest';
import type { LegacyProfile } from '../../types';
import { UserContextSchema } from '../core/types';
import { LEGACY_PROFILE_KEY, USER_CONTEXT_KEY } from './keys';
import { migrateLegacyProfileToUserContext, runUserContextMigration } from './migrations';

const fullLegacy: LegacyProfile = {
  name: '阿棠',
  bg: '23 岁，CS 应届',
  astrology: '射手座',
  preferences: '远程 / 北上深',
  resumeContent: '王阿棠 ｜ CS @ 某大学 2026 届',
};

describe('migrateLegacyProfileToUserContext', () => {
  it('lifts resumeContent into a single legacy ResumeProfile', () => {
    const ctx = migrateLegacyProfileToUserContext(fullLegacy);
    expect(ctx.resumes).toHaveLength(1);
    expect(ctx.resumes[0].rawText).toBe(fullLegacy.resumeContent);
    expect(ctx.resumes[0].label).toBe('导入版');
    expect(ctx.resumes[0].piiPolicy).toBe('keep');
    expect(ctx.activeResumeId).toBe(ctx.resumes[0].id);
    expect(ctx.personas).toEqual([]);
    expect(ctx.preferences).toEqual({});
    expect(ctx.activePersonaIds).toEqual([]);
    expect(UserContextSchema.safeParse(ctx).success).toBe(true);
  });

  it('produces a valid context with no resume when resumeContent is empty', () => {
    const ctx = migrateLegacyProfileToUserContext({ ...fullLegacy, resumeContent: '   ' });
    expect(ctx.resumes).toEqual([]);
    expect(ctx.activeResumeId).toBeUndefined();
    expect(UserContextSchema.safeParse(ctx).success).toBe(true);
  });
});

describe('runUserContextMigration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a fresh empty context when no legacy data exists', () => {
    const result = runUserContextMigration();
    expect(result.source).toBe('fresh');
    expect(result.context.resumes).toEqual([]);
    expect(result.context.personas).toEqual([]);
    expect(localStorage.getItem(USER_CONTEXT_KEY)).not.toBeNull();
  });

  it('migrates legacy profile into UserContext key and preserves legacy key', () => {
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(fullLegacy));

    const result = runUserContextMigration();

    expect(result.source).toBe('migrated');
    expect(result.context.resumes[0].rawText).toBe(fullLegacy.resumeContent);
    expect(localStorage.getItem(LEGACY_PROFILE_KEY)).toBe(JSON.stringify(fullLegacy));
    const persisted = JSON.parse(localStorage.getItem(USER_CONTEXT_KEY)!);
    expect(persisted.resumes[0].rawText).toBe(fullLegacy.resumeContent);
  });

  it('is idempotent — already-migrated context is returned untouched', () => {
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(fullLegacy));
    const first = runUserContextMigration();
    const stored = localStorage.getItem(USER_CONTEXT_KEY);

    const second = runUserContextMigration();

    expect(second.source).toBe('already-migrated');
    expect(second.context).toEqual(first.context);
    expect(localStorage.getItem(USER_CONTEXT_KEY)).toBe(stored);
  });

  it('falls back to legacy migration when new key holds corrupt JSON', () => {
    localStorage.setItem(USER_CONTEXT_KEY, '{not valid json');
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(fullLegacy));

    const result = runUserContextMigration();

    expect(result.source).toBe('migrated');
    expect(result.context.resumes[0].rawText).toBe(fullLegacy.resumeContent);
  });
});
