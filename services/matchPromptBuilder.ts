import { Type } from '@google/genai';
import type { Job, UserContext } from '../types';
import type { MatchGoal } from '../src/core/matchTypes';
import { FLASH_FILTER_PROMPT, PRO_AUDIT_PROMPT } from '../constants';
import { defineEvidenceSchema } from './jobEvidenceExtractor';

export function buildSystemPrompt(ctx: UserContext, goal: MatchGoal): string {
  if (goal === 'triage') {
    return `${FLASH_FILTER_PROMPT(ctx)}

Scoring protocol:
- Extract evidence only.
- Do not output or infer the final overall match score.
- Final scoring is owned by Tianming's code scoring engine.`;
  }

  return `${PRO_AUDIT_PROMPT(ctx)}

Scoring protocol:
- Generate narrative analysis and structured evidence only.
- Do not output an LLM-owned score or final recommendation.
- Final score and final judgment are owned by Tianming's code scoring engine.`;
}

export function buildResponseSchema(goal: MatchGoal) {
  if (goal === 'triage') return defineBatchScreenSchema();
  return defineDeepAuditSchema();
}

export function buildBatchScreenContents(jobs: Job[]): string {
  const chunkedJobs = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    snippet: j.content.substring(0, 800),
    locationText: j.locationText,
    salaryText: j.salaryText || j.salary_text,
    workMode: j.workMode,
  }));

  return `执行初筛：${JSON.stringify(chunkedJobs)}`;
}

export function buildDeepAuditContents(job: Job): string {
  return `启动天命深度审计。公司：${job.company}。职位：${job.title}。地点：${job.locationText || 'unknown'}。薪资：${job.salaryText || job.salary_text || 'unknown'}。工作模式：${job.workMode || 'unknown'}。JD原文：${job.content}

请同时抽取 matchedSkills、missingSkills、transferableSkills、cultureSignals、growthReasons 等评分证据；若 skill 证据来自简历，请在该 skill 对象上输出 sourceResumeIds。
最终 score 和 judgment 将由代码评分引擎生成，不要自行输出最终分数或最终推荐等级。`;
}

function defineBatchScreenSchema() {
  const evidenceSchema = defineEvidenceSchema();
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        reason: { type: Type.STRING },
        ...evidenceSchema.properties,
      },
      required: ['id', 'reason', ...evidenceSchema.required],
    },
  };
}

function defineDeepAuditSchema() {
  const evidenceSchema = defineEvidenceSchema();
  return {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      hexagram: { type: Type.STRING },
      detailed_analysis: {
        type: Type.OBJECT,
        properties: {
          pros: { type: Type.ARRAY, items: { type: Type.STRING } },
          cons: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['pros', 'cons'],
      },
      cruel_truth_2026: { type: Type.STRING },
      career_growth: { type: Type.STRING },
      interview_tactics: { type: Type.STRING },
      contract_red_flags: { type: Type.STRING },
      recommended_resume: {
        type: Type.OBJECT,
        properties: {
          resumeId: { type: Type.STRING },
          label: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          edits_suggestion: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['resumeId', 'label', 'reasoning', 'edits_suggestion'],
      },
      ...evidenceSchema.properties,
    },
    required: [
      'summary',
      'hexagram',
      'detailed_analysis',
      'cruel_truth_2026',
      'career_growth',
      'interview_tactics',
      'contract_red_flags',
      'recommended_resume',
      ...evidenceSchema.required,
    ],
  };
}
