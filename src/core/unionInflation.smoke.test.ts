/**
 * Phase 4.6 Q3 反通胀 smoke（doc/phase-4-6-notes.md §4.1），代码侧自动化版。
 *
 * Gemini 的 Pass B 证据在这里用手写夹具代替（union prompt 下每条 skill 都带
 * sourceResumeIds），评分走真实的 buildMatchScore / computeResumeBreakdown。
 * 测的是同一份证据下，切换 activeResumeId 时"什么都会"简历能不能把分数抬上去。
 *
 * 实测结论（2026-10-02，scoringVersion phase4-scoring-v2.0）：
 *   激活 A（ML 版）  overall 71.3
 *   激活 B（咨询版） overall 42.6
 *   激活 C（全都有） overall 78.7  ← 高于 A，命中 notes §4.1 的反例
 * 原因：×0.5 只打折"来自非激活简历"的 skill；C 本身就是所有 skill 的来源，激活 C
 * 时没有任何一条被打折，transferable 里多出来的关键词全额计入。breakdown 同理把
 * C 排成 bestResumeId。两条 `it.fails` 记录这个已知缺口，修复落地后改回 `it`。
 */
import { describe, expect, it } from 'vitest';
import type { Job, ResumeProfile, ResumeStructured, UserContext } from '../../types';
import type { ExtractedEvidence } from './matchTypes';
import { buildMatchScore, computeResumeBreakdown } from './scoringEngine';

const base: ResumeStructured = {
  basic: {},
  education: [],
  experience: [{ company: 'Acme', title: 'Engineer', period: '2022-2026', bullets: [] }],
  skills: { hard: [], soft: [], languages: [], tools: [] },
  projects: [],
};

const makeResume = (id: string, label: string, hard: string[]): ResumeProfile => ({
  id,
  label,
  structured: { ...base, skills: { ...base.skills, hard } },
  piiPolicy: 'keep',
  createdAt: '2026-05-20T00:00:00Z',
});

// A：技术岗版 · B：咨询版 · C：什么都会版（A+B 全部 skills + marketing / sales）
const resumeA = makeResume('resume-ml', 'ML 技术版', ['Machine Learning', 'Python', 'AWS']);
const resumeB = makeResume('resume-consulting', '咨询版', [
  'Strategic Analysis',
  'Business Writing',
  'Excel Modeling',
]);
const resumeC = makeResume('resume-everything', '什么都会版', [
  ...resumeA.structured.skills.hard,
  ...resumeB.structured.skills.hard,
  'Marketing',
  'Sales',
]);

const job: Job = {
  id: 'job-ml',
  title: 'Senior ML Engineer',
  company: 'DeepCo',
  url: '',
  content: 'Senior ML Engineer: Machine Learning, Python, AWS, Kubernetes required.',
  salary_text: '',
  status: 'New',
  importedAt: '2026-05-20T00:00:00Z',
  tags: [],
  chatHistory: [],
};

/** union prompt 下 Gemini 对这份 ML JD 抽出的证据：来源标注按简历实际内容打。 */
const evidence: ExtractedEvidence = {
  matchedSkills: [
    { skill: 'Machine Learning', priority: 'must', sourceResumeIds: [resumeA.id, resumeC.id] },
    { skill: 'Python', priority: 'must', sourceResumeIds: [resumeA.id, resumeC.id] },
    { skill: 'AWS', priority: 'must', sourceResumeIds: [resumeA.id, resumeC.id] },
  ],
  missingSkills: [{ skill: 'Kubernetes', priority: 'must' }],
  transferableSkills: [
    {
      skill: 'Strategic Analysis',
      priority: 'preferred',
      sourceResumeIds: [resumeB.id, resumeC.id],
    },
    { skill: 'Marketing', priority: 'unknown', sourceResumeIds: [resumeC.id] },
  ],
  cultureSignals: [],
  growthReasons: [],
};

const userWithActive = (activeResumeId: string): UserContext => ({
  personas: [],
  resumes: [resumeA, resumeB, resumeC],
  preferences: {
    displayName: '',
    backgroundSummary: '',
    astrologyProfile: '',
    jobPreferences: '',
    preferredLocations: [],
    avoidKeywords: [],
  },
  activeResumeId,
  activePersonaIds: [],
});

const auditWith = (activeResumeId: string) =>
  buildMatchScore({ job, user: userWithActive(activeResumeId), goal: 'audit', evidence });

const skillScore = (activeResumeId: string) =>
  auditWith(activeResumeId).dimensions.find((d) => d.key === 'skill')?.score ?? -1;

describe('Phase 4.6 Q3 anti-inflation smoke', () => {
  it('scores the 1:1 ML resume higher than the consulting resume on an ML JD', () => {
    expect(auditWith(resumeA.id).overall).toBeGreaterThan(auditWith(resumeB.id).overall);
    expect(skillScore(resumeA.id)).toBeGreaterThan(skillScore(resumeB.id));
  });

  it('discounts skills that only live in non-active resumes and says so', () => {
    const activeA = auditWith(resumeA.id).dimensions.find((d) => d.key === 'skill');
    expect(activeA?.warnings).toContain(
      'Some matched skills only appear in non-active resumes and were discounted.',
    );

    // 激活 B 时，ML / Python / AWS 都只来自其他简历 → 每条减半，技能分明显掉下来。
    expect(skillScore(resumeB.id)).toBeLessThan(skillScore(resumeA.id) - 20);
  });

  // 已知缺口 · 见文件头。修复后把 it.fails 改回 it。
  it.fails('does not let the "knows everything" resume beat the focused ML resume', () => {
    expect(skillScore(resumeC.id)).toBeLessThanOrEqual(skillScore(resumeA.id));
    expect(auditWith(resumeC.id).overall).toBeLessThanOrEqual(auditWith(resumeA.id).overall);
  });

  // 已知缺口 · breakdown 把 transferable 关键词也算成"JD 技能"，全都有的简历必然排第一。
  it.fails('does not rank the "knows everything" resume as the best fit by default', () => {
    const breakdown = computeResumeBreakdown(userWithActive(resumeA.id), evidence);
    expect(breakdown?.bestResumeId).not.toBe(resumeC.id);
  });

  it('still ranks the consulting resume below the ML resume in the breakdown', () => {
    const breakdown = computeResumeBreakdown(userWithActive(resumeA.id), evidence);
    const coverage = Object.fromEntries(
      breakdown?.perResume.map((r) => [r.resumeId, r.coverageCount]) ?? [],
    );
    expect(coverage[resumeB.id]).toBeLessThan(coverage[resumeA.id]);
  });
});
