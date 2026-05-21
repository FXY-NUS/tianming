import { describe, expect, it } from 'vitest';
import type { Job, UserContext } from '../../types';
import { scoreBatchScreenRecord, scoreDeepAuditRecord } from './matchEngine';

const user: UserContext = {
  personas: [],
  resumes: [
    {
      id: 'resume-1',
      label: 'Default',
      structured: {
        basic: {},
        education: [],
        experience: [
          { company: 'InternCo', title: 'Data Intern', period: '2024-2025', bullets: [] },
        ],
        skills: { hard: ['Python', 'SQL'], soft: [], languages: [], tools: [] },
        projects: [],
      },
      piiPolicy: 'keep',
      createdAt: '2026-05-18T00:00:00Z',
    },
  ],
  preferences: {
    displayName: '',
    backgroundSummary: 'Python and SQL analyst',
    astrologyProfile: '',
    jobPreferences: '',
    preferredLocations: [],
    avoidKeywords: [],
  },
  activeResumeId: 'resume-1',
  activePersonaIds: [],
};

const job: Job = {
  id: 'job-1',
  title: 'Data Analyst',
  company: 'Acme',
  url: '',
  content: 'Python, SQL, dashboards. AWS preferred.',
  salary_text: '',
  status: 'New',
  importedAt: '2026-05-18T00:00:00Z',
  tags: [],
  chatHistory: [],
};

const evidence = {
  matchedSkills: [
    { skill: 'Python', priority: 'must', sourceResumeIds: ['resume-1'] },
    { skill: 'SQL', priority: 'must' },
  ],
  missingSkills: [{ skill: 'AWS', priority: 'preferred' }],
  transferableSkills: [],
  cultureSignals: ['Structured analytics team'],
  cultureScore: 70,
  growthReasons: ['Good early-career analytics scope'],
  growthScore: 82,
};

describe('matchEngine', () => {
  it('turns a raw batch evidence record into a deterministic match result', () => {
    const result = scoreBatchScreenRecord(
      { id: job.id, score: 1, reason: 'skills align', ...evidence },
      [job],
      user,
      { providerId: 'gemini', modelId: 'flash' },
    );

    expect(result?.score).toBe(result?.matchScore.overall);
    expect(result?.score).not.toBe(1);
    expect(result?.reason).toBe('skills align');
    expect(result?.matchScore.providerId).toBe('gemini');
  });

  it('overwrites audit score and judgment from code-owned scoring', () => {
    const result = scoreDeepAuditRecord(
      {
        score: 1,
        judgment: 'LLM says yes',
        summary: 'Narrative',
        hexagram: '',
        detailed_analysis: { pros: ['Python'], cons: ['AWS'] },
        cruel_truth_2026: 'Grounded outlook.',
        career_growth: 'Analytics path.',
        interview_tactics: 'Lead with SQL.',
        contract_red_flags: 'Check overtime.',
        recommended_resume: {
          resumeId: 'resume-1',
          label: 'Default',
          reasoning: 'Default covers Python and SQL.',
          edits_suggestion: ['Add AWS to Skills.'],
        },
        ...evidence,
      },
      job,
      user,
    );

    expect(result?.score).toBe(result?.matchScore.overall);
    expect(result?.score).not.toBe(1);
    expect(result?.judgment).not.toBe('LLM says yes');
    expect(result?.evidenceStatus).toBe('ok');
    expect(result?.recommended_resume?.resumeId).toBe('resume-1');
    expect(result?.extractedEvidence?.matchedSkills[0].sourceResumeIds).toEqual(['resume-1']);
  });

  it('keeps scoring possible when evidence is missing', () => {
    const result = scoreDeepAuditRecord(
      {
        summary: 'Narrative',
        hexagram: '',
        detailed_analysis: { pros: [], cons: [] },
        cruel_truth_2026: 'Unknown.',
        career_growth: 'Unknown.',
        interview_tactics: 'Unknown.',
        contract_red_flags: 'Unknown.',
      },
      job,
      user,
    );

    expect(result?.evidenceStatus).toBe('missing');
    expect(
      result?.matchScore.dimensions.find((dimension) => dimension.key === 'skill')?.score,
    ).toBeUndefined();
  });

  it('normalizes loose Gemini evidence instead of dropping the whole evidence block', () => {
    const result = scoreDeepAuditRecord(
      {
        summary: 'Narrative',
        hexagram: '',
        detailed_analysis: { pros: [], cons: [] },
        cruel_truth_2026: 'Grounded outlook.',
        career_growth: 'Analytics path.',
        interview_tactics: 'Lead with SQL.',
        contract_red_flags: 'Check overtime.',
        matchedSkills: ['Python', { skill: 'SQL', priority: 'required' }],
        missingSkills: [],
        transferableSkills: [],
        cultureSignals: ['Structured analytics team'],
        growthReasons: ['Clear analyst progression'],
      },
      job,
      user,
    );

    expect(result?.evidenceStatus).toBe('ok');
    expect(result?.extractedEvidence?.matchedSkills).toEqual([
      { skill: 'Python', priority: 'unknown' },
      { skill: 'SQL', priority: 'unknown' },
    ]);
    expect(
      result?.matchScore.dimensions.find((dimension) => dimension.key === 'culture')?.score,
    ).toBe(60);
  });

  it('rejects malformed recommended_resume when present', () => {
    const result = scoreDeepAuditRecord(
      {
        summary: 'Narrative',
        hexagram: '',
        detailed_analysis: { pros: [], cons: [] },
        cruel_truth_2026: 'Grounded outlook.',
        career_growth: 'Analytics path.',
        interview_tactics: 'Lead with SQL.',
        contract_red_flags: 'Check overtime.',
        recommended_resume: {
          resumeId: 'resume-1',
          label: 'Default',
          reasoning: 'Default covers SQL.',
          edits_suggestion: 'Add AWS to Skills.',
        },
      },
      job,
      user,
    );

    expect(result).toBeNull();
  });
});
