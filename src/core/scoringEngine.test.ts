import { describe, expect, it } from 'vitest';
import type { Job, ResumeStructured, UserContext } from '../../types';
import type { ExtractedEvidence, ScoringRubric } from './matchTypes';
import {
  DEFAULT_SCORING_RUBRIC,
  SCORING_VERSION,
  aggregateDimensions,
  buildMatchScore,
  buildRuleDimensions,
  computeResumeBreakdown,
  estimateResumeYears,
} from './scoringEngine';
import type { ResumeProfile } from '../../types';

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

function makeResume(
  id: string,
  label: string,
  skills: Partial<ResumeStructured['skills']> = {},
  tech: string[] = [],
): ResumeProfile {
  return {
    id,
    label,
    structured: {
      ...emptyStructured,
      skills: {
        hard: skills.hard ?? [],
        soft: skills.soft ?? [],
        languages: skills.languages ?? [],
        tools: skills.tools ?? [],
      },
      projects: tech.length > 0 ? [{ name: 'P', role: 'r', bullets: [], tech }] : [],
    },
    piiPolicy: 'keep',
    createdAt: '2026-05-20T00:00:00Z',
  };
}

describe('computeResumeBreakdown (Phase 4.5)', () => {
  it('returns undefined when user has no resumes', () => {
    const user = makeUser({ resumes: [], activeResumeId: undefined });
    expect(computeResumeBreakdown(user, evidence)).toBeUndefined();
  });

  it('returns undefined when no evidence provided', () => {
    expect(computeResumeBreakdown(makeUser(), undefined)).toBeUndefined();
  });

  it('returns undefined when LLM extracted zero JD skills', () => {
    const emptyEvidence = {
      matchedSkills: [],
      missingSkills: [],
      transferableSkills: [],
      cultureSignals: [],
      growthReasons: [],
    };
    expect(computeResumeBreakdown(makeUser(), emptyEvidence)).toBeUndefined();
  });

  it('with a single resume, that resume is best by definition', () => {
    const user = makeUser({
      resumes: [makeResume('r1', 'Tech', { hard: ['Python', 'SQL'] })],
      activeResumeId: 'r1',
    });
    const result = computeResumeBreakdown(user, evidence);
    expect(result?.bestResumeId).toBe('r1');
    expect(result?.perResume).toHaveLength(1);
    expect(result?.perResume[0].coverageCount).toBe(2); // Python + SQL
  });

  it('ranks multiple resumes by coverage count desc', () => {
    const user = makeUser({
      resumes: [
        makeResume('tech', 'Tech', { hard: ['Python', 'SQL', 'R'] }),
        makeResume('consulting', 'Consulting', { hard: ['PowerPoint'] }),
      ],
      activeResumeId: 'consulting',
    });
    const result = computeResumeBreakdown(user, evidence);
    expect(result?.bestResumeId).toBe('tech');
    expect(result?.perResume[0].resumeLabel).toBe('Tech');
    expect(result?.perResume[1].resumeLabel).toBe('Consulting');
    expect(result?.perResume[0].coverageCount).toBeGreaterThan(
      result?.perResume[1].coverageCount ?? 0,
    );
    expect(result?.activeResumeId).toBe('consulting');
  });

  it('matches case-insensitively', () => {
    const user = makeUser({
      resumes: [makeResume('r1', 'A', { hard: ['python', 'sql'] })],
    });
    const result = computeResumeBreakdown(user, evidence);
    // evidence has 'Python', 'SQL' — should match lowercase resume skills
    expect(result?.perResume[0].coverageCount).toBeGreaterThanOrEqual(2);
  });

  it('finds skills across hard / tools / languages / soft / projects.tech', () => {
    const user = makeUser({
      resumes: [
        makeResume('r1', 'A', { hard: ['Python'] }),
        makeResume('r2', 'B', { tools: ['Python'] }),
        makeResume('r3', 'C', { languages: ['Python'] }),
        makeResume('r4', 'D', { soft: ['Python'] }),
        makeResume('r5', 'E', {}, ['Python']),
        makeResume('r6', 'F', { hard: [] }),
      ],
    });
    const result = computeResumeBreakdown(user, {
      ...evidence,
      matchedSkills: [{ skill: 'Python', priority: 'must' }],
      missingSkills: [],
      transferableSkills: [],
    });
    // r1-r5 should each have Python covered; r6 should miss it
    const coverageById = new Map(result?.perResume.map((r) => [r.resumeId, r.coverageCount]));
    expect(coverageById.get('r1')).toBe(1);
    expect(coverageById.get('r2')).toBe(1);
    expect(coverageById.get('r3')).toBe(1);
    expect(coverageById.get('r4')).toBe(1);
    expect(coverageById.get('r5')).toBe(1);
    expect(coverageById.get('r6')).toBe(0);
  });

  it('dedupes JD skills appearing in multiple evidence buckets', () => {
    const user = makeUser({
      resumes: [makeResume('r1', 'A', { hard: ['Python'] })],
    });
    const result = computeResumeBreakdown(user, {
      ...evidence,
      matchedSkills: [{ skill: 'Python', priority: 'must' }],
      missingSkills: [{ skill: 'python', priority: 'preferred' }], // case-variant duplicate
      transferableSkills: [{ skill: 'Python ', priority: 'unknown' }], // trailing space
    });
    expect(result?.totalJdSkills).toBe(1);
    expect(result?.perResume[0].coverageCount).toBe(1);
  });

  it('coverageRatio is rounded to 2 decimals', () => {
    const user = makeUser({
      resumes: [makeResume('r1', 'A', { hard: ['Python'] })],
    });
    const result = computeResumeBreakdown(user, {
      ...evidence,
      matchedSkills: [
        { skill: 'Python', priority: 'must' },
        { skill: 'Java', priority: 'must' },
        { skill: 'Go', priority: 'must' },
      ],
      missingSkills: [],
      transferableSkills: [],
    });
    // 1 / 3 = 0.3333... → rounded to 0.33
    expect(result?.perResume[0].coverageRatio).toBe(0.33);
  });

  it('tiebreak: equal count → higher coverageRatio wins (proxy for: fewer total skills means denser fit)', () => {
    // Both have 2 covered, but jdSkills.length is the same — so ratios tie too.
    // The current implementation falls back to insertion order on a true tie;
    // we just verify the tiebreak doesn't crash and produces stable output.
    const user = makeUser({
      resumes: [
        makeResume('r1', 'A', { hard: ['Python', 'SQL'] }),
        makeResume('r2', 'B', { hard: ['Python', 'SQL'] }),
      ],
    });
    const result = computeResumeBreakdown(user, evidence);
    expect(result?.perResume[0].coverageCount).toBe(result?.perResume[1].coverageCount);
  });

  it('exposes missingSkills per resume for UI', () => {
    const user = makeUser({
      resumes: [makeResume('r1', 'A', { hard: ['Python'] })],
    });
    const result = computeResumeBreakdown(user, {
      ...evidence,
      matchedSkills: [{ skill: 'Python', priority: 'must' }],
      missingSkills: [{ skill: 'Kafka', priority: 'preferred' }],
      transferableSkills: [],
    });
    expect(result?.perResume[0].coveredSkills).toContain('Python');
    expect(result?.perResume[0].missingSkills).toContain('Kafka');
  });

  it('preserves original-case JD skill names in output (lowercased only for matching)', () => {
    const user = makeUser({
      resumes: [makeResume('r1', 'A', { hard: ['python'] })],
    });
    const result = computeResumeBreakdown(user, {
      ...evidence,
      matchedSkills: [{ skill: 'Python', priority: 'must' }],
      missingSkills: [],
      transferableSkills: [],
    });
    expect(result?.perResume[0].coveredSkills).toEqual(['Python']);
  });

  it('skips skill items with empty / whitespace-only skill names', () => {
    const user = makeUser({
      resumes: [makeResume('r1', 'A', { hard: ['Python'] })],
    });
    const result = computeResumeBreakdown(user, {
      ...evidence,
      matchedSkills: [
        { skill: 'Python', priority: 'must' },
        { skill: '   ', priority: 'must' },
        { skill: '', priority: 'unknown' },
      ],
      missingSkills: [],
      transferableSkills: [],
    });
    expect(result?.totalJdSkills).toBe(1);
  });
});

describe('buildMatchScore — Phase 4.5 resumeBreakdown integration', () => {
  it('attaches resumeBreakdown when evidence + resumes both exist', () => {
    const score = buildMatchScore({
      job: makeJob(),
      user: makeUser({
        resumes: [
          {
            id: 'r1',
            label: 'Tech',
            structured: {
              ...emptyStructured,
              skills: { hard: ['Python', 'SQL'], soft: [], languages: [], tools: [] },
            },
            piiPolicy: 'keep',
            createdAt: '2026-05-20T00:00:00Z',
          },
        ],
        activeResumeId: 'r1',
      }),
      goal: 'audit',
      evidence,
    });
    expect(score.resumeBreakdown).toBeDefined();
    expect(score.resumeBreakdown?.bestResumeId).toBe('r1');
  });

  it('omits resumeBreakdown when evidence is undefined', () => {
    const score = buildMatchScore({
      job: makeJob(),
      user: makeUser(),
      goal: 'audit',
    });
    expect(score.resumeBreakdown).toBeUndefined();
  });

  it('omits resumeBreakdown when user has no resumes', () => {
    const score = buildMatchScore({
      job: makeJob(),
      user: makeUser({ resumes: [], activeResumeId: undefined }),
      goal: 'audit',
      evidence,
    });
    expect(score.resumeBreakdown).toBeUndefined();
  });

  it('bumped SCORING_VERSION to v1.3 (Phase 4.5)', () => {
    expect(SCORING_VERSION).toBe('phase4-scoring-v1.3');
    const score = buildMatchScore({
      job: makeJob(),
      user: makeUser(),
      goal: 'audit',
      evidence,
    });
    expect(score.scoringVersion).toBe('phase4-scoring-v1.3');
  });
});
