import { DEFAULT_APP_URL, readAppUrl } from '../appUrl';
import { saveAppUrl } from './saveAppUrl';

const input = document.getElementById('app-url') as HTMLInputElement;
const form = document.getElementById('form') as HTMLFormElement;
const status = document.getElementById('status') as HTMLParagraphElement;
const defaultHint = document.getElementById('default-url') as HTMLElement;

const MESSAGES = {
  saved: (url: string) => `已保存：${url}。已经打开的天命页面请刷新一次。`,
  reset: (url: string) => `已恢复默认：${url}`,
  invalid: '网址不对：需要 https:// 开头（本机调试可以用 http://localhost）。',
  denied: '没有拿到这个网站的权限，扩展没法把岗位送过去。再点一次保存，在弹窗里选「允许」。',
};

defaultHint.textContent = DEFAULT_APP_URL;
void readAppUrl(chrome.storage.local).then((url) => {
  input.value = url === DEFAULT_APP_URL ? '' : url;
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveAppUrl(input.value, {
    storage: chrome.storage.local,
    requestPermission: (origins) => chrome.permissions.request({ origins }),
  }).then((result) => {
    if (result.kind === 'saved' || result.kind === 'reset') {
      status.textContent = MESSAGES[result.kind](result.appUrl);
      input.value = result.kind === 'saved' ? result.appUrl : '';
    } else {
      status.textContent = MESSAGES[result.kind];
    }
    status.dataset.kind = result.kind;
  });
});
