/**
 * Phase 4.6 Q3 反通胀 smoke（doc/phase-4-6-notes.md §4.1），代码侧自动化版。
 *
 * Gemini 的 Pass B 证据在这里用手写夹具代替（union prompt 下每条 skill 都带
 * sourceResumeIds），评分走真实的 buildMatchScore / computeResumeBreakdown。
 * 测的是同一份证据下，切换 activeResumeId 时"什么都会"简历能不能把分数抬上去。
 *
 * 修复前（scoringVersion phase4-scoring-v2.0），技能分 / 总分：
 *   激活 A（ML 版）  71.3 / 75.2
 *   激活 B（咨询版） 42.6 / 59.2
 *   激活 C（全都有） 78.7 / 79.3  ← 高于 A，命中 notes §4.1 的反例
 * 原因有两处：transferable 分子分母都按半权，沾边项等于完整命中；×0.5 只打折"来自
 * 非激活简历"的 skill，C 本身就是所有 skill 的来源，激活 C 时一条都不打折。breakdown
 * 还把 transferable 关键词算成"JD 技能"，C 必然排成 bestResumeId。
 *
 * 修复后（phase4-scoring-v2.1 / rubric-v1.2），技能分 / 总分：
 *   激活 A 68.5 / 73.6 · 激活 B 40.7 / 58.2 · 激活 C 68.5 / 73.6
 * transferable 分母按完整需求计、分子固定半分、不按来源区分，所以沾边项对每份简历
 * 计分相同，堆得再多也拉不开差距；breakdown 只看 matched + missing，平手时推荐更聚焦
 * 的简历。
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

  it('discounts matched skills that only live in non-active resumes and says so', () => {
    const activeB = auditWith(resumeB.id).dimensions.find((d) => d.key === 'skill');
    expect(activeB?.warnings).toContain(
      'Some matched skills only appear in non-active resumes and were discounted.',
    );
    // 激活 A 时 ML / Python / AWS 都来自 A，不该有打折提示。
    const activeA = auditWith(resumeA.id).dimensions.find((d) => d.key === 'skill');
    expect(activeA?.warnings ?? []).not.toContain(
      'Some matched skills only appear in non-active resumes and were discounted.',
    );

    // 激活 B 时，ML / Python / AWS 都只来自其他简历 → 每条减半，技能分明显掉下来。
    expect(skillScore(resumeB.id)).toBeLessThan(skillScore(resumeA.id) - 20);
  });

  it('does not let the "knows everything" resume beat the focused ML resume', () => {
    expect(skillScore(resumeC.id)).toBeLessThanOrEqual(skillScore(resumeA.id));
    expect(auditWith(resumeC.id).overall).toBeLessThanOrEqual(auditWith(resumeA.id).overall);
  });

  it('does not reward piling more loosely related keywords into transferable', () => {
    const noisy: ExtractedEvidence = {
      ...evidence,
      transferableSkills: [
        ...evidence.transferableSkills,
        ...['Sales', 'Business Writing', 'Excel Modeling'].map((skill) => ({
          skill,
          priority: 'unknown' as const,
          sourceResumeIds: [resumeC.id],
        })),
      ],
    };
    const noisySkill = (activeResumeId: string) =>
      buildMatchScore({
        job,
        user: userWithActive(activeResumeId),
        goal: 'audit',
        evidence: noisy,
      }).dimensions.find((d) => d.key === 'skill')?.score ?? -1;

    expect(noisySkill(resumeC.id)).toBeLessThanOrEqual(skillScore(resumeC.id));
    expect(noisySkill(resumeC.id)).toBeLessThanOrEqual(noisySkill(resumeA.id));
  });

  it('does not rank the "knows everything" resume as the best fit by default', () => {
    const breakdown = computeResumeBreakdown(userWithActive(resumeA.id), evidence);
    expect(breakdown?.bestResumeId).toBe(resumeA.id);
    // 只数 JD 直接要求（matched + missing），transferable 里的沾边词不算。
    expect(breakdown?.totalJdSkills).toBe(4);
  });

  it('prefers the focused resume on a coverage tie even when the other one is active', () => {
    const breakdown = computeResumeBreakdown(userWithActive(resumeC.id), evidence);
    expect(breakdown?.bestResumeId).toBe(resumeA.id);
  });

  it('still ranks the consulting resume below the ML resume in the breakdown', () => {
    const breakdown = computeResumeBreakdown(userWithActive(resumeA.id), evidence);
    const coverage = Object.fromEntries(
      breakdown?.perResume.map((r) => [r.resumeId, r.coverageCount]) ?? [],
    );
    expect(coverage[resumeB.id]).toBeLessThan(coverage[resumeA.id]);
  });
});
