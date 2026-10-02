/**
 * 把一段 DOM 转成保留段落结构的纯文本。不依赖 innerText（jsdom 没有，且会受 CSS 隐藏影响），
 * 块级元素换行、列表项加「- 」、连续空行压成一行。
 */

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'SECTION',
  'ARTICLE',
  'UL',
  'OL',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'TABLE',
  'TR',
  'BLOCKQUOTE',
]);

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'BUTTON', 'svg', 'SVG']);

const walk = (node: Node, out: string[]) => {
  if (node.nodeType === 3) {
    out.push((node.textContent ?? '').replace(/\s+/g, ' '));
    return;
  }
  if (node.nodeType !== 1) return;
  const element = node as Element;
  if (SKIP_TAGS.has(element.tagName)) return;
  if (element.classList.contains('visually-hidden')) return;
  if (element.tagName === 'BR') {
    out.push('\n');
    return;
  }

  const isBlock = BLOCK_TAGS.has(element.tagName);
  const isItem = element.tagName === 'LI';
  // 列表项只在前面换行，不在后面补：下一项自己会换行，避免项与项之间多出空行。
  if (isBlock || isItem) out.push('\n');
  if (isItem) out.push('- ');
  element.childNodes.forEach((child) => walk(child, out));
  if (isBlock) out.push('\n');
};

export const elementToText = (element: Element | null | undefined): string => {
  if (!element) return '';
  const out: string[] = [];
  // 根节点本身不做标签过滤（调用方可能直接传一个 button 当 pill），只过滤它的后代。
  element.childNodes.forEach((child) => walk(child, out));
  return out
    .join('')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** 单行文本：压掉所有空白，适合标题、公司名这类短字段。 */
export const inlineText = (element: Element | null | undefined): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
