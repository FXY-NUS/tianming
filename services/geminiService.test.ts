import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job, UserContext } from '../types';
import { batchScreenJobs, deepAuditJob } from './geminiService';

const mockGenerateContent = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return {
      models: {
        generateContent: mockGenerateContent,
      },
      chats: {
        create: vi.fn(() => ({
          sendMessage: mockSendMessage,
        })),
      },
    };
  }),
  Type: {
    OBJECT: 'object',
    ARRAY: 'array',
    STRING: 'string',
    NUMBER: 'number',
  },
}));

const ctx: UserContext = {
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
    backgroundSummary: 'NUS DSML student with Python and SQL',
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
    { skill: 'Python', priority: 'must' },
    { skill: 'SQL', priority: 'must' },
  ],
  missingSkills: [{ skill: 'AWS', priority: 'preferred' }],
  transferableSkills: [],
  cultureSignals: ['Structured analytics team'],
  cultureScore: 70,
  growthReasons: ['Good early-career analytics scope'],
  growthScore: 82,
};

describe('geminiService scoring integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('GEMINI_API_KEY', 'test-key');
  });

  it('uses the scoring engine result for batch screening instead of an LLM score', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify([{ id: job.id, score: 5, reason: 'skills align', ...evidence }]),
    });

    const result = await batchScreenJobs([job], ctx);

    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('skills align');
    expect(result[0].score).toBe(result[0].matchScore.overall);
    expect(result[0].score).not.toBe(5);
  });

  it('overrides Pro audit score and judgment with the deterministic match score', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        score: 1,
        summary: 'LLM narrative',
        hexagram: '',
        judgment: 'LLM judgment',
        detailed_analysis: { pros: ['Python match'], cons: ['AWS gap'] },
        cruel_truth_2026: 'Keep expectations grounded.',
        career_growth: 'Analytics to ML path.',
        interview_tactics: 'Lead with Python and SQL.',
        contract_red_flags: 'Check overtime.',
        ...evidence,
      }),
    });

    const result = await deepAuditJob(job, ctx);

    expect(result.score).toBe(result.matchScore.overall);
    expect(result.score).not.toBe(1);
    expect(result.judgment).not.toBe('LLM judgment');
    expect(result.evidenceStatus).toBe('ok');
  });
});
