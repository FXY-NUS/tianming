import type { Job, PersonaInstance, ResumeProfile, UserContext } from '../../types';
import {
  DEFAULT_USER_CONTEXT,
  USER_CONTEXT_KEY,
  USER_CONTEXT_V1_KEY,
  loadUserContext,
} from '../../services/userContextStorage';
import {
  LOCAL_STORAGE_MIGRATION_META_ID,
  USER_CONTEXT_RECORD_ID,
  db,
  type FeedbackRecord,
  type JobRecord,
  type PersonaRecord,
  type ResumeRecord,
  type TianmingDb,
} from './db';

export const LEGACY_PROFILE_KEY = 'career_navigator_profile';
export const LEGACY_JOBS_KEY = 'career_navigator_jobs_v10';
export const LEGACY_USAGE_KEY = 'career_navigator_usage_v4';
export const LEGACY_BACKUP_PREFIX = 'tianming_legacy_backup:';

export const LEGACY_LOCAL_STORAGE_KEYS = [
  USER_CONTEXT_KEY,
  USER_CONTEXT_V1_KEY,
  LEGACY_PROFILE_KEY,
  LEGACY_JOBS_KEY,
  LEGACY_USAGE_KEY,
] as const;

export interface LocalStorageMigrationSummary {
  alreadyMigrated: boolean;
  userContextMigrated: boolean;
  personas: number;
  resumes: number;
  jobs: number;
  feedbackRecords: number;
  rawFileRefsMissingBlobs: number;
  legacyKeysBackedUp: string[];
  migratedAt?: string;
  skippedReason?: 'localStorage-unavailable';
}

export interface LocalStorageMigrationOptions {
  targetDb?: TianmingDb;
  now?: () => string;
  force?: boolean;
  backupLegacyKeys?: boolean;
}

function emptySummary(): LocalStorageMigrationSummary {
  return {
    alreadyMigrated: false,
    userContextMigrated: false,
    personas: 0,
    resumes: 0,
    jobs: 0,
    feedbackRecords: 0,
    rawFileRefsMissingBlobs: 0,
    legacyKeysBackedUp: [],
  };
}

function getLocalStorage(): Storage | undefined {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  const maybeGlobal = globalThis as typeof globalThis & { localStorage?: Storage };
  return maybeGlobal.localStorage;
}

function normalizeUserContext(ctx: UserContext): UserContext {
  return {
    ...DEFAULT_USER_CONTEXT,
    ...ctx,
    preferences: {
      ...DEFAULT_USER_CONTEXT.preferences,
      ...ctx.preferences,
    },
    personas: Array.isArray(ctx.personas) ? ctx.personas : [],
    resumes: Array.isArray(ctx.resumes) ? ctx.resumes : [],
    activePersonaIds: Array.isArray(ctx.activePersonaIds) ? ctx.activePersonaIds : [],
    feedbackRecords: Array.isArray(ctx.feedbackRecords) ? ctx.feedbackRecords : [],
  };
}

function readLegacyJobs(storage: Storage): Job[] {
  const raw = storage.getItem(LEGACY_JOBS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Job => {
          if (!item || typeof item !== 'object') return false;
          const job = item as Partial<Job>;
          return typeof job.id === 'string' && typeof job.title === 'string';
        })
      : [];
  } catch {
    return [];
  }
}

function backupLegacyLocalStorageKeys(storage: Storage): string[] {
  const backedUp: string[] = [];

  LEGACY_LOCAL_STORAGE_KEYS.forEach((key) => {
    const value = storage.getItem(key);
    if (value === null) return;

    const backupKey = `${LEGACY_BACKUP_PREFIX}${key}`;
    if (storage.getItem(backupKey) === null) {
      storage.setItem(backupKey, value);
    }
    backedUp.push(key);
  });

  return backedUp;
}

function toPersonaRecord(persona: PersonaInstance, updatedAt: string): PersonaRecord {
  return { ...persona, updatedAt };
}

function toResumeRecord(resume: ResumeProfile, updatedAt: string): ResumeRecord {
  return { ...resume, updatedAt };
}

function toJobRecord(job: Job, updatedAt: string): JobRecord {
  return { ...job, updatedAt };
}

function toFeedbackRecord(
  feedback: NonNullable<UserContext['feedbackRecords']>[number],
  updatedAt: string,
): FeedbackRecord {
  return { ...feedback, updatedAt };
}

export async function migrateLocalStorageToIndexedDb(
  options: LocalStorageMigrationOptions = {},
): Promise<LocalStorageMigrationSummary> {
  const targetDb = options.targetDb ?? db;
  const storage = getLocalStorage();
  const summary = emptySummary();

  if (!storage) {
    return { ...summary, skippedReason: 'localStorage-unavailable' };
  }

  const existingMigration = await targetDb.meta.get(LOCAL_STORAGE_MIGRATION_META_ID);
  if (existingMigration && !options.force) {
    return {
      ...summary,
      alreadyMigrated: true,
      migratedAt:
        typeof existingMigration.value === 'object' &&
        existingMigration.value !== null &&
        'migratedAt' in existingMigration.value
          ? String(existingMigration.value.migratedAt)
          : existingMigration.createdAt,
    };
  }

  const migratedAt = options.now?.() ?? new Date().toISOString();
  const legacyKeysBackedUp =
    options.backupLegacyKeys === false ? [] : backupLegacyLocalStorageKeys(storage);
  const userContext = normalizeUserContext(loadUserContext());
  const jobs = readLegacyJobs(storage);
  const rawFileRefsMissingBlobs = userContext.resumes.filter(
    (resume) => !!resume.rawFileRef?.blobId,
  ).length;

  const personaRecords = userContext.personas.map((persona) =>
    toPersonaRecord(persona, migratedAt),
  );
  const resumeRecords = userContext.resumes.map((resume) => toResumeRecord(resume, migratedAt));
  const jobRecords = jobs.map((job) => toJobRecord(job, migratedAt));
  const feedbackRecords = userContext.feedbackRecords.map((feedback) =>
    toFeedbackRecord(feedback, migratedAt),
  );

  await targetDb.transaction(
    'rw',
    [
      targetDb.userContext,
      targetDb.personas,
      targetDb.resumes,
      targetDb.jobs,
      targetDb.feedbackRecords,
      targetDb.meta,
    ],
    async () => {
      await targetDb.personas.clear();
      await targetDb.resumes.clear();
      await targetDb.jobs.clear();
      await targetDb.feedbackRecords.clear();

      await targetDb.userContext.put({
        id: USER_CONTEXT_RECORD_ID,
        schemaVersion: 1,
        preferences: userContext.preferences,
        activeResumeId: userContext.activeResumeId,
        activePersonaIds: userContext.activePersonaIds,
        updatedAt: migratedAt,
      });

      if (personaRecords.length > 0) await targetDb.personas.bulkPut(personaRecords);
      if (resumeRecords.length > 0) await targetDb.resumes.bulkPut(resumeRecords);
      if (jobRecords.length > 0) await targetDb.jobs.bulkPut(jobRecords);
      if (feedbackRecords.length > 0) await targetDb.feedbackRecords.bulkPut(feedbackRecords);

      await targetDb.meta.put({
        id: LOCAL_STORAGE_MIGRATION_META_ID,
        value: {
          migratedAt,
          source: 'localStorage',
          legacyKeysBackedUp,
          rawFileRefsMissingBlobs,
        },
        createdAt: migratedAt,
        updatedAt: migratedAt,
      });
    },
  );

  return {
    alreadyMigrated: false,
    userContextMigrated: true,
    personas: personaRecords.length,
    resumes: resumeRecords.length,
    jobs: jobRecords.length,
    feedbackRecords: feedbackRecords.length,
    rawFileRefsMissingBlobs,
    legacyKeysBackedUp,
    migratedAt,
  };
}
