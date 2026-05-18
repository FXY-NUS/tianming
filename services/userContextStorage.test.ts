import { beforeEach, describe, expect, it } from 'vitest';
import type { LegacyProfile, UserContext } from '../types';
import {
  DEFAULT_USER_CONTEXT,
  USER_CONTEXT_KEY,
  USER_CONTEXT_V1_KEY,
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

const v1Context: UserContext = {
  ...DEFAULT_USER_CONTEXT,
  resumes: [
    {
      id: 'resume-1',
      name: '技术岗版',
      content: '计算机科学与技术相关经历',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
    },
  ],
  activeResumeId: 'resume-1',
  activePersonaIds: ['mbti-1'],
};

beforeEach(() => {
  localStorage.clear();
});

describe('loadUserContext', () => {
  it('returns DEFAULT_USER_CONTEXT when storage is empty', () => {
    const ctx = loadUserContext();
    expect(ctx).toEqual(DEFAULT_USER_CONTEXT);
  });

  // ─── V2 scenarios ───────────────────────────────────────────────────────

  it('loads a v2 context directly when v2 key is present', () => {
    const v2: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      activePersonaIds: ['big5-1'],
    };
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(v2));

    const ctx = loadUserContext();

    expect(ctx.activePersonaIds).toEqual(['big5-1']);
  });

  // ─── V1 scenarios ───────────────────────────────────────────────────────

  it('migrates v1 ResumeProfile to v2 format', () => {
    localStorage.setItem(USER_CONTEXT_V1_KEY, JSON.stringify(v1Context));

    const ctx = loadUserContext();

    expect(ctx.resumes).toHaveLength(1);
    expect(ctx.resumes[0].id).toBe('resume-1');
    expect(ctx.resumes[0].label).toBe('技术岗版'); // old name → new label
    expect(ctx.resumes[0].structured).toBeDefined();
    expect(ctx.resumes[0].structured.basic).toEqual({});
    expect(ctx.resumes[0].structured.education).toEqual([]);
    expect(ctx.resumes[0].structured.skills).toEqual({
      hard: [],
      soft: [],
      languages: [],
      tools: [],
    });
    expect(ctx.resumes[0].piiPolicy).toBe('keep');
    expect(ctx.resumes[0].createdAt).toBe('2025-01-01T00:00:00Z');
    // updatedAt is dropped; rawText preserves v1 plain-text content so no data loss
    expect((ctx.resumes[0] as any).updatedAt).toBeUndefined();
    expect(ctx.resumes[0].rawText).toBe('计算机科学与技术相关经历');
  });

  it('migrates v1 resume with empty content to rawText undefined', () => {
    const v1Empty: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      resumes: [
        {
          id: 'resume-blank',
          name: '空白版',
          content: '',
          createdAt: '2025-01-01T00:00:00Z',
        } as any,
      ],
      activeResumeId: 'resume-blank',
      activePersonaIds: [],
    };
    localStorage.setItem(USER_CONTEXT_V1_KEY, JSON.stringify(v1Empty));

    const ctx = loadUserContext();
    expect(ctx.resumes[0].rawText).toBeUndefined();
  });

  it('migrates v1 and persists to v2 key so next load is fast', () => {
    localStorage.setItem(USER_CONTEXT_V1_KEY, JSON.stringify(v1Context));

    loadUserContext();

    const persisted = localStorage.getItem(USER_CONTEXT_KEY);
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.resumes[0].label).toBe('技术岗版');
  });

  it('handles v1 with empty resume list', () => {
    const v1Empty: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      resumes: [],
      activeResumeId: undefined,
    };
    localStorage.setItem(USER_CONTEXT_V1_KEY, JSON.stringify(v1Empty));

    const ctx = loadUserContext();

    expect(ctx.resumes).toEqual([]);
    expect(ctx.activeResumeId).toBeUndefined();
  });

  it('prefers v2 over v1 when both are present', () => {
    const v2: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      preferences: { ...DEFAULT_USER_CONTEXT.preferences, displayName: 'from-v2' },
    };
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(v2));
    localStorage.setItem(USER_CONTEXT_V1_KEY, JSON.stringify(v1Context));

    const ctx = loadUserContext();

    expect(ctx.preferences.displayName).toBe('from-v2');
  });

  // ─── Legacy scenarios ───────────────────────────────────────────────────

  it('migrates a full legacy profile into the new UserContext shape', () => {
    localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(fullLegacy));

    const ctx = loadUserContext();

    expect(ctx.preferences.displayName).toBe(fullLegacy.name);
    expect(ctx.preferences.backgroundSummary).toBe(fullLegacy.bg);
    expect(ctx.preferences.astrologyProfile).toBe(fullLegacy.astrology);
    expect(ctx.preferences.jobPreferences).toBe(fullLegacy.preferences);
    expect(ctx.resumes).toHaveLength(1);
    expect(ctx.resumes[0].id).toBe('resume-legacy');
    expect((ctx.resumes[0] as any).content).toBe(fullLegacy.resumeContent);
    expect(ctx.activeResumeId).toBe('resume-legacy');
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
  });

  // ─── Error scenarios ────────────────────────────────────────────────────

  it('falls back to DEFAULT when v2 JSON is corrupt', () => {
    localStorage.setItem(USER_CONTEXT_KEY, '{invalid json');

    const ctx = loadUserContext();

    expect(ctx).toEqual(DEFAULT_USER_CONTEXT);
  });

  it('falls back to DEFAULT when v1 JSON is corrupt', () => {
    localStorage.setItem(USER_CONTEXT_V1_KEY, '{invalid json');

    const ctx = loadUserContext();

    expect(ctx).toEqual(DEFAULT_USER_CONTEXT);
  });

  it('falls back to DEFAULT when legacy JSON is corrupt', () => {
    localStorage.setItem(LEGACY_PROFILE_KEY, '{invalid json');

    const ctx = loadUserContext();

    expect(ctx).toEqual(DEFAULT_USER_CONTEXT);
  });

  it('is idempotent — second load after v1 migration returns same context', () => {
    localStorage.setItem(USER_CONTEXT_V1_KEY, JSON.stringify(v1Context));

    const first = loadUserContext();
    const second = loadUserContext();

    expect(second).toEqual(first);
    expect(second.resumes[0].label).toBe('技术岗版');
  });

  // ─── PII policy scenarios ───────────────────────────────────────────────

  it('sets piiPolicy to "keep" by default in v1 migration', () => {
    localStorage.setItem(USER_CONTEXT_V1_KEY, JSON.stringify(v1Context));

    const ctx = loadUserContext();

    expect(ctx.resumes[0].piiPolicy).toBe('keep');
  });
});

describe('saveUserContext', () => {
  it('round-trips through localStorage using v2 key', () => {
    const ctx: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      preferences: { ...DEFAULT_USER_CONTEXT.preferences, displayName: 'round-trip' },
    };

    saveUserContext(ctx);

    expect(loadUserContext()).toEqual(ctx);
  });

  it('saves to USER_CONTEXT_KEY (v2), not v1 key', () => {
    const ctx = DEFAULT_USER_CONTEXT;
    saveUserContext(ctx);

    expect(localStorage.getItem(USER_CONTEXT_KEY)).not.toBeNull();
    expect(localStorage.getItem(USER_CONTEXT_V1_KEY)).toBeNull();
  });
});
