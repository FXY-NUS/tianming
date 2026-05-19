import { describe, expect, it } from 'vitest';
import type { Job, ResumeStructured, UserContext } from '../../types';
import type { ExtractedEvidence, ScoringRubric } from './matchTypes';
import {
  DEFAULT_SCORING_RUBRIC,
  aggregateDimensions,
  buildMatchScore,
  buildRuleDimensions,
  estimateResumeYears,
} from './scoringEngine';

const emptyStructured: ResumeStructured = {
  basic: {},
  education: [],
  experience: [],
  skills: { hard: [], soft: [], languages: [], tools: [] },
  projects: [],
};

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Data Analyst',
    company: 'Acme',
    url: '',
    content: 'We need Python, SQL and dashboard skills.',
    salary_text: '',
    status: 'New',
    importedAt: '2026-05-18T00:00:00Z',
    tags: [],
    chatHistory: [],
    ...overrides,
  };
}

function makeUser(overrides: Partial<UserContext> = {}): UserContext {
  return {
    personas: [],
    resumes: [
      {
        id: 'resume-1',
        label: 'Default',
        structured: {
          ...emptyStructured,
          experience: [
            { company: 'InternCo', title: 'Data Intern', period: '2024-2025', bullets: [] },
          ],
        },
        piiPolicy: 'keep',
        createdAt: '2026-05-18T00:00:00Z',
      },
    ],
    preferences: {
      displayName: '',
      backgroundSummary: '',
      astrologyProfile: '',
      jobPreferences: '',
      preferredLocations: [],
      avoidKeywords: [],
    },
    activeResumeId: 'resume-1',
    activePersonaIds: [],
    ...overrides,
  };
}

const evidence: ExtractedEvidence = {
  matchedSkills: [
    { skill: 'Python', priority: 'must' },
    { skill: 'SQL', priority: 'must' },
  ],
  missingSkills: [{ skill: 'AWS', priority: 'preferred' }],
  transferableSkills: [{ skill: 'R', priority: 'preferred' }],
  cultureSignals: ['Structured analyst team'],
  cultureScore: 70,
  growthReasons: ['Good bridge from analytics to ML'],
  growthScore: 80,
};

describe('scoringEngine', () => {
  it('keeps unknown dimensions out of the aggregate instead of treating them as zero', () => {
    const score = buildMatchScore({
      job: makeJob(),
      user: makeUser(),
      goal: 'audit',
      evidence,
    });

    const location = score.dimensions.find((dimension) => dimension.key === 'location');
    expect(location?.score).toBeUndefined();
    expect(location?.confidence).toBe('unknown');
    expect(score.overall).toBeGreaterThan(50);
  });

  it('normalizes weights across dimensions that have concrete scores', () => {
    const overall = aggregateDimensions(
      [
        {
          key: 'skill',
          label: 'Skill',
          score: 100,
          confidence: 'high',
          evidence: [],
          warnings: [],
        },
        {
          key: 'growth',
          label: 'Growth',
          score: undefined,
          confidence: 'unknown',
          evidence: [],
          warnings: [],
        },
      ],
      DEFAULT_SCORING_RUBRIC.dimensions,
    );

    expect(overall).toBe(100);
  });

  it('caps the overall score when a user-enabled hard filter fails', () => {
    const score = buildMatchScore({
      job: makeJob({ content: 'Senior data scientist. 5+ years required.' }),
      user: makeUser(),
      goal: 'audit',
      evidence,
      hardFilters: { requireExperienceFit: true },
    });

    expect(score.hardRejected).toBe(true);
    expect(score.overall).toBeLessThanOrEqual(20);
    expect(score.label).toBe('low_fit');
  });

  it('does not hard reject the same evidence when hard filters are disabled', () => {
    const score = buildMatchScore({
      job: makeJob({ content: 'Senior data scientist. 5+ years required.' }),
      user: makeUser(),
      goal: 'audit',
      evidence,
    });

    const experience = score.dimensions.find((dimension) => dimension.key === 'experience');
    expect(experience?.hardFail).toBeFalsy();
    expect(score.hardRejected).toBe(false);
  });

  it('scores avoid keywords as a warning by default and a hard fail only when requested', () => {
    const user = makeUser({
      preferences: {
        ...makeUser().preferences,
        avoidKeywords: ['outsourcing'],
      },
    });
    const job = makeJob({ content: 'This is an outsourcing contractor role.' });

    const warningOnly = buildRuleDimensions(job, user);
    const hardFiltered = buildRuleDimensions(job, user, { rejectAvoidKeywords: true });

    expect(
      warningOnly.find((dimension) => dimension.key === 'avoid_keywords')?.hardFail,
    ).toBeFalsy();
    expect(hardFiltered.find((dimension) => dimension.key === 'avoid_keywords')?.hardFail).toBe(
      true,
    );
  });

  it('scores salary range overlap without hard rejecting by default', () => {
    const user = makeUser({
      preferences: {
        ...makeUser().preferences,
        salaryRange: [1000, 10000],
      },
    });
    const job = makeJob({ salary_text: '$500 - $2k monthly' });

    const dimensions = buildRuleDimensions(job, user);
    const compensation = dimensions.find((dimension) => dimension.key === 'compensation');

    expect(compensation?.score).toBe(11.1);
    expect(compensation?.hardFail).toBeFalsy();
  });

  it('falls back to JD content when matching preferred locations', () => {
    const user = makeUser({
      preferences: {
        ...makeUser().preferences,
        preferredLocations: ['Singapore'],
      },
    });
    const job = makeJob({ content: 'This hybrid role is based in Singapore.' });

    const dimensions = buildRuleDimensions(job, user);
    const location = dimensions.find((dimension) => dimension.key === 'location');

    expect(location?.score).toBe(100);
    expect(location?.confidence).toBe('high');
  });

  it('keeps location unknown when no explicit location or preferred fallback is present', () => {
    const user = makeUser({
      preferences: {
        ...makeUser().preferences,
        preferredLocations: ['Singapore'],
      },
    });
    const job = makeJob({ content: 'This role supports analytics dashboards.' });

    const dimensions = buildRuleDimensions(job, user);
    const location = dimensions.find((dimension) => dimension.key === 'location');

    expect(location?.score).toBeUndefined();
    expect(location?.confidence).toBe('unknown');
  });

  it('falls back to JD content when parsing salary text', () => {
    const user = makeUser({
      preferences: {
        ...makeUser().preferences,
        salaryRange: [1000, 3000],
      },
    });
    const job = makeJob({
      salary_text: '',
      content: 'Compensation: SGD 1.5k - 2.5k monthly.',
    });

    const dimensions = buildRuleDimensions(job, user);
    const compensation = dimensions.find((dimension) => dimension.key === 'compensation');

    expect(compensation?.score).toBe(50);
    expect(compensation?.confidence).toBe('medium');
  });

  it('estimates resume years from structured experience periods', () => {
    const snapshot = estimateResumeYears(makeUser().resumes[0]);

    expect(snapshot.estimatedYears).toBe(1);
    expect(snapshot.confidence).toBe('medium');
  });

  it('estimates partial years from YYYY-MM style periods', () => {
    const user = makeUser({
      resumes: [
        {
          id: 'resume-month',
          label: 'Month-level',
          structured: {
            ...emptyStructured,
            experience: [
              { company: 'X', title: 'Intern', period: '2023.06 - 2024.03', bullets: [] },
            ],
          },
          piiPolicy: 'keep',
          createdAt: '2026-05-19T00:00:00Z',
        },
      ],
      activeResumeId: 'resume-month',
    });

    const snapshot = estimateResumeYears(user.resumes[0]);

    expect(snapshot.estimatedYears).toBe(0.8);
  });

  it('does not hard fail on seniority-only titles when resume years are unknown', () => {
    const userWithoutPeriod = makeUser({
      resumes: [
        {
          id: 'resume-unknown',
          label: 'No periods',
          structured: emptyStructured, // no experience entries -> estimatedYears undefined
          piiPolicy: 'keep',
          createdAt: '2026-05-19T00:00:00Z',
        },
      ],
      activeResumeId: 'resume-unknown',
    });

    const score = buildMatchScore({
      job: makeJob({ content: 'Senior data scientist on a strong analytics team.' }),
      user: userWithoutPeriod,
      goal: 'audit',
      evidence,
      hardFilters: { requireExperienceFit: true },
    });

    const experience = score.dimensions.find((dimension) => dimension.key === 'experience');
    expect(experience?.hardFail).toBe(false);
    expect(score.hardRejected).toBe(false);
  });

  it('hard fails seniority-only titles only when resume years are clearly below the floor', () => {
    const score = buildMatchScore({
      job: makeJob({ content: 'Senior data scientist on a strong analytics team.' }),
      user: makeUser(), // estimatedYears = 1 (from '2024-2025'), well below floor of 3
      goal: 'audit',
      evidence,
      hardFilters: { requireExperienceFit: true },
    });

    const experience = score.dimensions.find((dimension) => dimension.key === 'experience');
    expect(experience?.hardFail).toBe(true);
    expect(score.hardRejected).toBe(true);
  });

  it('does not hard fail seniority-only titles when resume years clear the floor', () => {
    const seniorUser = makeUser({
      resumes: [
        {
          id: 'resume-senior',
          label: 'Senior',
          structured: {
            ...emptyStructured,
            experience: [
              { company: 'A', title: 'DS', period: '2020-2026', bullets: [] }, // ~6 years
            ],
          },
          piiPolicy: 'keep',
          createdAt: '2026-05-19T00:00:00Z',
        },
      ],
      activeResumeId: 'resume-senior',
    });

    const score = buildMatchScore({
      job: makeJob({ content: 'Senior data scientist on a strong analytics team.' }),
      user: seniorUser,
      goal: 'audit',
      evidence,
      hardFilters: { requireExperienceFit: true },
    });

    const experience = score.dimensions.find((dimension) => dimension.key === 'experience');
    expect(experience?.hardFail).toBe(false);
    expect(experience?.score).toBeGreaterThanOrEqual(70);
    expect(score.hardRejected).toBe(false);
  });

  it('clamps persona rubric weight to the configured cap', () => {
    const rubric: ScoringRubric = {
      version: 'test',
      personaWeightCap: 0.15,
      dimensions: [
        { key: 'skill', label: 'Skill', weight: 0.5, enabled: true },
        { key: 'persona', label: 'Persona', weight: 0.5, enabled: true },
      ],
    };

    const score = buildMatchScore({
      job: makeJob(),
      user: makeUser(),
      goal: 'audit',
      evidence: { ...evidence, personaReasons: ['Holland interests align'], personaScore: 100 },
      rubric,
    });

    expect(score.overall).toBeLessThan(100);
    expect(score.overall).toBeGreaterThan(70);
  });
});
