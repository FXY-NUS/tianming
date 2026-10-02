import type { JobCardSnapshot } from '../../../src/core/matchTypes';
import { renderBadge } from '../badge';
import {
  findDetailContainer,
  findJobCards,
  jobIdFromUrl,
  readJobCard,
  readJobDetail,
} from '../linkedin';
import type { CaptureResponse, RuntimeRequest, TriageResponse } from '../messages';

/**
 * LinkedIn 页面上的全部行为：
 * - 卡片：只处理滚进视口的已加载卡片（IntersectionObserver），读快照、打徽章、批量送去粗筛。
 * - 详情：用户点开某个岗位后，在详情区顶部放「送进天命」按钮；点了才抽 JD、进待送队列。
 * 不翻页、不请求详情页、不后台抓取（D4'）。所有浏览器 API 都从 deps 注入，方便用 fixture 测。
 */

export interface LinkedInContentDeps {
  doc: Document;
  getUrl: () => string;
  send: (message: RuntimeRequest) => Promise<unknown>;
  /** 测试里或老浏览器没有 IntersectionObserver 时传 null：所有卡片视为可见。 */
  createIntersectionObserver?:
    | ((callback: IntersectionObserverCallback) => IntersectionObserver)
    | null;
  now?: () => Date;
  /** DOM 变化后重新扫描的防抖间隔；测试里设 0。 */
  rescanDelayMs?: number;
  triageBatchDelayMs?: number;
}

export const CAPTURE_BUTTON_ID = 'tianming-capture';
const PROCESSED_ATTR = 'data-tianming-job-id';

const BUTTON_TEXT = {
  idle: '送进天命',
  sending: '送出中…',
  sent: '✓ 已加入天命 · 打开天命',
  notReady: 'JD 还没加载完，稍后再点',
  error: '没送出去，再点一次',
} as const;

const isTriageResponse = (value: unknown): value is TriageResponse =>
  !!value && Array.isArray((value as TriageResponse).results);

export const startLinkedInContent = (deps: LinkedInContentDeps) => {
  const { doc, getUrl, send } = deps;
  const now = deps.now ?? (() => new Date());
  const rescanDelay = deps.rescanDelayMs ?? 250;
  const triageDelay = deps.triageBatchDelayMs ?? 300;

  const cardsById = new Map<string, HTMLElement>();
  let pendingTriage: JobCardSnapshot[] = [];
  let triageTimer: ReturnType<typeof setTimeout> | null = null;
  let rescanTimer: ReturnType<typeof setTimeout> | null = null;

  const flushTriage = async () => {
    triageTimer = null;
    const batch = pendingTriage;
    pendingTriage = [];
    if (!batch.length) return;
    try {
      const response = await send({ type: 'triage', cards: batch });
      if (!isTriageResponse(response)) throw new Error('bad triage response');
      for (const result of response.results) {
        const card = cardsById.get(result.id);
        if (card) renderBadge(card, result.verdict, result.reason);
      }
    } catch {
      for (const snapshot of batch) {
        const card = cardsById.get(snapshot.id);
        if (card) renderBadge(card, 'unscored', '评分请求失败');
      }
    }
  };

  /** 卡片进入视口：读快照。占位卡（内容未渲染）返回 false，继续观察。 */
  const handleVisibleCard = (card: HTMLElement): boolean => {
    const snapshot = readJobCard(card, now());
    if (!snapshot) return false;
    // LinkedIn 会复用卡片节点；同一节点换了岗位要重新处理。
    if (card.getAttribute(PROCESSED_ATTR) === snapshot.id) return true;
    card.setAttribute(PROCESSED_ATTR, snapshot.id);
    cardsById.set(snapshot.id, card);
    renderBadge(card, 'pending');
    pendingTriage.push(snapshot);
    if (!triageTimer) triageTimer = setTimeout(() => void flushTriage(), triageDelay);
    return true;
  };

  const intersectionObserver = deps.createIntersectionObserver
    ? deps.createIntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (handleVisibleCard(entry.target as HTMLElement)) observer.unobserve(entry.target);
        }
      })
    : null;
  const observedCards = new WeakSet<Element>();

  const scanCards = () => {
    for (const card of findJobCards(doc)) {
      const element = card as HTMLElement;
      if (!intersectionObserver) {
        handleVisibleCard(element);
        continue;
      }
      const processedId = element.getAttribute(PROCESSED_ATTR);
      const recycled = processedId && readJobCard(element)?.id !== processedId;
      if (observedCards.has(element) && !recycled) continue;
      observedCards.add(element);
      intersectionObserver.observe(element);
    }
  };

  const setButtonText = (button: HTMLButtonElement, state: keyof typeof BUTTON_TEXT) => {
    button.dataset.state = state;
    button.textContent = BUTTON_TEXT[state];
  };

  const handleCaptureClick = async (button: HTMLButtonElement) => {
    if (button.dataset.state === 'sent') {
      void send({ type: 'open-app' });
      return;
    }
    if (button.dataset.state === 'sending') return;
    const job = readJobDetail(doc, getUrl(), now());
    if (!job || job.externalId !== button.dataset.jobId) {
      setButtonText(button, 'notReady');
      return;
    }
    setButtonText(button, 'sending');
    try {
      const response = (await send({ type: 'capture', job })) as CaptureResponse | undefined;
      setButtonText(button, response?.ok ? 'sent' : 'error');
    } catch {
      setButtonText(button, 'error');
    }
  };

  /** 详情区存在且换了岗位时，按钮跟着换；没有详情区就移除按钮。 */
  const syncCaptureButton = () => {
    const container = findDetailContainer(doc);
    const jobId = jobIdFromUrl(getUrl());
    const existing = doc.getElementById(CAPTURE_BUTTON_ID) as HTMLButtonElement | null;
    if (!container || !jobId) {
      existing?.remove();
      return;
    }
    if (existing && existing.dataset.jobId === jobId && container.contains(existing)) return;
    existing?.remove();

    const button = doc.createElement('button');
    button.id = CAPTURE_BUTTON_ID;
    button.type = 'button';
    button.dataset.jobId = jobId;
    Object.assign(button.style, {
      display: 'block',
      margin: '8px 0',
      padding: '6px 14px',
      border: 'none',
      borderRadius: '999px',
      background: '#4f46e5',
      color: '#fff',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
    });
    setButtonText(button, 'idle');
    button.addEventListener('click', () => void handleCaptureClick(button));
    container.insertBefore(button, container.firstChild);
  };

  const rescan = () => {
    rescanTimer = null;
    scanCards();
    syncCaptureButton();
  };

  const mutationObserver = new (doc.defaultView ?? globalThis).MutationObserver((mutations) => {
    // 自己插按钮/徽章引起的变化不触发重扫。
    const external = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some(
        (node) =>
          !(node instanceof Element) ||
          (node.id !== CAPTURE_BUTTON_ID && !node.classList.contains('tianming-badge')),
      ),
    );
    if (!external || rescanTimer) return;
    rescanTimer = setTimeout(rescan, rescanDelay);
  });
  mutationObserver.observe(doc.body, { childList: true, subtree: true });
  rescan();

  return {
    /** 立即重扫（SPA 换页时 URL 变了但 DOM 可能还没动）。 */
    rescan,
    flushTriage,
    stop() {
      mutationObserver.disconnect();
      intersectionObserver?.disconnect();
      if (triageTimer) clearTimeout(triageTimer);
      if (rescanTimer) clearTimeout(rescanTimer);
    },
  };
};
