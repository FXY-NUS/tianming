import { UserContext, LegacyProfile, ResumeStructured, LegacyV1ResumeProfile } from '../types';

export const USER_CONTEXT_V1_KEY = 'tianming_user_context_v1';
export const USER_CONTEXT_KEY = 'tianming_user_context_v2';
const LEGACY_PROFILE_KEY = 'career_navigator_profile';

export const DEFAULT_USER_CONTEXT: UserContext = {
  personas: [],
  resumes: [],
  preferences: {
    displayName: '',
    backgroundSummary: '',
    astrologyProfile: '',
    jobPreferences: '',
    preferredLocations: [],
    avoidKeywords: [],
  },
  activeResumeId: undefined,
  activePersonaIds: [],
};

function migrateFromLegacy(raw: string): UserContext {
  const p = JSON.parse(raw) as LegacyProfile;
  const hasResume = !!p.resumeContent?.trim();
  const resume = hasResume
    ? [
        {
          id: 'resume-legacy',
          name: '默认简历',
          content: p.resumeContent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
    : [];

  return {
    ...DEFAULT_USER_CONTEXT,
    preferences: {
      displayName: p.name || DEFAULT_USER_CONTEXT.preferences.displayName,
      backgroundSummary: p.bg || DEFAULT_USER_CONTEXT.preferences.backgroundSummary,
      astrologyProfile: p.astrology || DEFAULT_USER_CONTEXT.preferences.astrologyProfile,
      jobPreferences: p.preferences || DEFAULT_USER_CONTEXT.preferences.jobPreferences,
      preferredLocations: [],
      avoidKeywords: [],
    },
    resumes: resume,
    activeResumeId: hasResume ? 'resume-legacy' : undefined,
  };
}

function isValidUserContext(obj: unknown): obj is UserContext {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    Array.isArray(o.personas) &&
    Array.isArray(o.resumes) &&
    !!o.preferences &&
    typeof o.preferences === 'object' &&
    Array.isArray(o.activePersonaIds)
  );
}

function normalizePreferences(p: unknown): UserContext['preferences'] {
  if (!p || typeof p !== 'object') return { ...DEFAULT_USER_CONTEXT.preferences };
  const obj = p as Record<string, unknown>;
  const stringArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    displayName: str(obj.displayName),
    backgroundSummary: str(obj.backgroundSummary),
    astrologyProfile: str(obj.astrologyProfile),
    jobPreferences: str(obj.jobPreferences),
    preferredLocations: stringArr(obj.preferredLocations),
    avoidKeywords: stringArr(obj.avoidKeywords),
  };
}

function migrateFromV1(raw: string): UserContext {
  interface V1UserContext {
    personas: unknown[];
    resumes: Array<{
      id: string;
      name: string;
      content: string;
      createdAt: string;
      updatedAt?: string;
    }>;
    preferences: unknown;
    activeResumeId?: string;
    activePersonaIds: string[];
  }

  const v1 = JSON.parse(raw) as V1UserContext;

  const newResumes = (Array.isArray(v1.resumes) ? v1.resumes : []).map((old) => ({
    id: old.id,
    label: old.name,
    // Preserve v1 plain-text content as rawText so users don't lose data;
    // new Phase 3 uploads still leave rawText undefined per Q1=B.
    rawText: old.content || undefined,
    rawFileRef: undefined,
    structured: {
      basic: {},
      education: [],
      experience: [],
      skills: { hard: [], soft: [], languages: [], tools: [] },
      projects: [],
    } as ResumeStructured,
    piiPolicy: 'keep' as const,
    createdAt: old.createdAt,
  }));

  return {
    personas: Array.isArray(v1.personas) ? (v1.personas as UserContext['personas']) : [],
    resumes: newResumes,
    preferences: normalizePreferences(v1.preferences),
    activeResumeId: v1.activeResumeId,
    activePersonaIds: Array.isArray(v1.activePersonaIds) ? v1.activePersonaIds : [],
  };
}

export function loadUserContext(): UserContext {
  try {
    // Tier 1: v2 (current)
    const v2 = localStorage.getItem(USER_CONTEXT_KEY);
    if (v2) {
      const parsed = JSON.parse(v2);
      if (isValidUserContext(parsed)) return parsed;
      // malformed v2 — fall through to lower tiers
    }

    // Tier 2: v1 (Phase 1/2)
    const v1 = localStorage.getItem(USER_CONTEXT_V1_KEY);
    if (v1) {
      const migrated = migrateFromV1(v1);
      saveUserContext(migrated);
      return migrated;
    }

    // Tier 3: legacy (V7.0 baseline)
    const legacy = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (legacy) {
      const migrated = migrateFromLegacy(legacy);
      saveUserContext(migrated);
      return migrated;
    }
  } catch {
    // corrupt storage — fall through to default
  }
  return DEFAULT_USER_CONTEXT;
}

export function saveUserContext(ctx: UserContext): void {
  localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(ctx));
}
