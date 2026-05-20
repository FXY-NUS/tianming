import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import type { Job, ResumeStructured, UserContext } from '../../types';
import { DEFAULT_USER_CONTEXT } from '../../services/userContextStorage';
import { TianmingDb, USER_CONTEXT_RECORD_ID } from './db';
import {
  loadJobsFromIndexedDb,
  loadUserContextFromIndexedDb,
  saveJobsToIndexedDb,
  saveUserContextToIndexedDb,
} from './repository';

const openedDbs: TianmingDb[] = [];
const NOW = '2026-05-20T04:00:00.000Z';

function createTestDb(): TianmingDb {
  const testDb = new TianmingDb(`tianming-repository-test-${crypto.randomUUID()}`);
  openedDbs.push(testDb);
  return testDb;
}

const emptyStructured: ResumeStructured = {
  basic: {},
  education: [],
  experience: [],
  skills: { hard: [], soft: [], languages: [], tools: [] },
  projects: [],
};

function makeJob(id: string, importedAt: string): Job {
  return {
    id,
    title: `Job ${id}`,
    company: 'Acme',
    url: '',
    content: 'Build products',
    salary_text: 'Negotiable',
    status: 'New',
    importedAt,
    tags: [],
    chatHistory: [],
  };
}

function makeUserContext(): UserContext {
  return {
    ...DEFAULT_USER_CONTEXT,
    preferences: {
      ...DEFAULT_USER_CONTEXT.preferences,
      displayName: 'A Tang',
      preferredLocations: ['Singapore'],
    },
    personas: [
      {
        id: 'persona-1',
        type: 'mbti',
        label: 'MBTI',
        data: { type: 'INTJ' },
        createdAt: '2026-05-19T00:00:00.000Z',
      },
    ],
    resumes: [
      {
        id: 'resume-1',
        label: 'Tech',
        structured: emptyStructured,
        piiPolicy: 'keep',
        createdAt: '2026-05-19T00:00:00.000Z',
      },
    ],
    activeResumeId: 'resume-1',
    activePersonaIds: ['persona-1'],
    feedbackRecords: [
      {
        id: 'feedback-1',
        jobId: 'job-1',
        resumeId: 'resume-1',
        scoringVersion: 'phase4-scoring-v1.3',
        dimensionScores: { skill: 90 },
        userAction: 'save',
        createdAt: '2026-05-19T00:00:00.000Z',
      },
    ],
  };
}

afterEach(async () => {
  for (const testDb of openedDbs) {
    const name = testDb.name;
    testDb.close();
    await Dexie.delete(name);
  }
  openedDbs.length = 0;
});

describe('storage repository', () => {
  it('returns DEFAULT_USER_CONTEXT when IndexedDB has no user context record', async () => {
    const testDb = createTestDb();

    await expect(loadUserContextFromIndexedDb(testDb)).resolves.toEqual(DEFAULT_USER_CONTEXT);
  });

  it('saves and reloads UserContext across normalized stores', async () => {
    const testDb = createTestDb();
    const ctx = makeUserContext();

    await saveUserContextToIndexedDb(ctx, { targetDb: testDb, now: () => NOW });

    await expect(testDb.userContext.get(USER_CONTEXT_RECORD_ID)).resolves.toMatchObject({
      preferences: expect.objectContaining({ displayName: 'A Tang' }),
      activeResumeId: 'resume-1',
      updatedAt: NOW,
    });
    await expect(testDb.personas.count()).resolves.toBe(1);
    await expect(testDb.resumes.count()).resolves.toBe(1);
    await expect(testDb.feedbackRecords.count()).resolves.toBe(1);
    await expect(loadUserContextFromIndexedDb(testDb)).resolves.toEqual(ctx);
  });

  it('replaces stale personas, resumes, and feedbackRecords on save', async () => {
    const testDb = createTestDb();
    await saveUserContextToIndexedDb(makeUserContext(), { targetDb: testDb, now: () => NOW });

    const nextCtx: UserContext = {
      ...DEFAULT_USER_CONTEXT,
      preferences: { ...DEFAULT_USER_CONTEXT.preferences, displayName: 'Next' },
      personas: [],
      resumes: [],
      activePersonaIds: [],
      feedbackRecords: [],
    };

    await saveUserContextToIndexedDb(nextCtx, { targetDb: testDb, now: () => NOW });

    await expect(testDb.personas.count()).resolves.toBe(0);
    await expect(testDb.resumes.count()).resolves.toBe(0);
    await expect(testDb.feedbackRecords.count()).resolves.toBe(0);
    await expect(loadUserContextFromIndexedDb(testDb)).resolves.toEqual(nextCtx);
  });

  it('saves jobs and reloads them newest first', async () => {
    const testDb = createTestDb();
    const oldJob = makeJob('old', '2026-05-18T00:00:00.000Z');
    const newJob = makeJob('new', '2026-05-20T00:00:00.000Z');

    await saveJobsToIndexedDb([oldJob, newJob], { targetDb: testDb, now: () => NOW });

    await expect(testDb.jobs.count()).resolves.toBe(2);
    await expect(testDb.jobs.get('old')).resolves.toMatchObject({ updatedAt: NOW });
    await expect(loadJobsFromIndexedDb(testDb)).resolves.toEqual([newJob, oldJob]);
  });

  it('replaces stale jobs on save', async () => {
    const testDb = createTestDb();

    await saveJobsToIndexedDb(
      [makeJob('job-1', '2026-05-18T00:00:00.000Z'), makeJob('job-2', '2026-05-19T00:00:00.000Z')],
      { targetDb: testDb, now: () => NOW },
    );
    await saveJobsToIndexedDb([makeJob('job-3', '2026-05-20T00:00:00.000Z')], {
      targetDb: testDb,
      now: () => NOW,
    });

    await expect(testDb.jobs.count()).resolves.toBe(1);
    await expect(testDb.jobs.get('job-1')).resolves.toBeUndefined();
    await expect(loadJobsFromIndexedDb(testDb)).resolves.toEqual([
      makeJob('job-3', '2026-05-20T00:00:00.000Z'),
    ]);
  });
});
