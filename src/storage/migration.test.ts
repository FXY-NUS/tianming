import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Job, ResumeStructured, UserContext } from '../../types';
import {
  DEFAULT_USER_CONTEXT,
  USER_CONTEXT_KEY,
  USER_CONTEXT_V1_KEY,
} from '../../services/userContextStorage';
import { LOCAL_STORAGE_MIGRATION_META_ID, TianmingDb, USER_CONTEXT_RECORD_ID } from './db';
import {
  LEGACY_BACKUP_PREFIX,
  LEGACY_JOBS_KEY,
  LEGACY_PROFILE_KEY,
  migrateLocalStorageToIndexedDb,
} from './migration';

const openedDbs: TianmingDb[] = [];
const NOW = '2026-05-20T00:00:00.000Z';

function createTestDb(): TianmingDb {
  const testDb = new TianmingDb(`tianming-migration-test-${crypto.randomUUID()}`);
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

const sampleJob: Job = {
  id: 'job-1',
  title: 'Frontend Intern',
  company: 'Acme',
  url: 'https://example.com/job-1',
  content: 'Build TypeScript UI',
  salary_text: 'SGD 1,000',
  status: 'New',
  importedAt: '2026-05-19T00:00:00.000Z',
  tags: [],
  chatHistory: [],
};

function sampleUserContext(): UserContext {
  return {
    ...DEFAULT_USER_CONTEXT,
    preferences: {
      ...DEFAULT_USER_CONTEXT.preferences,
      displayName: '张三',
      preferredLocations: ['Singapore'],
    },
    personas: [
      {
        id: 'mbti-1',
        type: 'mbti',
        label: 'MBTI',
        data: { type: 'INTJ' },
        createdAt: '2026-05-19T00:00:00.000Z',
      },
    ],
    activePersonaIds: ['mbti-1'],
    resumes: [
      {
        id: 'resume-1',
        label: '技术岗版',
        structured: emptyStructured,
        piiPolicy: 'keep',
        createdAt: '2026-05-19T00:00:00.000Z',
      },
    ],
    activeResumeId: 'resume-1',
    feedbackRecords: [
      {
        id: 'feedback-1',
        jobId: 'job-1',
        resumeId: 'resume-1',
        scoringVersion: 'phase4-scoring-v1.1',
        dimensionScores: { skill: 88 },
        userRating: 4,
        userAction: 'save',
        createdAt: '2026-05-19T00:00:00.000Z',
      },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  for (const testDb of openedDbs) {
    const name = testDb.name;
    testDb.close();
    await Dexie.delete(name);
  }
  openedDbs.length = 0;
  localStorage.clear();
});

describe('migrateLocalStorageToIndexedDb', () => {
  it('migrates v2 UserContext, jobs, and feedbackRecords into normalized stores', async () => {
    const testDb = createTestDb();
    const ctx = sampleUserContext();
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(ctx));
    localStorage.setItem(LEGACY_JOBS_KEY, JSON.stringify([sampleJob]));

    const summary = await migrateLocalStorageToIndexedDb({
      targetDb: testDb,
      now: () => NOW,
    });

    expect(summary).toMatchObject({
      alreadyMigrated: false,
      userContextMigrated: true,
      personas: 1,
      resumes: 1,
      jobs: 1,
      feedbackRecords: 1,
      rawFileRefsMissingBlobs: 0,
      migratedAt: NOW,
    });

    await expect(testDb.userContext.get(USER_CONTEXT_RECORD_ID)).resolves.toMatchObject({
      preferences: expect.objectContaining({ displayName: '张三' }),
      activeResumeId: 'resume-1',
      activePersonaIds: ['mbti-1'],
      updatedAt: NOW,
    });
    await expect(testDb.personas.get('mbti-1')).resolves.toMatchObject({ type: 'mbti' });
    await expect(testDb.resumes.get('resume-1')).resolves.toMatchObject({ label: '技术岗版' });
    await expect(testDb.jobs.get('job-1')).resolves.toMatchObject({ title: 'Frontend Intern' });
    await expect(testDb.feedbackRecords.get('feedback-1')).resolves.toMatchObject({
      userAction: 'save',
      updatedAt: NOW,
    });
    await expect(testDb.meta.get(LOCAL_STORAGE_MIGRATION_META_ID)).resolves.toMatchObject({
      id: LOCAL_STORAGE_MIGRATION_META_ID,
    });
    expect(localStorage.getItem(`${LEGACY_BACKUP_PREFIX}${USER_CONTEXT_KEY}`)).toBe(
      JSON.stringify(ctx),
    );
  });

  it('uses the existing v1 migration chain before writing IndexedDB records', async () => {
    const testDb = createTestDb();
    localStorage.setItem(
      USER_CONTEXT_V1_KEY,
      JSON.stringify({
        ...DEFAULT_USER_CONTEXT,
        resumes: [
          {
            id: 'resume-v1',
            name: '咨询版',
            content: 'strategy project',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        activeResumeId: 'resume-v1',
        activePersonaIds: [],
      }),
    );

    const summary = await migrateLocalStorageToIndexedDb({
      targetDb: testDb,
      now: () => NOW,
    });

    expect(summary.resumes).toBe(1);
    await expect(testDb.resumes.get('resume-v1')).resolves.toMatchObject({
      label: '咨询版',
      rawText: 'strategy project',
      piiPolicy: 'keep',
    });
    expect(localStorage.getItem(`${LEGACY_BACKUP_PREFIX}${USER_CONTEXT_V1_KEY}`)).not.toBeNull();
  });

  it('migrates baseline legacy profile data when only the old profile key exists', async () => {
    const testDb = createTestDb();
    localStorage.setItem(
      LEGACY_PROFILE_KEY,
      JSON.stringify({
        name: '旧档案',
        bg: 'CS student',
        astrology: '',
        preferences: 'remote',
        resumeContent: 'plain resume text',
      }),
    );

    const summary = await migrateLocalStorageToIndexedDb({
      targetDb: testDb,
      now: () => NOW,
    });

    expect(summary.resumes).toBe(1);
    await expect(testDb.userContext.get(USER_CONTEXT_RECORD_ID)).resolves.toMatchObject({
      preferences: expect.objectContaining({ displayName: '旧档案' }),
      activeResumeId: 'resume-legacy',
    });
    await expect(testDb.resumes.get('resume-legacy')).resolves.toMatchObject({
      rawText: 'plain resume text',
    });
  });

  it('is idempotent after the migration meta record is written', async () => {
    const testDb = createTestDb();
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(sampleUserContext()));
    localStorage.setItem(LEGACY_JOBS_KEY, JSON.stringify([sampleJob]));

    await migrateLocalStorageToIndexedDb({ targetDb: testDb, now: () => NOW });
    localStorage.setItem(
      LEGACY_JOBS_KEY,
      JSON.stringify([{ ...sampleJob, id: 'job-2', title: 'Changed' }]),
    );

    const second = await migrateLocalStorageToIndexedDb({ targetDb: testDb, now: () => NOW });

    expect(second.alreadyMigrated).toBe(true);
    await expect(testDb.jobs.count()).resolves.toBe(1);
    await expect(testDb.jobs.get('job-2')).resolves.toBeUndefined();
  });

  it('skips malformed job localStorage without blocking user context migration', async () => {
    const testDb = createTestDb();
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(sampleUserContext()));
    localStorage.setItem(LEGACY_JOBS_KEY, '{not json');

    const summary = await migrateLocalStorageToIndexedDb({
      targetDb: testDb,
      now: () => NOW,
    });

    expect(summary.jobs).toBe(0);
    await expect(testDb.userContext.get(USER_CONTEXT_RECORD_ID)).resolves.toBeDefined();
  });

  it('flags resume rawFileRef entries that cannot have Blob data in localStorage', async () => {
    const testDb = createTestDb();
    localStorage.setItem(
      USER_CONTEXT_KEY,
      JSON.stringify({
        ...sampleUserContext(),
        resumes: [
          {
            id: 'resume-with-blob-ref',
            label: 'PDF 版',
            rawFileRef: { mime: 'application/pdf', blobId: 'blob-1' },
            structured: emptyStructured,
            piiPolicy: 'keep',
            createdAt: '2026-05-19T00:00:00.000Z',
          },
        ],
      }),
    );

    const summary = await migrateLocalStorageToIndexedDb({
      targetDb: testDb,
      now: () => NOW,
    });

    expect(summary.rawFileRefsMissingBlobs).toBe(1);
  });
});
