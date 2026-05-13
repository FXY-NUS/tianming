import { beforeEach, describe, expect, it } from 'vitest';
import type { LegacyProfile, UserContext } from '../types';
import {
  DEFAULT_USER_CONTEXT,
  USER_CONTEXT_KEY,
  loadUserContext,
  saveUserContext,
} from './userContextStorage';

const LEGACY_PROFILE_KEY = 'career_navigator_profile';

const fullLegacy: LegacyProfile = {
  name: '阿棠',
  bg: '23 岁，CS 应届',
  astrology: '射手座',
  preferences: '远程 / 北上深',
  resumeContent: '王阿棠 ｜ CS @ 某大学 2026 届',
};

beforeEach(() => {
  localStorage.clear();
});

describe('loadUserContext', () => {
  it('returns DEFAULT_USER_CONTEXT when storage is empty', () => {
    const ctx = loadUserContext();
    expect(ctx).toEqual(DEFAULT_USER_CONTEXT);
  });

  it('returns the saved UserContext when the new key is present', () => {
    const saved: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      activePersonaIds: ['mbti-1'],
    };
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(saved));

    const ctx = loadUserContext();

    expect(ctx.activePersonaIds).toEqual(['mbti-1']);
  });

  it('migrates a full legacy profile into the new UserContext shape', () => {
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(fullLegacy));

    const ctx = loadUserContext();

    expect(ctx.preferences.displayName).toBe(fullLegacy.name);
    expect(ctx.preferences.backgroundSummary).toBe(fullLegacy.bg);
    expect(ctx.preferences.astrologyProfile).toBe(fullLegacy.astrology);
    expect(ctx.preferences.jobPreferences).toBe(fullLegacy.preferences);
    expect(ctx.preferences.preferredLocations).toEqual([]);
    expect(ctx.preferences.avoidKeywords).toEqual([]);
    expect(ctx.resumes).toHaveLength(1);
    expect(ctx.resumes[0].id).toBe('resume-legacy');
    expect(ctx.resumes[0].content).toBe(fullLegacy.resumeContent);
    expect(ctx.activeResumeId).toBe('resume-legacy');
  });

  it('persists the migrated context to the new key so the next load is a fast path', () => {
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(fullLegacy));

    loadUserContext();

    const persisted = localStorage.getItem(USER_CONTEXT_KEY);
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted!).preferences.displayName).toBe(fullLegacy.name);
  });

  it('treats whitespace-only resumeContent as empty (no resume created)', () => {
    localStorage.setItem(
      LEGACY_PROFILE_KEY,
      JSON.stringify({ ...fullLegacy, resumeContent: '   ' }),
    );

    const ctx = loadUserContext();

    expect(ctx.resumes).toEqual([]);
    expect(ctx.activeResumeId).toBeUndefined();
  });

  it('falls back to DEFAULT values for missing legacy fields', () => {
    const sparse: LegacyProfile = {
      name: '',
      bg: '',
      astrology: '',
      preferences: '',
      resumeContent: '',
    };
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(sparse));

    const ctx = loadUserContext();

    expect(ctx.preferences.displayName).toBe(DEFAULT_USER_CONTEXT.preferences.displayName);
    expect(ctx.preferences.backgroundSummary).toBe(
      DEFAULT_USER_CONTEXT.preferences.backgroundSummary,
    );
    expect(ctx.preferences.astrologyProfile).toBe(
      DEFAULT_USER_CONTEXT.preferences.astrologyProfile,
    );
    expect(ctx.preferences.jobPreferences).toBe(DEFAULT_USER_CONTEXT.preferences.jobPreferences);
    expect(ctx.resumes).toEqual([]);
  });

  it('is effectively idempotent — second load returns the saved context', () => {
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(fullLegacy));

    const first = loadUserContext();
    const persistedAfterFirst = localStorage.getItem(USER_CONTEXT_KEY);

    const second = loadUserContext();

    expect(second).toEqual(first);
    expect(localStorage.getItem(USER_CONTEXT_KEY)).toBe(persistedAfterFirst);
  });

  it('falls back to DEFAULT when the new-key JSON is corrupt', () => {
    localStorage.setItem(USER_CONTEXT_KEY, '{not valid json');

    const ctx = loadUserContext();

    expect(ctx).toEqual(DEFAULT_USER_CONTEXT);
  });

  it('falls back to DEFAULT when the legacy JSON is corrupt', () => {
    localStorage.setItem(LEGACY_PROFILE_KEY, '{this is broken');

    const ctx = loadUserContext();

    expect(ctx).toEqual(DEFAULT_USER_CONTEXT);
  });

  it('prefers the new key over the legacy key when both are present', () => {
    const saved: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      preferences: { ...DEFAULT_USER_CONTEXT.preferences, displayName: 'saved-wins' },
    };
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(saved));
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(fullLegacy));

    const ctx = loadUserContext();

    expect(ctx.preferences.displayName).toBe('saved-wins');
  });
});

describe('saveUserContext', () => {
  it('round-trips through localStorage', () => {
    const ctx: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      preferences: { ...DEFAULT_USER_CONTEXT.preferences, displayName: 'round-trip' },
    };

    saveUserContext(ctx);

    expect(loadUserContext()).toEqual(ctx);
  });
});
