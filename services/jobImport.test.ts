import { describe, expect, it } from 'vitest';
import type { Job } from '../types';
import {
  buildJobFromInput,
  jobFromPastedText,
  jobsFromExtension,
  jobsFromImportPayload,
  normalizeImportItem,
} from './jobImport';

const NOW = new Date('2026-10-02T00:00:00.000Z');

const existingJob = (title: string, company: string): Job =>
  buildJobFromInput({ id: `${title}-${company}`, title, company, content: 'x' }, NOW);

describe('buildJobFromInput', () => {
  it('builds a New job with defaults', () => {
    const job = buildJobFromInput(
      { title: ' Data Analyst ', company: ' Acme ', content: 'JD body' },
      NOW,
      () => 'fixed-id',
    );
    expect(job).toMatchObject({
      id: 'fixed-id',
      title: 'Data Analyst',
      company: 'Acme',
      url: '',
      content: 'JD body',
      salary_text: '面议',
      salaryText: '',
      status: 'New',
      tags: [],
      chatHistory: [],
      importedAt: NOW.toISOString(),
    });
  });

  it('takes the title from the first non-empty content line', () => {
    const job = buildJobFromInput({ content: '\n\n  Product Manager Intern  \nmore' }, NOW);
    expect(job.title).toBe('Product Manager Intern');
    expect(job.company).toBe('未知公司');
  });

  it('caps a content-derived title at 50 characters', () => {
    const job = buildJobFromInput({ content: 'a'.repeat(80) }, NOW);
    expect(job.title).toHaveLength(50);
  });

  it('falls back to a placeholder title when nothing is given', () => {
    expect(buildJobFromInput({}, NOW).title).toBe('待析职位');
  });
});

describe('normalizeImportItem', () => {
  it('accepts scraper field aliases', () => {
    expect(
      normalizeImportItem({
        scraped_content: 'body',
        salary_text: '10k',
        location: 'Singapore',
        mode: 'Hybrid',
      }),
    ).toMatchObject({
      content: 'body',
      salaryText: '10k',
      locationText: 'Singapore',
      workMode: 'Hybrid',
    });
  });
});

describe('jobsFromImportPayload', () => {
  it('skips jobs already present and duplicates inside the file', () => {
    const jobs = jobsFromImportPayload(
      [
        { title: 'Analyst', company: 'Acme', content: 'a' },
        { title: 'Analyst', company: 'Acme', content: 'b' },
        { title: 'Engineer', company: 'Beta', content: 'c' },
      ],
      [existingJob('Engineer', 'Beta')],
      NOW,
    );
    expect(jobs.map((job) => job.title)).toEqual(['Analyst']);
  });

  it('keeps an id provided by the file', () => {
    const [job] = jobsFromImportPayload([{ id: 'from-file', content: 'x' }], [], NOW);
    expect(job.id).toBe('from-file');
  });

  it('rejects a payload that is not an array', () => {
    expect(() => jobsFromImportPayload({ title: 'x' }, [], NOW)).toThrow();
  });
});

describe('jobFromPastedText', () => {
  it('rejects blank text', () => {
    expect(jobFromPastedText({ content: '   \n ' }, [], NOW)).toEqual({ kind: 'empty' });
  });

  it('creates a job from pasted text and trims surrounding whitespace', () => {
    const result = jobFromPastedText(
      { content: '\n  Backend Engineer\nRequirements: Go  \n', company: 'Gamma' },
      [],
      NOW,
    );
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.job.title).toBe('Backend Engineer');
    expect(result.job.company).toBe('Gamma');
    expect(result.job.content).toBe('Backend Engineer\nRequirements: Go');
  });

  it('returns the existing job instead of creating a duplicate', () => {
    const existing = existingJob('Analyst', 'Acme');
    const result = jobFromPastedText(
      { title: 'Analyst', company: 'Acme', content: 'new body' },
      [existing],
      NOW,
    );
    expect(result).toEqual({ kind: 'duplicate', existing });
  });
});

describe('jobsFromExtension', () => {
  const captured = (externalId: string, title: string, company: string, content = 'body') => ({
    externalId,
    source: 'linkedin' as const,
    title,
    company,
    url: `https://www.linkedin.com/jobs/view/${externalId}/`,
    content,
    locationText: 'Singapore',
    salaryText: '$5K/month',
    workMode: 'Hybrid',
    capturedAt: NOW.toISOString(),
  });

  it('builds jobs through the shared path and dedupes by signature and url', () => {
    const existing = [
      existingJob('Data Analyst', 'Acme'),
      { ...existingJob('Other', 'Co'), url: 'https://www.linkedin.com/jobs/view/9/' },
    ];
    const jobs = jobsFromExtension(
      [
        captured('1', 'Data Analyst', 'Acme'),
        captured('9', 'Renamed Title', 'Co'),
        captured('2', 'PM Intern', 'Beta'),
        captured('2', 'PM Intern', 'Beta'),
        captured('3', 'Empty', 'Beta', '   '),
      ],
      existing,
      NOW,
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: 'PM Intern',
      company: 'Beta',
      url: 'https://www.linkedin.com/jobs/view/2/',
      salary_text: '$5K/month',
      locationText: 'Singapore',
      workMode: 'Hybrid',
      importedAt: NOW.toISOString(),
    });
  });
});
