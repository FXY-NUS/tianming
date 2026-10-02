import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job, ResumeStructured, UserContext } from '../types';
import { SKILL_BUCKET_RULES } from '../constants';
import { buildEvidencePrompt, extractJobEvidence, safeParseEvidence } from './jobEvidenceExtractor';

const { mockGenerateContent } = vi.hoisted(() => ({ mockGenerateContent: vi.fn() }));

vi.mock('./llmClient', () => ({
  generateContent: mockGenerateContent,
  getLlmMode: () => 'proxy',
}));

const ctx: UserContext = {
  personas: [],
  resumes: [],
  preferences: {
    displayName: '',
    backgroundSummary: 'NUS DSML student with Python and SQL',
    astrologyProfile: '',
    jobPreferences: '',
    preferredLocations: [],
    avoidKeywords: [],
  },
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
    {
      skill: 'Python',
      priority: 'must',
      evidence: 'JD asks for Python',
      sourceResumeIds: ['resume-a'],
    },
    { skill: 'SQL', priority: 'must' },
  ],
  missingSkills: [{ skill: 'AWS', priority: 'preferred' }],
  transferableSkills: [{ skill: 'R', priority: 'preferred' }],
  cultureSignals: ['Structured analytics team'],
  cultureScore: 70,
  growthReasons: ['Good early-career analytics scope'],
  growthScore: 82,
};

const emptyStructured: ResumeStructured = {
  basic: {},
  education: [],
  experience: [],
  skills: { hard: [], soft: [], languages: [], tools: [] },
  projects: [],
};

describe('jobEvidenceExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses valid evidence JSON', async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(evidence) });

    const result = await extractJobEvidence(job, ctx);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.matchedSkills).toHaveLength(2);
      expect(result.data.matchedSkills[0].sourceResumeIds).toEqual(['resume-a']);
      expect(result.data.growthScore).toBe(82);
    }
  });

  it('sends the shared skill bucket rules as part of the system instruction', async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(evidence) });

    await extractJobEvidence(job, ctx);

    const request = mockGenerateContent.mock.calls[0][0] as {
      config: { systemInstruction: string };
    };
    expect(request.config.systemInstruction).toContain(SKILL_BUCKET_RULES);
  });

  it('strips markdown code fences from JSON before validation', () => {
    const parsed = safeParseEvidence(`\`\`\`json\n${JSON.stringify(evidence)}\n\`\`\``);

    expect(parsed?.matchedSkills[0].skill).toBe('Python');
  });

  it('builds the evidence prompt from resume union context instead of active-only JSON', () => {
    const prompt = buildEvidencePrompt(job, {
      ...ctx,
      resumes: [
        {
          id: 'resume-a',
          label: 'Data CV',
          structured: { ...emptyStructured, skills: { ...emptyStructured.skills, hard: ['SQL'] } },
          piiPolicy: 'keep',
          createdAt: '2026-05-21T00:00:00Z',
        },
        {
          id: 'resume-b',
          label: 'Game CV',
          structured: {
            ...emptyStructured,
            skills: { ...emptyStructured.skills, hard: ['Unity'] },
          },
          piiPolicy: 'keep',
          createdAt: '2026-05-21T00:00:00Z',
        },
      ],
      activeResumeId: 'resume-a',
    });

    expect(prompt).toContain('【简历结构化数据（多简历 Union）】');
    expect(prompt).toContain('SQL（来源: Data CV | resumeId: resume-a）');
    expect(prompt).toContain('Unity（来源: Game CV | resumeId: resume-b）');
    expect(prompt).not.toContain('Active resume:');
  });

  it('rejects malformed JSON responses as schema violations', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{ invalid json }' });

    const result = await extractJobEvidence(job, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.kind).toBe('schema_violation');
    }
  });

  it('classifies empty Gemini responses separately', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    const result = await extractJobEvidence(job, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.kind).toBe('empty_response');
    }
  });

  it('rejects missing required arrays', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ matchedSkills: [], missingSkills: [] }),
    });

    const result = await extractJobEvidence(job, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.kind).toBe('schema_violation');
    }
  });

  it('handles Gemini errors without throwing', async () => {
    mockGenerateContent.mockRejectedValue(new Error('quota exceeded'));

    const result = await extractJobEvidence(job, ctx);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.kind).toBe('gemini_error');
      expect(result.message).toContain('quota');
    }
  });
});
