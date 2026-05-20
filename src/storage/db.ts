import Dexie, { type Table } from 'dexie';
import type { Job, PersonaInstance, ResumeProfile, UserPreferences } from '../../types';
import type { MatchFeedbackRecord } from '../core/matchTypes';

export const TIANMING_DB_NAME = 'tianming';
export const TIANMING_DB_VERSION = 1;
export const USER_CONTEXT_RECORD_ID = 'default';
export const LOCAL_STORAGE_MIGRATION_META_ID = 'migration:localStorage:v1';

export interface UserContextRecord {
  id: typeof USER_CONTEXT_RECORD_ID;
  schemaVersion: number;
  preferences: UserPreferences;
  activeResumeId?: string;
  activePersonaIds: string[];
  updatedAt: string;
}

export type PersonaRecord = PersonaInstance & {
  updatedAt: string;
};

export type ResumeRecord = ResumeProfile & {
  updatedAt: string;
};

export interface ResumeBlobRecord {
  id: string;
  resumeId: string;
  mime: string;
  fileName?: string;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
}

export type JobRecord = Job & {
  updatedAt: string;
};

export type FeedbackRecord = MatchFeedbackRecord & {
  updatedAt: string;
};

export interface StorageMetaRecord {
  id: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

export class TianmingDb extends Dexie {
  userContext!: Table<UserContextRecord, string>;
  personas!: Table<PersonaRecord, string>;
  resumes!: Table<ResumeRecord, string>;
  resumeBlobs!: Table<ResumeBlobRecord, string>;
  jobs!: Table<JobRecord, string>;
  feedbackRecords!: Table<FeedbackRecord, string>;
  meta!: Table<StorageMetaRecord, string>;

  constructor(name = TIANMING_DB_NAME) {
    super(name);

    this.version(TIANMING_DB_VERSION).stores({
      userContext: '&id, updatedAt',
      personas: '&id, type, createdAt, updatedAt',
      resumes: '&id, label, createdAt, updatedAt',
      resumeBlobs: '&id, resumeId, mime, createdAt, updatedAt',
      jobs: '&id, status, importedAt, company, title, updatedAt',
      feedbackRecords: '&id, jobId, resumeId, scoringVersion, userAction, createdAt, updatedAt',
      meta: '&id, createdAt, updatedAt',
    });
  }
}

export const db = new TianmingDb();
