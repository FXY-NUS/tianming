import type { CopyKitGroup, CopyKitItem, CopyKitJob } from '../../../services/extensionProtocol';
import type { CopyKitResponse, RuntimeRequest } from '../messages';

/**
 * 投递页复制侧栏（Phase 6.5 / D11 L3）：用户在投递页点扩展图标，右侧出现一个可收起的侧栏，
 * 列出投递档案、简历要点、已存回答，每条一个「复制」按钮，用户自己粘贴到表单里。
 *
 * - 内容每次打开时向打开着的天命页面要，只放在侧栏的内存里；关闭侧栏就丢掉，不进 chrome.storage（D6）。
 * - 只复制，不碰页面上的表单：不 autofill、不自动提交（D11 L4/L5 永久不做）。
 * - UI 放在 closed shadow root 里，投递页自己的样式和脚本碰不到侧栏内容。
 */

export const SIDEBAR_HOST_ID = 'tianming-copy-sidebar';

export const NO_APP_MESSAGE = '先打开天命页面并保持打开，再点「刷新」。';
export const EMPTY_MESSAGE =
  '天命里还没有可复制的内容：在天命的「档案 → 投递助手」里填好投递档案，再点「刷新」。';
export const TIMEOUT_MESSAGE = '天命页面没有回应：刷新一下天命页面，再点这里的「刷新」。';
export const NO_SUBMIT_NOTE = '天命不替你提交。所有投递都是你自己手动点的。';

const GROUP_TITLES: Record<CopyKitGroup, string> = {
  profile: '投递档案',
  resume: '简历要点',
  answers: '已存回答',
  email: '邮件正文',
};
const GROUP_ORDER: CopyKitGroup[] = ['profile', 'resume', 'answers', 'email'];

const COPIED_FEEDBACK_MS = 1_500;

export interface CopySidebarDeps {
  doc: Document;
  send: (message: RuntimeRequest) => Promise<unknown>;
  writeClipboard: (text: string) => Promise<void>;
  /** 当前页能认出的岗位（LinkedIn 详情页），用来拼邮件正文；认不出返回 undefined。 */
  readJob?: () => CopyKitJob | undefined;
  /** 测试用 open，线上用 closed，页面脚本拿不到侧栏里的内容。 */
  shadowMode?: ShadowRootMode;
}

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel {
  position: fixed; top: 12px; right: 12px; bottom: 12px; width: 340px; max-width: calc(100vw - 24px);
  display: flex; flex-direction: column; background: #fff; color: #1e293b;
  border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  font: 13px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; z-index: 2147483647;
}
.panel[hidden], .tab[hidden] { display: none; }
header { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
header strong { flex: 1; font-size: 14px; color: #4338ca; }
header button { border: none; background: #f1f5f9; color: #334155; border-radius: 6px; padding: 3px 8px; cursor: pointer; font: inherit; }
header button:hover { background: #e2e8f0; }
.body { flex: 1; overflow-y: auto; padding: 8px 12px; }
.notice { color: #475569; background: #f8fafc; border-radius: 8px; padding: 10px; margin: 8px 0; }
.notice button { margin-top: 8px; }
h3 { margin: 12px 0 6px; font-size: 12px; color: #64748b; font-weight: 600; letter-spacing: 0.02em; }
.item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; margin-bottom: 6px; }
.item .label { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12px; color: #334155; }
.item .label span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item .value { margin-top: 4px; color: #475569; white-space: pre-wrap; word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.copy, .action { border: none; border-radius: 999px; padding: 3px 12px; background: #4f46e5; color: #fff; font: inherit; font-weight: 600; cursor: pointer; flex: none; }
.copy[data-copied='true'] { background: #16a34a; }
.copy[data-failed='true'] { background: #dc2626; }
footer { padding: 8px 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
.tab {
  position: fixed; top: 40%; right: 0; z-index: 2147483647; border: none; cursor: pointer;
  background: #4f46e5; color: #fff; padding: 10px 6px; border-radius: 8px 0 0 8px;
  font: 600 13px/1.2 system-ui, sans-serif; writing-mode: vertical-rl;
}
`;

export interface CopySidebar {
  /** 打开（或展开）侧栏并重新向天命要内容。 */
  open(): Promise<void>;
  /** 收起成右边缘的小标签，内容保留。 */
  collapse(): void;
  /** 关闭并移除侧栏，丢掉内容。 */
  close(): void;
  /** 再点一次扩展图标：开着就关，关着就开。 */
  toggle(): Promise<void>;
  isOpen(): boolean;
  readonly root: ShadowRoot;
}

export const createCopySidebar = (deps: CopySidebarDeps): CopySidebar => {
  const { doc } = deps;
  const host = doc.createElement('div');
  host.id = SIDEBAR_HOST_ID;
  const root = host.attachShadow({ mode: deps.shadowMode ?? 'closed' });

  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: { className?: string; text?: string } = {},
  ) => {
    const node = doc.createElement(tag);
    if (props.className) node.className = props.className;
    if (props.text !== undefined) node.textContent = props.text;
    return node;
  };

  const style = el('style', { text: STYLE });
  const panel = el('section', { className: 'panel' });
  panel.setAttribute('aria-label', '天命复制助手');
  const header = el('header');
  const refreshButton = el('button', { text: '刷新' });
  const collapseButton = el('button', { text: '收起' });
  const closeButton = el('button', { text: '关闭' });
  refreshButton.dataset.action = 'refresh';
  collapseButton.dataset.action = 'collapse';
  closeButton.dataset.action = 'close';
  header.append(
    el('strong', { text: '天命 · 复制助手' }),
    refreshButton,
    collapseButton,
    closeButton,
  );
  const body = el('div', { className: 'body' });
  const footer = el('footer', { text: NO_SUBMIT_NOTE });
  panel.append(header, body, footer);
  const tab = el('button', { className: 'tab', text: '天命' });
  tab.dataset.action = 'expand';
  tab.hidden = true;
  root.append(style, panel, tab);

  let attached = false;
  let loadToken = 0;

  const notice = (text: string, withOpenApp = false) => {
    const box = el('div', { className: 'notice', text });
    box.dataset.notice = 'true';
    if (withOpenApp) {
      box.append(el('br'));
      const openApp = el('button', { className: 'action', text: '打开天命' });
      openApp.dataset.action = 'open-app';
      openApp.addEventListener('click', () => void deps.send({ type: 'open-app' }));
      box.append(openApp);
    }
    body.replaceChildren(box);
  };

  const copyButton = (item: CopyKitItem) => {
    const button = el('button', { className: 'copy', text: '复制' });
    button.dataset.itemId = item.id;
    let timer: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener('click', () => {
      void deps.writeClipboard(item.value).then(
        () => {
          button.dataset.copied = 'true';
          delete button.dataset.failed;
          button.textContent = '已复制 ✓';
        },
        () => {
          button.dataset.failed = 'true';
          delete button.dataset.copied;
          button.textContent = '复制失败';
        },
      );
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete button.dataset.copied;
        delete button.dataset.failed;
        button.textContent = '复制';
      }, COPIED_FEEDBACK_MS);
    });
    return button;
  };

  const renderItems = (items: CopyKitItem[]) => {
    const sections = GROUP_ORDER.flatMap((group) => {
      const groupItems = items.filter((item) => item.group === group);
      if (!groupItems.length) return [];
      const section = el('div');
      section.dataset.group = group;
      section.append(el('h3', { text: GROUP_TITLES[group] }));
      for (const item of groupItems) {
        const row = el('div', { className: 'item' });
        const label = el('div', { className: 'label' });
        const labelText = el('span', { text: item.label });
        labelText.title = item.label;
        label.append(labelText, copyButton(item));
        const value = el('div', { className: 'value', text: item.value });
        value.title = item.value;
        row.append(label, value);
        section.append(row);
      }
      return [section];
    });
    body.replaceChildren(...sections);
  };

  const render = (response: CopyKitResponse) => {
    if (response.status === 'no-app') return notice(NO_APP_MESSAGE, true);
    if (response.status === 'timeout') return notice(TIMEOUT_MESSAGE);
    if (!response.items.length) return notice(EMPTY_MESSAGE);
    renderItems(response.items);
  };

  const isResponse = (value: unknown): value is CopyKitResponse =>
    !!value &&
    typeof value === 'object' &&
    ['ok', 'no-app', 'timeout'].includes((value as { status?: string }).status ?? '') &&
    ((value as { status?: string }).status !== 'ok' ||
      Array.isArray((value as { items?: unknown }).items));

  const load = async () => {
    const token = ++loadToken;
    notice('正在向天命要内容…');
    let response: CopyKitResponse;
    try {
      const raw = await deps.send({ type: 'copy-kit', job: deps.readJob?.() });
      response = isResponse(raw) ? raw : { status: 'no-app' };
    } catch {
      // 扩展刚更新过、旧页面上的脚本已失效时会走到这里。
      response = { status: 'no-app' };
    }
    if (token === loadToken && attached) render(response);
  };

  const sidebar: CopySidebar = {
    root,
    isOpen: () => attached,
    async open() {
      if (!attached) {
        (doc.body ?? doc.documentElement).append(host);
        attached = true;
      }
      panel.hidden = false;
      tab.hidden = true;
      await load();
    },
    collapse() {
      panel.hidden = true;
      tab.hidden = false;
    },
    close() {
      loadToken++;
      body.replaceChildren();
      host.remove();
      attached = false;
    },
    async toggle() {
      if (attached) sidebar.close();
      else await sidebar.open();
    },
  };

  refreshButton.addEventListener('click', () => void load());
  collapseButton.addEventListener('click', () => sidebar.collapse());
  closeButton.addEventListener('click', () => sidebar.close());
  tab.addEventListener('click', () => {
    panel.hidden = false;
    tab.hidden = true;
  });

  return sidebar;
};

/**
 * 写剪贴板。优先 Clipboard API；投递页用 Permissions-Policy 禁了剪贴板（常见于嵌在 iframe 里的 ATS）
 * 时退回 execCommand('copy')。
 */
export const writeClipboardText = async (doc: Document, text: string) => {
  const clipboard = doc.defaultView?.navigator.clipboard;
  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // 落到下面的兜底。
    }
  }
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  Object.assign(textarea.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0' });
  (doc.body ?? doc.documentElement).append(textarea);
  textarea.select();
  const ok = doc.execCommand('copy');
  textarea.remove();
  if (!ok) throw new Error('copy failed');
};
