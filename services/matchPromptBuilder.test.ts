import { describe, expect, it } from 'vitest';
import type { ResumeProfile, ResumeStructured, UserContext } from '../types';
import { buildActiveResumeSection, buildResumeUnionSection } from '../constants';
import { buildResponseSchema, buildSystemPrompt } from './matchPromptBuilder';

const ctx: UserContext = {
  personas: [],
  resumes: [],
  preferences: {
    displayName: '',
    backgroundSummary: '',
    astrologyProfile: '',
    jobPreferences: '',
    preferredLocations: [],
    avoidKeywords: [],
  },
  activePersonaIds: [],
};

const emptyStructured: ResumeStructured = {
  basic: {},
  education: [],
  experience: [],
  skills: { hard: [], soft: [], languages: [], tools: [] },
  projects: [],
};

function makeResume(
  id: string,
  label: string,
  overrides: Partial<ResumeStructured> = {},
): ResumeProfile {
  return {
    id,
    label,
    structured: {
      ...emptyStructured,
      ...overrides,
      basic: { ...emptyStructured.basic, ...overrides.basic },
      skills: { ...emptyStructured.skills, ...overrides.skills },
      education: overrides.education ?? emptyStructured.education,
      experience: overrides.experience ?? emptyStructured.experience,
      projects: overrides.projects ?? emptyStructured.projects,
    },
    piiPolicy: 'keep',
    createdAt: '2026-05-21T00:00:00Z',
  };
}

describe('matchPromptBuilder', () => {
  it('keeps triage prompts evidence-only', () => {
    const prompt = buildSystemPrompt(ctx, 'triage');

    expect(prompt).toContain('Do not output or infer the final overall match score');
  });

  it('keeps audit schema free of LLM-owned final score and judgment fields', () => {
    const schema = buildResponseSchema('audit') as {
      properties: Record<string, { properties?: Record<string, unknown> } | undefined>;
      required: string[];
    };

    expect(schema.properties.score).toBeUndefined();
    expect(schema.properties.overall).toBeUndefined();
    expect(schema.properties.judgment).toBeUndefined();
    expect(schema.properties.recommended_resume).toBeDefined();
    expect(schema.required).not.toContain('score');
    expect(schema.required).not.toContain('overall');
    expect(schema.required).not.toContain('judgment');
    expect(schema.required).toContain('recommended_resume');
  });

  it('includes sourceResumeIds on skill evidence schema without making it required', () => {
    const schema = buildResponseSchema('audit') as {
      properties: {
        matchedSkills?: {
          items?: { properties?: Record<string, unknown>; required?: string[] };
        };
      };
    };

    expect(schema.properties.matchedSkills?.items?.properties?.sourceResumeIds).toBeDefined();
    expect(schema.properties.matchedSkills?.items?.required ?? []).not.toContain('sourceResumeIds');
  });
});

describe('buildResumeUnionSection', () => {
  it('renders a placeholder when the user has no resumes', () => {
    expect(buildResumeUnionSection(ctx)).toContain('用户未上传简历');
  });

  it('degrades to the old active resume section for one resume', () => {
    const resume = makeResume('resume-a', 'Data CV', {
      basic: { name: 'Yan' },
      skills: { hard: ['Python'], soft: [], languages: [], tools: ['Tableau'] },
      education: [{ school: 'NUS', degree: 'MSc', major: 'DSML', years: '2024-2025' }],
    });
    const oneResumeCtx = { ...ctx, resumes: [resume], activeResumeId: resume.id };

    expect(buildResumeUnionSection(oneResumeCtx)).toBe(buildActiveResumeSection(oneResumeCtx));
  });

  it('unions skills, projects, and education with source labels across three resumes', () => {
    const resumeA = makeResume('resume-a', 'Data CV', {
      basic: { name: 'Yan' },
      skills: { hard: ['Python'], soft: [], languages: [], tools: [] },
      education: [{ school: 'NUS', degree: 'MSc', major: 'DSML', years: '2024-2025' }],
      experience: [{ company: 'A', title: 'Analyst', period: '2024-2025', bullets: [] }],
    });
    const resumeB = makeResume('resume-b', 'Game CV', {
      skills: { hard: ['Unity'], soft: [], languages: [], tools: [] },
    });
    const resumeC = makeResume('resume-c', 'Product CV', {
      projects: [{ name: 'Project Y', role: 'PM', bullets: [], tech: ['Figma'] }],
    });

    const prompt = buildResumeUnionSection({
      ...ctx,
      resumes: [resumeA, resumeB, resumeC],
      activeResumeId: resumeA.id,
    });

    expect(prompt).toContain('Unity（来源: Game CV | resumeId: resume-b）');
    expect(prompt).toContain('Project Y(Figma)（来源: Product CV | resumeId: resume-c）');
    expect(prompt).toContain('学历: MSc@NUS(DSML)（来源: Data CV | resumeId: resume-a）');
    expect(prompt).toContain('工作经历（当前激活简历）: Analyst@A(2024-2025)');
  });
});
