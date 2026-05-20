import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_USER_CONTEXT } from '../../services/userContextStorage';
import {
  TIANMING_DB_VERSION,
  TianmingDb,
  USER_CONTEXT_RECORD_ID,
  type UserContextRecord,
} from './db';

const openedDbs: TianmingDb[] = [];

function createTestDb(): TianmingDb {
  const testDb = new TianmingDb(`tianming-test-${crypto.randomUUID()}`);
  openedDbs.push(testDb);
  return testDb;
}

afterEach(async () => {
  for (const testDb of openedDbs) {
    const name = testDb.name;
    testDb.close();
    await Dexie.delete(name);
  }
  openedDbs.length = 0;
});

describe('TianmingDb', () => {
  it('defines the Phase 5A object stores', async () => {
    const testDb = createTestDb();

    await testDb.open();

    expect(testDb.verno).toBe(TIANMING_DB_VERSION);
    expect(testDb.tables.map((table) => table.name).sort()).toEqual([
      'feedbackRecords',
      'jobs',
      'meta',
      'personas',
      'resumeBlobs',
      'resumes',
      'userContext',
    ]);
  });

  it('stores the normalized user context singleton separately from resumes', async () => {
    const testDb = createTestDb();
    const updatedAt = '2026-05-20T00:00:00.000Z';
    const record: UserContextRecord = {
      id: USER_CONTEXT_RECORD_ID,
      schemaVersion: 1,
      preferences: {
        ...DEFAULT_USER_CONTEXT.preferences,
        displayName: '阿棠',
        preferredLocations: ['Singapore'],
      },
      activeResumeId: 'resume-1',
      activePersonaIds: ['mbti-1'],
      updatedAt,
    };

    await testDb.userContext.put(record);
    await testDb.resumes.put({
      id: 'resume-1',
      label: '技术岗版',
      structured: {
        basic: {},
        education: [],
        experience: [],
        skills: { hard: ['TypeScript'], soft: [], languages: [], tools: [] },
        projects: [],
      },
      piiPolicy: 'keep',
      createdAt: updatedAt,
      updatedAt,
    });

    await expect(testDb.userContext.get(USER_CONTEXT_RECORD_ID)).resolves.toEqual(record);
    await expect(testDb.resumes.count()).resolves.toBe(1);
  });
});
