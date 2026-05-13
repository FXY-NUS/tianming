import type { LegacyProfile } from '../../types';
import {
  EMPTY_RESUME_STRUCTURED,
  EMPTY_USER_CONTEXT,
  UserContextSchema,
  type UserContext,
} from '../core/types';
import { LEGACY_PROFILE_KEY, USER_CONTEXT_KEY } from './keys';

export type MigrationSource = 'fresh' | 'migrated' | 'already-migrated';

export interface MigrationResult {
  context: UserContext;
  source: MigrationSource;
}

const LEGACY_RESUME_ID = 'legacy-import';

export function migrateLegacyProfileToUserContext(legacy: LegacyProfile): UserContext {
  const ctx: UserContext = {
    personas: [],
    resumes: [],
    preferences: {},
    activePersonaIds: [],
  };

  if (legacy.resumeContent && legacy.resumeContent.trim().length > 0) {
    ctx.resumes.push({
      id: LEGACY_RESUME_ID,
      label: '导入版',
      rawText: legacy.resumeContent,
      structured: EMPTY_RESUME_STRUCTURED,
      piiPolicy: 'keep',
      createdAt: new Date().toISOString(),
    });
    ctx.activeResumeId = LEGACY_RESUME_ID;
  }

  return ctx;
}

export function runUserContextMigration(storage: Storage = window.localStorage): MigrationResult {
  const existingRaw = storage.getItem(USER_CONTEXT_KEY);
  if (existingRaw) {
    try {
      const parsed = UserContextSchema.safeParse(JSON.parse(existingRaw));
      if (parsed.success) {
        return { context: parsed.data, source: 'already-migrated' };
      }
    } catch {
      // fall through and rebuild
    }
  }

  const legacyRaw = storage.getItem(LEGACY_PROFILE_KEY);
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw) as LegacyProfile;
      const context = migrateLegacyProfileToUserContext(legacy);
      storage.setItem(USER_CONTEXT_KEY, JSON.stringify(context));
      return { context, source: 'migrated' };
    } catch {
      // legacy JSON corrupt — fall through to fresh
    }
  }

  storage.setItem(USER_CONTEXT_KEY, JSON.stringify(EMPTY_USER_CONTEXT));
  return { context: EMPTY_USER_CONTEXT, source: 'fresh' };
}
