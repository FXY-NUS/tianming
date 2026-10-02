import { describe, expect, it } from 'vitest';
import type { ResumeProfile, UserContext } from '../types';
import { buildCopyKit } from './copyKit';

const resume = (
  id: string,
  overrides: Partial<ResumeProfile['structured']> = {},
): ResumeProfile => ({
  id,
  label: id,
  piiPolicy: 'keep',
  createdAt: '2026-10-02T00:00:00.000Z',
  structured: {
    basic: {},
    summary: `${id} summary`,
    education: [{ school: 'NUS', degree: 'BSc', major: 'DSML', years: '2022-2026', gpa: '4.5' }],
    experience: [
      { company: 'Acme', title: 'Data Intern', period: '2025', bullets: ['Built dashboards', ' '] },
    ],
    skills: {
      hard: ['SQL', 'Python'],
      soft: ['Teamwork'],
      languages: ['English'],
      tools: ['Tableau'],
    },
    projects: [{ name: 'Tianming', role: 'Lead', bullets: ['Shipped extension'], tech: ['React'] }],
    ...overrides,
  },
});

const ctx = (overrides: Partial<UserContext> = {}): UserContext => ({
  personas: [],
  resumes: [],
  activePersonaIds: [],
  preferences: {} as UserContext['preferences'],
  ...overrides,
});

describe('buildCopyKit', () => {
  it('没有档案也没有简历时为空，侧栏据此提示去填投递档案', () => {
    expect(buildCopyKit(ctx())).toEqual([]);
    expect(buildCopyKit(ctx(), { title: 'Analyst', company: 'Acme' })).toEqual([]);
  });

  it('按投递档案 → 当前简历 → 已存回答 → 邮件的顺序给出，空白项跳过', () => {
    const items = buildCopyKit(
      ctx({
        resumes: [resume('general'), resume('focused')],
        activeResumeId: 'focused',
        preferences: {
          applyProfile: {
            fullName: 'Yan Tang',
            email: 'yan@example.com',
            phone: '  ',
            savedAnswers: [
              { id: 'a1', label: 'Why us', content: 'Because.', updatedAt: '' },
              { id: 'a2', label: 'Blank', content: '   ', updatedAt: '' },
            ],
          },
        } as UserContext['preferences'],
      }),
      { title: 'Data Analyst', company: 'Acme' },
    );

    expect(items.map((item) => item.id)).toEqual([
      'profile.fullName',
      'profile.email',
      'resume.summary',
      'resume.skills',
      'resume.languages',
      'resume.education.0',
      'resume.experience.0',
      'resume.project.0',
      'answer.a1',
      'email.body',
    ]);
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get('resume.summary')?.value).toBe('focused summary');
    expect(byId.get('resume.skills')?.value).toBe('SQL, Python, Tableau');
    expect(byId.get('resume.experience.0')).toMatchObject({
      label: '经历 · Data Intern @ Acme',
      value: '• Built dashboards',
    });
    expect(byId.get('email.body')?.label).toBe('邮件正文 · Data Analyst @ Acme');
    expect(byId.get('email.body')?.value).toContain('Data Analyst role at Acme');
  });

  it('不知道是哪个岗位时不拼邮件；简历缺字段不崩', () => {
    const broken = { ...resume('old'), structured: { basic: {} } } as unknown as ResumeProfile;
    const items = buildCopyKit(
      ctx({
        resumes: [broken],
        preferences: { applyProfile: { email: 'yan@example.com' } } as UserContext['preferences'],
      }),
    );
    expect(items.map((item) => item.id)).toEqual(['profile.email']);
  });
});
