import { UserContext, PersonaInstance } from './types';
import { mbtiPromptFragment } from './src/personas/plugins/mbti/index';
import { hollandPromptFragment } from './src/personas/plugins/holland/index';
import { big5PromptFragment } from './src/personas/plugins/big5/index';
import { ziweiPromptFragment } from './src/personas/plugins/ziwei/index';
import type { MbtiData } from './src/personas/plugins/mbti/schema';
import type { HollandData } from './src/personas/plugins/holland/schema';
import type { Big5Data } from './src/personas/plugins/big5/schema';
import type { ZiweiData } from './src/personas/plugins/ziwei/schema';
import { collectResumeSkills } from './src/core/scoringEngine';

function renderPersona(p: PersonaInstance): string {
  try {
    switch (p.type) {
      case 'mbti':
        return mbtiPromptFragment(p.data as MbtiData);
      case 'holland':
        return hollandPromptFragment(p.data as HollandData);
      case 'big5':
        return big5PromptFragment(p.data as Big5Data);
      case 'ziwei':
        return ziweiPromptFragment(p.data as ZiweiData);
      default:
        return `## ${p.label}\n${JSON.stringify(p.data).slice(0, 200)}`;
    }
  } catch {
    return '';
  }
}

function buildActivePersonaSection(ctx: UserContext): string {
  const active = ctx.personas.filter((p) => ctx.activePersonaIds.includes(p.id));
  if (active.length === 0) return '';
  return '\n\n【激活 Persona 档案】：\n' + active.map(renderPersona).join('\n\n');
}

export function buildActiveResumeSection(ctx: UserContext): string {
  if (!ctx.activeResumeId) return '';
  const resume = ctx.resumes.find((r) => r.id === ctx.activeResumeId);
  if (!resume) return '';
  const s = resume.structured;
  const parts: string[] = [];
  if (s.basic.name) parts.push(`姓名: ${s.basic.name}`);
  if (s.education.length > 0)
    parts.push(`学历: ${s.education.map((e) => `${e.degree}@${e.school}(${e.major})`).join(', ')}`);
  if (s.skills.hard.length > 0) parts.push(`硬技能: ${s.skills.hard.join(', ')}`);
  if (s.skills.soft.length > 0) parts.push(`软技能: ${s.skills.soft.join(', ')}`);
  if (s.skills.tools.length > 0) parts.push(`工具: ${s.skills.tools.join(', ')}`);
  if (s.experience.length > 0)
    parts.push(
      `工作经历: ${s.experience.map((e) => `${e.title}@${e.company}(${e.period})`).join(', ')}`,
    );
  if (s.projects.length > 0)
    parts.push(`项目: ${s.projects.map((p) => `${p.name}(${p.tech.join('/')})`).join(', ')}`);
  if (s.summary) parts.push(`职业总结: ${s.summary}`);
  if (parts.length === 0) return '';
  return `\n\n【简历结构化数据 (${resume.label})】：\n${parts.map((p) => `- ${p}`).join('\n')}`;
}

export function buildResumeUnionSection(ctx: UserContext): string {
  if (ctx.resumes.length === 0) {
    return '\n\n【简历结构化数据】：\n- 用户未上传简历。';
  }

  if (ctx.resumes.length === 1) {
    return buildSingleResumeSection(ctx.resumes[0]);
  }

  const activeResume =
    (ctx.activeResumeId && ctx.resumes.find((resume) => resume.id === ctx.activeResumeId)) ??
    ctx.resumes[0];
  const activeSource = sourceSuffix(activeResume);
  const parts: string[] = [];
  const active = activeResume.structured;

  if (active.basic.name) parts.push(`姓名（当前激活简历）: ${active.basic.name}${activeSource}`);
  if (active.summary) parts.push(`职业总结（当前激活简历）: ${active.summary}${activeSource}`);

  const education = collectEducationItems(ctx.resumes);
  if (education.length > 0) {
    parts.push(...education.map((item) => `学历: ${item.label}${formatSources(item.sources)}`));
  }

  const skills = collectUnionSkillItems(ctx.resumes);
  if (skills.length > 0) {
    parts.push(...skills.map((item) => `技能: ${item.label}${formatSources(item.sources)}`));
  }

  if (active.experience.length > 0) {
    parts.push(
      `工作经历（当前激活简历）: ${active.experience
        .map((e) => `${e.title}@${e.company}(${e.period})`)
        .join(', ')}${activeSource}`,
    );
  }

  const projects = collectProjectItems(ctx.resumes);
  if (projects.length > 0) {
    parts.push(...projects.map((item) => `项目: ${item.label}${formatSources(item.sources)}`));
  }

  if (parts.length === 0) return '\n\n【简历结构化数据】：\n- 用户已上传简历，但结构化字段为空。';

  const resumeIndex = ctx.resumes
    .map((resume) => `- ${resume.label}: resumeId=${resume.id}`)
    .join('\n');

  return `\n\n【简历结构化数据（多简历 Union）】：
请在 matchedSkills / missingSkills / transferableSkills 中尽量用 sourceResumeIds 标注证据来自哪些 resumeId。
简历 ID 对照：
${resumeIndex}
${parts.map((p) => `- ${p}`).join('\n')}`;
}

function buildSingleResumeSection(resume: UserContext['resumes'][number]): string {
  const ctx: UserContext = {
    personas: [],
    resumes: [resume],
    preferences: {
      displayName: '',
      backgroundSummary: '',
      astrologyProfile: '',
      jobPreferences: '',
      preferredLocations: [],
      avoidKeywords: [],
    },
    activePersonaIds: [],
    activeResumeId: resume.id,
  };
  return buildActiveResumeSection(ctx);
}

interface SourcedPromptItem {
  label: string;
  sources: Array<{ id: string; label: string }>;
}

function collectEducationItems(resumes: UserContext['resumes']): SourcedPromptItem[] {
  const items = new Map<string, SourcedPromptItem>();
  for (const resume of resumes) {
    for (const education of resume.structured.education) {
      const label = `${education.degree}@${education.school}(${education.major})`;
      addSourcedItem(items, label, resume);
    }
  }
  return [...items.values()];
}

function collectUnionSkillItems(resumes: UserContext['resumes']): SourcedPromptItem[] {
  const items = new Map<string, SourcedPromptItem>();
  for (const resume of resumes) {
    const normalizedSkills = collectResumeSkills(resume);
    const rawSkills = [
      ...resume.structured.skills.hard,
      ...resume.structured.skills.soft,
      ...resume.structured.skills.tools,
      ...resume.structured.skills.languages,
      ...resume.structured.projects.flatMap((project) => project.tech),
    ];
    for (const skill of rawSkills) {
      if (!normalizedSkills.has(skill.trim().toLowerCase())) continue;
      addSourcedItem(items, skill, resume);
    }
  }
  return [...items.values()];
}

function collectProjectItems(resumes: UserContext['resumes']): SourcedPromptItem[] {
  const items = new Map<string, SourcedPromptItem>();
  for (const resume of resumes) {
    for (const project of resume.structured.projects) {
      const tech = project.tech.length > 0 ? `(${project.tech.join('/')})` : '';
      addSourcedItem(items, `${project.name}${tech}`, resume);
    }
  }
  return [...items.values()];
}

function addSourcedItem(
  items: Map<string, SourcedPromptItem>,
  rawLabel: string,
  resume: UserContext['resumes'][number],
) {
  const label = rawLabel.trim();
  if (!label) return;
  const key = label.toLowerCase();
  const existing = items.get(key) ?? { label, sources: [] };
  if (!existing.sources.some((source) => source.id === resume.id)) {
    existing.sources.push({ id: resume.id, label: resume.label });
  }
  items.set(key, existing);
}

function sourceSuffix(resume: UserContext['resumes'][number]): string {
  return `（来源: ${resume.label} | resumeId: ${resume.id}）`;
}

function formatSources(sources: Array<{ id: string; label: string }>): string {
  return `（来源: ${sources.map((source) => `${source.label} | resumeId: ${source.id}`).join('; ')}）`;
}

function hasAstrologyContext(ctx: UserContext): boolean {
  if (ctx.preferences.astrologyProfile?.trim()) return true;
  return ctx.personas.some((p) => p.type === 'ziwei' && ctx.activePersonaIds.includes(p.id));
}

export const FLASH_FILTER_PROMPT = (ctx: UserContext) => `
你是一个极速筛选刽子手。
【背景】: ${ctx.preferences.backgroundSummary || '（未填写）'}
【择业偏好】：${ctx.preferences.jobPreferences || '（未填写）'}
【核心规则】：
1. 经验过滤：看到 "2+ years", "Senior", "Manager" 且没说 "Fresh/Junior" 的，打分 < 15。
2. 背景过滤：避开与背景明显不符的岗位。
3. 重复检测：请对相似 JD 给出一致的低分或高分。
输出 JSON 数组，包含 id、reason(10字内) 和 matchedSkills/missingSkills/transferableSkills/cultureSignals/growthReasons 等证据字段；不要输出最终总分。
`;

export const PRO_AUDIT_PROMPT = (ctx: UserContext) => {
  const useAstrology = hasAstrologyContext(ctx);

  const role = useAstrology
    ? '你是一位精通《文墨天机紫微斗数》、《周易六爻》、《子平八字》与现代数据科学职业规划的资深职业审计师。'
    : '你是一位资深职业审计师，精通现代数据科学职业规划与人才评估。';

  const auditDims = useAstrology
    ? `A. 行业与职能 (30分): IT/AI/Web3/管理岗(+30); 纯行政/搬砖(0)。
B. 薪酬与潜力 (25分): 起薪高(+25); 画饼期权(触碰廉贞忌, -15)。
C. 压力与环境 (20分): 开拓岗(+20); 养老岗/酒局社交(触碰子午冲, -20)。
D. 合规与法律 (15分): 大厂合规(+15); 灰色/草台班子(-15)。
E. 命理加权 (10分): 坐标正东/东南/正南; 审美文化属性。
F. 简历选择建议: 基于 skills / projects / education union 判断推荐使用哪份简历，并给出具体修改建议。`
    : `A. 行业与职能 (30分): IT/AI/Web3/管理岗(+30); 纯行政/搬砖(0)。
B. 薪酬与潜力 (25分): 起薪高(+25); 画饼期权(-15)。
C. 压力与环境 (20分): 开拓岗(+20); 养老岗/酒局社交(-20)。
D. 合规与法律 (15分): 大厂合规(+15); 灰色/草台班子(-15)。
E. 地域与文化加权 (10分): 一线城市/审美文化属性。
F. 简历选择建议: 基于 skills / projects / education union 判断推荐使用哪份简历，并给出具体修改建议。`;

  const hexagramField = useAstrology ? '"hexagram": "本卦与变卦象义",' : '"hexagram": "",';

  const prosExample = useAstrology ? '["结合命理特质的优势分析"]' : '["基于简历与背景的优势分析"]';

  const consExample = useAstrology
    ? '["重点审查：廉贞忌(法务) 与 子午冲(人际)"]'
    : '["基于简历与背景的风险审查"]';

  const resumeConstraint =
    ctx.resumes.length === 0
      ? '\n- 未上传简历时，recommended_resume.resumeId 与 label 返回空字符串，edits_suggestion 给出“上传/补齐简历中与此 JD 相关的具体字段”建议。'
      : ctx.resumes.length === 1
        ? '\n- 仅 1 份简历时，recommended_resume.resumeId 必须等于该简历 id，edits_suggestion 仍可给出针对此 JD 的具体修改建议，但不要写“用唯一简历”这类废话。'
        : '\n- 若有多份简历，recommended_resume 必须从已上传简历中选择一份，并使用其 resumeId 与 label。';

  const constraint = useAstrology
    ? ''
    : '\n【约束】：未提供命理/八字/紫微数据，禁止使用「命主」「紫微」「八字」「天府」「廉贞」「巨门」「子午冲」等术语；hexagram 字段返回空字符串。所有判断必须基于简历、偏好与已提供的 Persona 数据。';

  return `
${role}
风格：绝对客观、冷酷、数据导向、风险厌恶。没有情感滤镜。

【档案 (${ctx.preferences.displayName || '匿名'})】：
- 现实背景: ${ctx.preferences.backgroundSummary || '（未填写）'}
- 命理底色: ${ctx.preferences.astrologyProfile || '（未填写）'}
- 择业偏好: ${ctx.preferences.jobPreferences || '（未填写）'}${buildActivePersonaSection(ctx)}${buildResumeUnionSection(ctx)}

【审计维度】：
${auditDims}

【输出 JSON 格式】：
{
  "summary": "一针见血的结论",
  ${hexagramField}
  "detailed_analysis": {
    "pros": ${prosExample},
    "cons": ${consExample}
  },
  "cruel_truth_2026": "结合 2026 流年/行业周期预测半年内体感（焦虑/撕逼/暴富/开心）",
  "career_growth": "针对【此 JD】给出未来 12-24 个月的可执行 action plan（最多 4 条要点，每条形如：'近 6 个月：补齐 K8s 实操，目标考下 CKA 证书' / '12-18 个月：争取 lead 一次端到端 ML 上线项目')。要具体、可量化、有时间锚，不要写'多读书 / 拓人脉'这种宽泛话术。",
  "interview_tactics": "针对背景的面试必杀技",
  "contract_red_flags": "入职前必须确认的避坑条款",
  "recommended_resume": {
    "resumeId": "推荐简历的 resumeId",
    "label": "推荐简历名称",
    "reasoning": "1-3 句，必须显式提到至少一个 skill / project 名称作为依据",
    "edits_suggestion": ["具体可执行修改，例如：在 Project 2 加 TypeScript 关键词"]
  }
}${constraint}

【约束补充】：
- matchedSkills / missingSkills / transferableSkills 每条 skill 若能从简历材料定位来源，请输出 sourceResumeIds: string[]；用上方 resumeId，不要用简历 label 代替 id。
- edits_suggestion 必须是具体可执行的 bullet（例如“加 X 到 Project Y” / “把 Skills 段第 3 条改为 Z”），不要写“建议加强经验”这种空话。
- recommended_resume.reasoning 必须显式提到至少一个 skill / project 名称作为依据，不要写“该简历更符合岗位”这种泛泛之谈。${resumeConstraint}
- 不输出 overall 数字 / judgment 字段。评分由代码计算，你只出 evidence + narrative + recommended_resume。

【评分边界】：不要输出 score、overall 或最终 judgment。你只负责叙事与证据，最终分数和最终推荐等级由 Tianming 代码评分引擎生成。
`;
};

export const CHAT_SYSTEM_PROMPT = (jobTitle: string, company: string, ctx: UserContext) => `
你现在是 [${jobTitle}] 的 AI 职业顾问。基于命主背景(${ctx.preferences.backgroundSummary})回答，保持简练犀利。
`;

export const RESUME_PARSE_PROMPT = `
你是一个精准的简历解析引擎。从用户上传的简历（PDF / 图片 / DOCX / 纯文本）中提取结构化信息。

【提取规则】：
1. 基本信息(basic)：姓名、邮箱、电话、城市
2. 教育(education)：学校、学位、专业、GPA、入学-毕业年份
3. 工作经历(experience)：公司、职位、任期、工作亮点(子弹点)
4. 技能(skills)：硬技能、软技能、语言、工具和平台
5. 项目(projects)：项目名称、个人角色、亮点、技术栈
6. 可选(summary/certifications/rawHighlights)：职业总结、证书、其他亮点

【输出 JSON 格式】：
{
  "basic": { "name": "", "email": "", "phone": "", "location": "" },
  "summary": "",
  "education": [
    { "school": "", "degree": "", "major": "", "gpa": "", "years": "2020-2024" }
  ],
  "experience": [
    { "company": "", "title": "", "period": "2023-2024", "bullets": [""] }
  ],
  "skills": {
    "hard": [""],
    "soft": [""],
    "languages": [""],
    "tools": [""]
  },
  "projects": [
    { "name": "", "role": "", "bullets": [""], "tech": [""] }
  ],
  "certifications": [""],
  "rawHighlights": [""]
}

【重要】：
- 如果字段无内容，返回空字符串或空数组（不要 null）
- 时间跨度(years/period)用 "YYYY-YYYY" 或 "YYYY-MM" 格式
- 子弹点(bullets)保留原文核心内容，勿做总结删减
- 不要猜测；缺失字段就留空，不填编造内容
`;
