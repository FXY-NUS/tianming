import { readJobDetail } from '../linkedin';
import type { RuntimeRequest } from '../messages';
import { createCopySidebar, writeClipboardText, type CopySidebar } from './copySidebar';

/**
 * 用户在投递页点扩展图标时由 service worker 注入（chrome.scripting.executeScript + activeTab）。
 * 同一页再点一次图标会再注入一次：已经有侧栏就开关它，不重复创建。
 */

declare global {
  interface Window {
    __tianmingCopySidebar?: CopySidebar;
  }
}

/** LinkedIn 岗位详情页（含 Easy Apply 弹窗）能认出岗位，邮件正文就带上岗位名和公司。 */
const readJob = () => {
  if (location.hostname !== 'www.linkedin.com') return undefined;
  const job = readJobDetail(document, location.href);
  return job ? { title: job.title, company: job.company } : undefined;
};

const existing = window.__tianmingCopySidebar;
if (existing) {
  void existing.toggle();
} else {
  const sidebar = createCopySidebar({
    doc: document,
    send: (message: RuntimeRequest) => chrome.runtime.sendMessage(message),
    writeClipboard: (text) => writeClipboardText(document, text),
    readJob,
  });
  window.__tianmingCopySidebar = sidebar;
  void sidebar.open();
}
