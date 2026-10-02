import type { ResumeProfile, UserContext } from '../types';
import { buildApplyEmail, getApplyProfileFields } from './applyAssistant';
import type { CopyKitItem, CopyKitJob } from './extensionProtocol';

/**
 * 投递页复制侧栏（Phase 6.5）要的内容，在 Web App 里拼好再交给扩展。
 * 全部来自用户自己填的投递档案、已存回答和当前简历的结构化数据：不调 LLM、不改写（D11 L3）。
 */

/** 简历要点只取最近几段经历 / 项目，侧栏太长就没法用了。 */
const MAX_RESUME_ENTRIES = 3;

const bullets = (lines: string[] | undefined) =>
  (lines ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n');

const activeResume = (ctx: UserContext): ResumeProfile | undefined =>
  ctx.resumes.find((resume) => resume.id === ctx.activeResumeId) ?? ctx.resumes[0];

const resumeItems = (resume: ResumeProfile | undefined): CopyKitItem[] => {
  if (!resume) return [];
  // 结构化数据来自 Gemini 解析，老数据可能缺字段，统一兜底成空。
  const structured = resume.structured ?? ({} as Partial<ResumeProfile['structured']>);
  const skills = structured.skills ?? { hard: [], soft: [], languages: [], tools: [] };
  const items: CopyKitItem[] = [];
  const add = (id: string, label: string, value: string | undefined) => {
    if (value?.trim())
      items.push({ id: `resume.${id}`, group: 'resume', label, value: value.trim() });
  };

  add('summary', '个人简介', structured.summary);
  add('skills', '技能', [...(skills.hard ?? []), ...(skills.tools ?? [])].join(', '));
  add('languages', '语言', (skills.languages ?? []).join(', '));
  (structured.education ?? [])
    .slice(0, MAX_RESUME_ENTRIES)
    .forEach((edu, index) =>
      add(
        `education.${index}`,
        `教育 · ${edu.school}`,
        [edu.degree, edu.major, edu.years, edu.gpa && `GPA ${edu.gpa}`].filter(Boolean).join(', '),
      ),
    );
  (structured.experience ?? [])
    .slice(0, MAX_RESUME_ENTRIES)
    .forEach((exp, index) =>
      add(`experience.${index}`, `经历 · ${exp.title} @ ${exp.company}`, bullets(exp.bullets)),
    );
  (structured.projects ?? [])
    .slice(0, MAX_RESUME_ENTRIES)
    .forEach((project, index) =>
      add(`project.${index}`, `项目 · ${project.name}`, bullets(project.bullets)),
    );
  return items;
};

export const buildCopyKit = (ctx: UserContext, job?: CopyKitJob): CopyKitItem[] => {
  const applyProfile = ctx.preferences.applyProfile;

  const profile: CopyKitItem[] = getApplyProfileFields(applyProfile).map((field) => ({
    id: `profile.${field.key}`,
    group: 'profile',
    label: field.label,
    value: field.value,
  }));

  const answers: CopyKitItem[] = (applyProfile?.savedAnswers ?? [])
    .filter((answer) => answer.content.trim())
    .map((answer) => ({
      id: `answer.${answer.id}`,
      group: 'answers',
      label: answer.label.trim() || '回答',
      value: answer.content.trim(),
    }));

  const email: CopyKitItem[] =
    job && (profile.length || answers.length)
      ? [
          {
            id: 'email.body',
            group: 'email',
            label: `邮件正文 · ${job.title}${job.company ? ` @ ${job.company}` : ''}`,
            value: buildApplyEmail({ applyProfile, job }),
          },
        ]
      : [];

  return [...profile, ...resumeItems(activeResume(ctx)), ...answers, ...email];
};
