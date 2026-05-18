import { UserContext, LegacyProfile, ResumeStructured, LegacyV1ResumeProfile } from '../types';

export const USER_CONTEXT_V1_KEY = 'tianming_user_context_v1';
export const USER_CONTEXT_KEY = 'tianming_user_context_v2';
const LEGACY_PROFILE_KEY = 'career_navigator_profile';

export const DEFAULT_USER_CONTEXT: UserContext = {
  personas: [],
  resumes: [],
  preferences: {
    displayName: '阿棠',
    backgroundSummary:
      'NUS DSML硕士(GPA 4.5), 纯数背景(GPA 4.43), 汉学副修, Lean 4形式化验证, 擅长汉语写作(情感流), 英语口语一般',
    astrologyProfile:
      '辛巳年辛卯月戊子日癸丑时。天府(守成/管理), 官禄天相(二把手), 身宫廉贪+文曲科(灵性/审美), 流年2026丙午(子午冲, 廉贞忌)',
    jobPreferences: '高薪, 策略/咨询/PM/技术分析方向, 0经验应届生, 避开纯底层代码，避开纯数学',
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

  const newResumes = v1.resumes.map((old) => ({
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
    personas: v1.personas as UserContext['personas'],
    resumes: newResumes,
    preferences: v1.preferences as UserContext['preferences'],
    activeResumeId: v1.activeResumeId,
    activePersonaIds: v1.activePersonaIds,
  };
}

export function loadUserContext(): UserContext {
  try {
    // Tier 1: v2 (current)
    const v2 = localStorage.getItem(USER_CONTEXT_KEY);
    if (v2) return JSON.parse(v2) as UserContext;

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
