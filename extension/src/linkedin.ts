import type { JobCardSnapshot } from '../../src/core/matchTypes';
import type { CapturedJob } from '../../services/extensionProtocol';
import { elementToText, inlineText } from './domText';

/**
 * LinkedIn site adapter：只读页面上已经渲染出来的内容（D4'）。
 * LinkedIn 的 class 名经常改，每个字段都按「新 → 旧 → 兜底」排了几个选择器；
 * 优先用 data-* 属性和链接结构这类较稳定的锚点。
 */

const LINKEDIN_ORIGIN = 'https://www.linkedin.com';

export const CARD_SELECTOR = '[data-occludable-job-id], [data-job-id]';

const CARD_TITLE_SELECTORS = [
  'a.job-card-list__title--link',
  'a.job-card-container__link',
  'a.job-card-list__title',
  'a[href*="/jobs/view/"]',
];
const CARD_COMPANY_SELECTORS = [
  '.artdeco-entity-lockup__subtitle',
  '.job-card-container__primary-description',
  '.job-card-container__company-name',
];
const CARD_METADATA_SELECTORS = [
  '.job-card-container__metadata-wrapper li',
  '.job-card-container__metadata-item',
  '.artdeco-entity-lockup__caption li',
  '.artdeco-entity-lockup__caption',
];
const CARD_SALARY_SELECTORS = [
  '.artdeco-entity-lockup__metadata',
  '.job-card-container__salary-info',
];

const DETAIL_TITLE_SELECTORS = [
  '.job-details-jobs-unified-top-card__job-title h1',
  '.job-details-jobs-unified-top-card__job-title',
  '.jobs-unified-top-card__job-title',
  '.t-24.job-details-jobs-unified-top-card__job-title',
  'h1',
];
const DETAIL_COMPANY_SELECTORS = [
  '.job-details-jobs-unified-top-card__company-name',
  '.jobs-unified-top-card__company-name',
];
const DETAIL_LOCATION_SELECTORS = [
  '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text',
  '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
  '.jobs-unified-top-card__bullet',
];
const DETAIL_PILL_SELECTORS = [
  '.job-details-fit-level-preferences button',
  '.job-details-preferences-and-skills__pill',
  '.job-details-jobs-unified-top-card__job-insight',
];
const DETAIL_DESCRIPTION_SELECTORS = [
  '#job-details',
  '.jobs-description__content .jobs-box__html-content',
  '.jobs-description-content__text',
  '.jobs-description__container',
];
export const DETAIL_CONTAINER_SELECTORS = [
  '.jobs-search__job-details--wrapper',
  '.jobs-search__job-details--container',
  '.job-view-layout',
  '.jobs-details',
];

const WORK_MODE_PATTERN = /\b(remote|hybrid|on-site|onsite)\b/i;
const SALARY_PATTERN = /([$€£¥]|\bS?\$|\bSGD\b|\bUSD\b|\/(yr|year|month|mo|hr|hour)\b)/i;

const first = (root: ParentNode, selectors: string[]): Element | null => {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found && inlineText(found)) return found;
  }
  return null;
};

const all = (root: ParentNode, selectors: string[]): Element[] => {
  for (const selector of selectors) {
    const found = Array.from(root.querySelectorAll(selector)).filter((el) => inlineText(el));
    if (found.length) return found;
  }
  return [];
};

export const jobViewUrl = (jobId: string) => `${LINKEDIN_ORIGIN}/jobs/view/${jobId}/`;

/** 从链接或页面 URL 里找 LinkedIn jobId：`/jobs/view/123`、`?currentJobId=123`。 */
export const jobIdFromUrl = (href: string | null | undefined): string | null => {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, LINKEDIN_ORIGIN);
  } catch {
    return null;
  }
  const fromParam = url.searchParams.get('currentJobId');
  if (fromParam && /^\d+$/.test(fromParam)) return fromParam;
  const fromPath = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/);
  return fromPath ? fromPath[1] : null;
};

/** 标题链接里常有 visually-hidden 的重复标题（"… with verification"），优先取 strong / aria-hidden。 */
const titleText = (anchor: Element) =>
  inlineText(anchor.querySelector('strong')) ||
  inlineText(anchor.querySelector('[aria-hidden="true"]')) ||
  inlineText(anchor);

/** "Singapore, Singapore (Hybrid)" → 地点 + 工作模式。 */
export const splitLocation = (raw: string): { locationText: string; workMode: string } => {
  const match = raw.match(/\(([^)]+)\)\s*$/);
  if (match && WORK_MODE_PATTERN.test(match[1])) {
    return { locationText: raw.slice(0, match.index).trim(), workMode: match[1].trim() };
  }
  return { locationText: raw.trim(), workMode: '' };
};

const cardJobId = (card: Element): string | null =>
  card.getAttribute('data-occludable-job-id') ||
  card.getAttribute('data-job-id') ||
  card.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
  jobIdFromUrl(card.querySelector('a[href*="/jobs/view/"]')?.getAttribute('href'));

/**
 * 读一张搜索结果卡片。还没渲染出内容的占位卡（LinkedIn 会把视口外的卡片清空）返回 null，
 * 等它滚进视口、内容出现后再读。
 */
export const readJobCard = (card: Element, now: Date = new Date()): JobCardSnapshot | null => {
  const jobId = cardJobId(card);
  const anchor = first(card, CARD_TITLE_SELECTORS);
  if (!jobId || !anchor) return null;
  const title = titleText(anchor);
  if (!title) return null;

  const metadata = all(card, CARD_METADATA_SELECTORS).map(inlineText);
  const { locationText } = splitLocation(metadata[0] ?? '');
  const salaryText =
    inlineText(first(card, CARD_SALARY_SELECTORS)) ||
    metadata.find((text) => SALARY_PATTERN.test(text)) ||
    '';

  return {
    id: jobId,
    source: 'linkedin',
    title,
    company: inlineText(first(card, CARD_COMPANY_SELECTORS)) || undefined,
    locationText: locationText || undefined,
    salaryText: salaryText || undefined,
    url: jobViewUrl(jobId),
    capturedAt: now.toISOString(),
  };
};

/** 外层卡片（li[data-occludable-job-id]）里还套着一层 [data-job-id]，只取最外层避免重复。 */
export const findJobCards = (root: ParentNode): Element[] =>
  Array.from(root.querySelectorAll(CARD_SELECTOR)).filter(
    (card) => !card.parentElement?.closest(CARD_SELECTOR),
  );

export const findDetailContainer = (doc: ParentNode): Element | null => {
  for (const selector of DETAIL_CONTAINER_SELECTORS) {
    const found = doc.querySelector(selector);
    if (found) return found;
  }
  return null;
};

/**
 * 读用户已经点开的岗位详情。pageUrl 用来取 jobId（搜索页是 ?currentJobId=，独立页是 /jobs/view/）。
 * 正文还没加载出来就返回 null。
 */
export const readJobDetail = (
  doc: ParentNode,
  pageUrl: string,
  now: Date = new Date(),
): CapturedJob | null => {
  const container = findDetailContainer(doc) ?? doc;
  const idFromPage = jobIdFromUrl(pageUrl);
  const idFromDetail = jobIdFromUrl(
    container.querySelector('a[href*="/jobs/view/"]')?.getAttribute('href'),
  );
  // 搜索页点了新卡片后 URL 先变、详情区后更新，两边对不上说明还在加载旧岗位。
  if (idFromPage && idFromDetail && idFromPage !== idFromDetail) return null;
  const jobId = idFromDetail || idFromPage;
  const content = elementToText(first(container, DETAIL_DESCRIPTION_SELECTORS));
  const title = inlineText(first(container, DETAIL_TITLE_SELECTORS));
  if (!jobId || !content || !title) return null;

  // pill 里常带 visually-hidden 的说明（"Matches your job preferences…"），用 elementToText 跳过它。
  const pills = all(container, DETAIL_PILL_SELECTORS).map((pill) =>
    elementToText(pill).replace(/\s+/g, ' '),
  );
  const location = splitLocation(inlineText(first(container, DETAIL_LOCATION_SELECTORS)));
  const workModeFromPill = pills.find((text) => WORK_MODE_PATTERN.test(text)) ?? '';
  const salaryText = pills.find((text) => SALARY_PATTERN.test(text)) ?? '';

  return {
    externalId: jobId,
    source: 'linkedin',
    title,
    company: inlineText(first(container, DETAIL_COMPANY_SELECTORS)),
    url: jobViewUrl(jobId),
    content,
    locationText: location.locationText,
    salaryText,
    workMode: workModeFromPill.match(WORK_MODE_PATTERN)?.[0] ?? location.workMode,
    capturedAt: now.toISOString(),
  };
};
