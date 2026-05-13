import { UserContext, LegacyProfile } from '../types';

export const USER_CONTEXT_KEY = 'tianming_user_context_v1';
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

export function loadUserContext(): UserContext {
  try {
    const saved = localStorage.getItem(USER_CONTEXT_KEY);
    if (saved) return JSON.parse(saved) as UserContext;

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
