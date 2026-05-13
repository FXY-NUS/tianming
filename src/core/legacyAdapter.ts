import type { LegacyProfile } from '../../types';
import { EMPTY_RESUME_STRUCTURED, type UserContext } from './types';

const LEGACY_RESUME_ID = 'legacy-import';

export function legacyProfileView(ctx: UserContext, legacy: LegacyProfile): LegacyProfile {
  const activeResume = ctx.activeResumeId
    ? ctx.resumes.find((r) => r.id === ctx.activeResumeId)
    : undefined;
  return {
    ...legacy,
    resumeContent: activeResume?.rawText ?? legacy.resumeContent,
  };
}

export function syncResumeFromLegacy(ctx: UserContext, legacy: LegacyProfile): UserContext {
  const text = (legacy.resumeContent ?? '').trim();
  if (!text) return ctx;

  const activeId = ctx.activeResumeId;
  const existing = activeId ? ctx.resumes.find((r) => r.id === activeId) : undefined;

  if (existing) {
    return {
      ...ctx,
      resumes: ctx.resumes.map((r) =>
        r.id === existing.id ? { ...r, rawText: legacy.resumeContent } : r,
      ),
    };
  }

  return {
    ...ctx,
    resumes: [
      ...ctx.resumes,
      {
        id: LEGACY_RESUME_ID,
        label: '导入版',
        rawText: legacy.resumeContent,
        structured: EMPTY_RESUME_STRUCTURED,
        piiPolicy: 'keep',
        createdAt: new Date().toISOString(),
      },
    ],
    activeResumeId: LEGACY_RESUME_ID,
  };
}
