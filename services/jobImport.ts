import type { Job } from '../types';
import type { CapturedJob } from './extensionProtocol';

/** 一条待导入的 JD：JSON 文件里的一项，或用户粘贴进来的文本。 */
export interface JobImportInput {
  id?: string;
  title?: string;
  company?: string;
  url?: string;
  content?: string;
  salaryText?: string;
  locationText?: string;
  workMode?: string;
}

const UNTITLED_JOB = '待析职位';
const UNKNOWN_COMPANY = '未知公司';
const TITLE_FROM_CONTENT_MAX = 50;

const generateJobId = () => Math.random().toString(36).slice(2, 11);

const firstNonEmptyLine = (content: string) =>
  content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';

export const jobSignature = (job: Pick<Job, 'title' | 'company'>) =>
  `${job.title.trim()}-${job.company.trim()}`;

/** 兼容爬虫导出的多种字段名（snake_case / 别名），统一成 JobImportInput。 */
export const normalizeImportItem = (raw: unknown): JobImportInput => {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, string | undefined>;
  return {
    id: item.id,
    title: item.title,
    company: item.company,
    url: item.url,
    content: item.scraped_content || item.content || '',
    salaryText: item.salaryText || item.salary_text || '',
    locationText: item.locationText || item.location_text || item.location || '',
    workMode: item.workMode || item.work_mode || item.mode || '',
  };
};

export const buildJobFromInput = (
  input: JobImportInput,
  now: Date = new Date(),
  makeId: () => string = generateJobId,
): Job => {
  const content = input.content ?? '';
  const title = (
    input.title?.trim() ||
    firstNonEmptyLine(content).substring(0, TITLE_FROM_CONTENT_MAX).trim() ||
    UNTITLED_JOB
  ).trim();
  const salaryText = input.salaryText?.trim() ?? '';

  return {
    id: input.id || makeId(),
    title,
    company: input.company?.trim() || UNKNOWN_COMPANY,
    url: input.url?.trim() ?? '',
    content,
    salary_text: salaryText || '面议',
    salaryText,
    locationText: input.locationText?.trim() ?? '',
    workMode: input.workMode?.trim() ?? '',
    status: 'New',
    tags: [],
    chatHistory: [],
    importedAt: now.toISOString(),
  };
};

/**
 * 把 JSON 文件内容转成新 Job 列表；按「标题-公司」去重（含与已有岗位、文件内部重复）。
 * 非数组输入抛错，由调用方提示「导入失败」。
 */
export const jobsFromImportPayload = (
  raw: unknown,
  existingJobs: Pick<Job, 'title' | 'company'>[],
  now: Date = new Date(),
): Job[] => {
  if (!Array.isArray(raw)) throw new Error('JD 导入文件必须是数组');

  const seen = new Set(existingJobs.map(jobSignature));
  const result: Job[] = [];
  for (const item of raw) {
    const job = buildJobFromInput(normalizeImportItem(item), now);
    const signature = jobSignature(job);
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(job);
  }
  return result;
};

export type PastedJobResult =
  | { kind: 'created'; job: Job }
  | { kind: 'duplicate'; existing: Job }
  | { kind: 'empty' };

/** 粘贴单个 JD：正文为空拒绝；与已有岗位「标题-公司」重复时返回已有那条，不新建。 */
export const jobFromPastedText = (
  input: JobImportInput,
  existingJobs: Job[],
  now: Date = new Date(),
): PastedJobResult => {
  const content = input.content?.trim() ?? '';
  if (!content) return { kind: 'empty' };

  const job = buildJobFromInput({ ...input, content }, now);
  const signature = jobSignature(job);
  const existing = existingJobs.find((candidate) => jobSignature(candidate) === signature);
  if (existing) return { kind: 'duplicate', existing };
  return { kind: 'created', job };
};

/**
 * 浏览器扩展送来的岗位：走同一条 buildJobFromInput，按「标题-公司」和链接去重。
 * 返回要新增的 Job；重复的直接略过（调用方照样 ack，让扩展出队）。
 */
export const jobsFromExtension = (
  captured: CapturedJob[],
  existingJobs: Pick<Job, 'title' | 'company' | 'url'>[],
  now: Date = new Date(),
): Job[] => {
  const seenSignatures = new Set(existingJobs.map(jobSignature));
  const seenUrls = new Set(existingJobs.map((job) => job.url.trim()).filter(Boolean));
  const result: Job[] = [];
  for (const item of captured) {
    if (!item.content.trim()) continue;
    const job = buildJobFromInput(
      {
        title: item.title,
        company: item.company,
        url: item.url,
        content: item.content,
        salaryText: item.salaryText,
        locationText: item.locationText,
        workMode: item.workMode,
      },
      now,
    );
    const signature = jobSignature(job);
    if (seenSignatures.has(signature) || (job.url && seenUrls.has(job.url))) continue;
    seenSignatures.add(signature);
    if (job.url) seenUrls.add(job.url);
    result.push(job);
  }
  return result;
};
