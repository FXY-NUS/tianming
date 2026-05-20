import { liveQuery } from 'dexie';
import type { Job, PersonaInstance, ResumeProfile, UserContext } from '../../types';
import { DEFAULT_USER_CONTEXT } from '../../services/userContextStorage';
import type { MatchFeedbackRecord } from '../core/matchTypes';
import {
  USER_CONTEXT_RECORD_ID,
  db,
  type FeedbackRecord,
  type JobRecord,
  type PersonaRecord,
  type ResumeRecord,
  type TianmingDb,
} from './db';

type Unsubscribe = () => void;

interface StorageOptions {
  targetDb?: TianmingDb;
  now?: () => string;
}

type StorageErrorHandler = (error: unknown) => void;

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

function toPersonaRecord(persona: PersonaInstance, updatedAt: string): PersonaRecord {
  return { ...persona, updatedAt };
}

function toResumeRecord(resume: ResumeProfile, updatedAt: string): ResumeRecord {
  return { ...resume, updatedAt };
}

function toFeedbackRecord(feedback: MatchFeedbackRecord, updatedAt: string): FeedbackRecord {
  return { ...feedback, updatedAt };
}

function toJobRecord(job: Job, updatedAt: string): JobRecord {
  return { ...job, updatedAt };
}

function fromPersonaRecord(record: PersonaRecord): PersonaInstance {
  const { updatedAt: _updatedAt, ...persona } = record;
  return persona;
}

function fromResumeRecord(record: ResumeRecord): ResumeProfile {
  const { updatedAt: _updatedAt, ...resume } = record;
  return resume;
}

function fromFeedbackRecord(record: FeedbackRecord): MatchFeedbackRecord {
  const { updatedAt: _updatedAt, ...feedback } = record;
  return feedback;
}

function fromJobRecord(record: JobRecord): Job {
  const { updatedAt: _updatedAt, ...job } = record;
  return job;
}

export async function loadUserContextFromIndexedDb(
  targetDb: TianmingDb = db,
): Promise<UserContext> {
  const [record, personas, resumes, feedbackRecords] = await Promise.all([
    targetDb.userContext.get(USER_CONTEXT_RECORD_ID),
    targetDb.personas.orderBy('createdAt').toArray(),
    targetDb.resumes.orderBy('createdAt').toArray(),
    targetDb.feedbackRecords.orderBy('createdAt').toArray(),
  ]);

  if (!record) return DEFAULT_USER_CONTEXT;

  return normalizeUserContext({
    personas: personas.map(fromPersonaRecord),
    resumes: resumes.map(fromResumeRecord),
    preferences: record.preferences,
    activeResumeId: record.activeResumeId,
    activePersonaIds: record.activePersonaIds,
    feedbackRecords: feedbackRecords.map(fromFeedbackRecord),
  });
}

export async function saveUserContextToIndexedDb(
  ctx: UserContext,
  options: StorageOptions = {},
): Promise<void> {
  const targetDb = options.targetDb ?? db;
  const updatedAt = options.now?.() ?? new Date().toISOString();
  const normalized = normalizeUserContext(ctx);
  const personaRecords = normalized.personas.map((persona) => toPersonaRecord(persona, updatedAt));
  const resumeRecords = normalized.resumes.map((resume) => toResumeRecord(resume, updatedAt));
  const feedbackRecords = normalized.feedbackRecords.map((feedback) =>
    toFeedbackRecord(feedback, updatedAt),
  );

  await targetDb.transaction(
    'rw',
    targetDb.userContext,
    targetDb.personas,
    targetDb.resumes,
    targetDb.feedbackRecords,
    async () => {
      await targetDb.personas.clear();
      await targetDb.resumes.clear();
      await targetDb.feedbackRecords.clear();

      await targetDb.userContext.put({
        id: USER_CONTEXT_RECORD_ID,
        schemaVersion: 1,
        preferences: normalized.preferences,
        activeResumeId: normalized.activeResumeId,
        activePersonaIds: normalized.activePersonaIds,
        updatedAt,
      });

      if (personaRecords.length > 0) await targetDb.personas.bulkPut(personaRecords);
      if (resumeRecords.length > 0) await targetDb.resumes.bulkPut(resumeRecords);
      if (feedbackRecords.length > 0) await targetDb.feedbackRecords.bulkPut(feedbackRecords);
    },
  );
}

export async function loadJobsFromIndexedDb(targetDb: TianmingDb = db): Promise<Job[]> {
  const records = await targetDb.jobs.orderBy('importedAt').reverse().toArray();
  return records.map(fromJobRecord);
}

export async function saveJobsToIndexedDb(
  jobs: Job[],
  options: StorageOptions = {},
): Promise<void> {
  const targetDb = options.targetDb ?? db;
  const updatedAt = options.now?.() ?? new Date().toISOString();
  const jobRecords = jobs.map((job) => toJobRecord(job, updatedAt));

  await targetDb.transaction('rw', targetDb.jobs, async () => {
    await targetDb.jobs.clear();
    if (jobRecords.length > 0) await targetDb.jobs.bulkPut(jobRecords);
  });
}

export function subscribeUserContextFromIndexedDb(
  onChange: (ctx: UserContext) => void,
  onError: StorageErrorHandler,
  targetDb: TianmingDb = db,
): Unsubscribe {
  const subscription = liveQuery(() => loadUserContextFromIndexedDb(targetDb)).subscribe({
    next: onChange,
    error: onError,
  });
  return () => subscription.unsubscribe();
}

export function subscribeJobsFromIndexedDb(
  onChange: (jobs: Job[]) => void,
  onError: StorageErrorHandler,
  targetDb: TianmingDb = db,
): Unsubscribe {
  const subscription = liveQuery(() => loadJobsFromIndexedDb(targetDb)).subscribe({
    next: onChange,
    error: onError,
  });
  return () => subscription.unsubscribe();
}
