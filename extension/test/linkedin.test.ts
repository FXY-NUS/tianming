import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { elementToText } from '../src/domText';
import {
  findJobCards,
  jobIdFromUrl,
  readJobCard,
  readJobDetail,
  splitLocation,
} from '../src/linkedin';

const NOW = new Date('2026-10-02T12:00:00.000Z');
const SEARCH_URL = 'https://www.linkedin.com/jobs/search/?currentJobId=4001&keywords=data';

export const loadFixture = (name: string) =>
  readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');

const mountFixture = () => {
  document.body.innerHTML = loadFixture('linkedin-search.html');
  return document;
};

describe('jobIdFromUrl', () => {
  it('reads currentJobId from the search page URL', () => {
    expect(jobIdFromUrl(SEARCH_URL)).toBe('4001');
  });

  it('reads the id from /jobs/view/ paths with or without a slug', () => {
    expect(jobIdFromUrl('/jobs/view/4002/?refId=y')).toBe('4002');
    expect(jobIdFromUrl('https://www.linkedin.com/jobs/view/pm-intern-at-beta-4002/')).toBe('4002');
  });

  it('returns null for non-job URLs', () => {
    expect(jobIdFromUrl('https://www.linkedin.com/feed/')).toBeNull();
    expect(jobIdFromUrl(undefined)).toBeNull();
  });
});

describe('splitLocation', () => {
  it('splits a trailing work-mode parenthetical', () => {
    expect(splitLocation('Singapore, Singapore (Hybrid)')).toEqual({
      locationText: 'Singapore, Singapore',
      workMode: 'Hybrid',
    });
  });

  it('keeps other parentheticals in the location', () => {
    expect(splitLocation('Shanghai (Pudong)')).toEqual({
      locationText: 'Shanghai (Pudong)',
      workMode: '',
    });
  });
});

describe('readJobCard', () => {
  it('reads loaded cards and skips the empty placeholder', () => {
    const doc = mountFixture();
    const cards = findJobCards(doc);
    expect(cards).toHaveLength(3);

    const snapshots = cards.map((card) => readJobCard(card, NOW));
    expect(snapshots[0]).toEqual({
      id: '4001',
      source: 'linkedin',
      title: 'Data Analyst',
      company: 'Acme Analytics',
      locationText: 'Singapore, Singapore',
      salaryText: '$5K/month - $7K/month',
      url: 'https://www.linkedin.com/jobs/view/4001/',
      capturedAt: NOW.toISOString(),
    });
    expect(snapshots[1]).toMatchObject({
      id: '4002',
      title: 'Product Manager Intern',
      company: 'Beta Labs',
      locationText: 'Remote',
    });
    expect(snapshots[1]?.salaryText).toBeUndefined();
    expect(snapshots[2]).toBeNull();
  });

  it('does not return the inner data-job-id wrapper as a second card', () => {
    const doc = mountFixture();
    expect(findJobCards(doc).map((card) => card.tagName)).toEqual(['LI', 'LI', 'LI']);
  });
});

describe('readJobDetail', () => {
  it('extracts the opened job with structured description text', () => {
    const doc = mountFixture();
    const detail = readJobDetail(doc, SEARCH_URL, NOW);
    expect(detail).toMatchObject({
      externalId: '4001',
      source: 'linkedin',
      title: 'Data Analyst',
      company: 'Acme Analytics',
      url: 'https://www.linkedin.com/jobs/view/4001/',
      locationText: 'Singapore, Singapore',
      salaryText: '$5K/month - $7K/month',
      workMode: 'Hybrid',
      capturedAt: NOW.toISOString(),
    });
    expect(detail?.content).toBe(
      [
        'About the job',
        '',
        'We are looking for a Data Analyst to join the growth team.',
        '',
        'Responsibilities:',
        '',
        '- Build dashboards in Tableau',
        '- Write SQL against BigQuery',
        '',
        'Requirements:',
        '2+ years of experience',
        'Python or R',
      ].join('\n'),
    );
  });

  it('returns null while the description has not rendered', () => {
    const doc = mountFixture();
    doc.querySelector('#job-details')?.remove();
    expect(readJobDetail(doc, SEARCH_URL, NOW)).toBeNull();
  });

  it('takes the job id from the detail link on a standalone job page', () => {
    const doc = mountFixture();
    const detail = readJobDetail(
      doc,
      'https://www.linkedin.com/jobs/collections/recommended/',
      NOW,
    );
    expect(detail?.externalId).toBe('4001');
  });
});

describe('elementToText', () => {
  it('skips hidden helper text and buttons', () => {
    document.body.innerHTML =
      '<div><span class="visually-hidden">hidden</span>shown<button>Show more</button></div>';
    expect(elementToText(document.body.firstElementChild)).toBe('shown');
  });
});
