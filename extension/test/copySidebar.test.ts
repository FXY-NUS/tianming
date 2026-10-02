import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CopyKitItem } from '../../services/extensionProtocol';
import { COPY_KIT_TIMEOUT_MS, createCopyKitRelay } from '../src/copyKitRelay';
import { canShowSidebar, createCopyKitFetcher } from '../src/copyKitFetch';
import {
  EMPTY_MESSAGE,
  NO_APP_MESSAGE,
  NO_SUBMIT_NOTE,
  SIDEBAR_HOST_ID,
  TIMEOUT_MESSAGE,
  createCopySidebar,
} from '../src/content/copySidebar';
import type { RuntimeRequest } from '../src/messages';

const items: CopyKitItem[] = [
  { id: 'profile.email', group: 'profile', label: 'Email', value: 'yan@example.com' },
  { id: 'answer.a1', group: 'answers', label: 'Why us', value: 'Because.' },
  { id: 'resume.skills', group: 'resume', label: '技能', value: 'SQL, Python' },
];

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('createCopyKitRelay', () => {
  it('按 requestId 把页面回的内容交给对应请求', async () => {
    const posted: unknown[] = [];
    const relay = createCopyKitRelay({ post: (m) => posted.push(m), makeId: () => 'r1' });
    const pending = relay.request({ title: 'Analyst', company: 'Acme' });
    expect(posted).toEqual([
      {
        source: 'tianming-extension',
        type: 'copy-kit-request',
        requestId: 'r1',
        job: { title: 'Analyst', company: 'Acme' },
      },
    ]);
    relay.handleResult({
      source: 'tianming-app',
      type: 'copy-kit-result',
      requestId: 'other',
      items,
    });
    relay.handleResult({ source: 'tianming-app', type: 'copy-kit-result', requestId: 'r1', items });
    await expect(pending).resolves.toEqual(items);
  });

  it('页面不回就超时返回 null', async () => {
    vi.useFakeTimers();
    const relay = createCopyKitRelay({ post: () => {} });
    const pending = relay.request();
    vi.advanceTimersByTime(COPY_KIT_TIMEOUT_MS);
    await expect(pending).resolves.toBeNull();
  });
});

describe('createCopyKitFetcher', () => {
  it('天命页面没开：不发消息，回 no-app', async () => {
    const sendToTab = vi.fn();
    const fetch = createCopyKitFetcher({ findAppTab: async () => null, sendToTab });
    await expect(fetch()).resolves.toEqual({ status: 'no-app' });
    expect(sendToTab).not.toHaveBeenCalled();
  });

  it('转给天命标签页并原样回结果；标签页里没有 bridge 时当作没开', async () => {
    const sendToTab = vi.fn(async () => ({ status: 'ok', items }));
    const fetch = createCopyKitFetcher({ findAppTab: async () => 3, sendToTab });
    await expect(fetch({ title: 'A', company: 'B' })).resolves.toEqual({ status: 'ok', items });
    expect(sendToTab).toHaveBeenCalledWith(3, {
      type: 'copy-kit',
      job: { title: 'A', company: 'B' },
    });

    const broken = createCopyKitFetcher({
      findAppTab: async () => 3,
      sendToTab: async () => {
        throw new Error('Receiving end does not exist');
      },
    });
    await expect(broken()).resolves.toEqual({ status: 'no-app' });
  });
});

describe('canShowSidebar', () => {
  const isApp = (url: string) => url.startsWith('http://localhost:3000');
  it('普通网页可以开侧栏，天命页面和浏览器内部页不行', () => {
    expect(canShowSidebar('https://boards.greenhouse.io/acme/jobs/1', isApp)).toBe(true);
    expect(canShowSidebar('https://www.linkedin.com/jobs/view/1/', isApp)).toBe(true);
    expect(canShowSidebar('http://localhost:3000/', isApp)).toBe(false);
    expect(canShowSidebar('chrome://extensions', isApp)).toBe(false);
    expect(canShowSidebar('https://chromewebstore.google.com/detail/x', isApp)).toBe(false);
    expect(canShowSidebar(undefined, isApp)).toBe(false);
    expect(canShowSidebar('not a url', isApp)).toBe(false);
  });
});

const setup = (response: unknown) => {
  const sent: RuntimeRequest[] = [];
  const send = vi.fn(async (message: RuntimeRequest) => {
    sent.push(message);
    return message.type === 'copy-kit' ? response : { ok: true };
  });
  const writeClipboard = vi.fn(async () => {});
  const sidebar = createCopySidebar({
    doc: document,
    send,
    writeClipboard,
    readJob: () => ({ title: 'Analyst', company: 'Acme' }),
    shadowMode: 'open',
  });
  const $ = (selector: string) => sidebar.root.querySelector<HTMLElement>(selector);
  const $$ = (selector: string) => Array.from(sidebar.root.querySelectorAll<HTMLElement>(selector));
  return { sidebar, sent, send, writeClipboard, $, $$ };
};

describe('createCopySidebar', () => {
  it('打开时带上岗位向天命要内容，按分组列出，每条一个复制按钮', async () => {
    const { sidebar, sent, writeClipboard, $, $$ } = setup({ status: 'ok', items });
    await sidebar.open();

    expect(document.getElementById(SIDEBAR_HOST_ID)).not.toBeNull();
    expect(sent).toEqual([{ type: 'copy-kit', job: { title: 'Analyst', company: 'Acme' } }]);
    expect($$('[data-group]').map((section) => section.dataset.group)).toEqual([
      'profile',
      'resume',
      'answers',
    ]);
    expect($('footer')?.textContent).toBe(NO_SUBMIT_NOTE);

    const copy = $('[data-item-id="answer.a1"]')!;
    copy.click();
    await vi.waitFor(() => expect(copy.textContent).toBe('已复制 ✓'));
    expect(writeClipboard).toHaveBeenCalledWith('Because.');
  });

  it('复制失败时按钮提示失败', async () => {
    const { sidebar, writeClipboard, $ } = setup({ status: 'ok', items });
    writeClipboard.mockRejectedValueOnce(new Error('denied'));
    await sidebar.open();
    const copy = $('[data-item-id="profile.email"]')!;
    copy.click();
    await vi.waitFor(() => expect(copy.textContent).toBe('复制失败'));
  });

  it('天命没开：提示先打开天命，按钮能切过去', async () => {
    const { sidebar, sent, $ } = setup({ status: 'no-app' });
    await sidebar.open();
    expect($('[data-notice]')?.textContent).toContain(NO_APP_MESSAGE);
    $('[data-action="open-app"]')!.click();
    expect(sent.at(-1)).toEqual({ type: 'open-app' });
  });

  it('没内容、超时、扩展失效各有提示', async () => {
    const empty = setup({ status: 'ok', items: [] });
    await empty.sidebar.open();
    expect(empty.$('[data-notice]')?.textContent).toBe(EMPTY_MESSAGE);
    empty.sidebar.close();

    const timeout = setup({ status: 'timeout' });
    await timeout.sidebar.open();
    expect(timeout.$('[data-notice]')?.textContent).toBe(TIMEOUT_MESSAGE);
    timeout.sidebar.close();

    const dead = setup(null);
    dead.send.mockRejectedValueOnce(new Error('Extension context invalidated'));
    await dead.sidebar.open();
    expect(dead.$('[data-notice]')?.textContent).toContain(NO_APP_MESSAGE);
  });

  it('收起后内容还在、能展开；关闭则移除侧栏并丢掉内容；再点图标重新要', async () => {
    const { sidebar, send, $ } = setup({ status: 'ok', items });
    await sidebar.open();
    $('[data-action="collapse"]')!.click();
    expect($('section')!.hidden).toBe(true);
    expect($('[data-action="expand"]')!.hidden).toBe(false);
    $('[data-action="expand"]')!.click();
    expect($('section')!.hidden).toBe(false);
    expect($('[data-item-id="profile.email"]')).not.toBeNull();

    await sidebar.toggle();
    expect(sidebar.isOpen()).toBe(false);
    expect(document.getElementById(SIDEBAR_HOST_ID)).toBeNull();
    expect($('[data-item-id="profile.email"]')).toBeNull();

    await sidebar.toggle();
    expect(sidebar.isOpen()).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('只复制，不碰页面上的表单', async () => {
    document.body.innerHTML = '<form><input name="email" value="" /></form>';
    const { sidebar, $ } = setup({ status: 'ok', items });
    await sidebar.open();
    $('[data-item-id="profile.email"]')!.click();
    await Promise.resolve();
    expect(document.querySelector<HTMLInputElement>('input[name="email"]')!.value).toBe('');
  });
});
