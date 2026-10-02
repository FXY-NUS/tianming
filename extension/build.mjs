import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 产物在 extension/dist/：Chrome「加载已解压的扩展程序」选这个目录。
const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, 'dist');

// 默认天命网址：构建时用环境变量 TIANMING_APP_URL 传入（CI 里来自仓库变量），缺省本地开发版。
// 用户装好后还能在扩展设置页改，见 src/appUrl.ts。
const appUrl = resolveAppUrl(process.env.TIANMING_APP_URL);

function resolveAppUrl(raw) {
  const value = raw?.trim();
  if (!value) return 'http://localhost:3000/';
  const url = new URL(value);
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) {
    throw new Error(`TIANMING_APP_URL 必须是 https 网址（本机可用 http://localhost）：${value}`);
  }
  return `${url.origin}/`;
}

// 与 src/appUrl.ts 的 appTabPatterns 一致：match pattern 不带端口，localhost 额外认 127.0.0.1。
function bridgeMatches(base) {
  const url = new URL(base);
  const patterns = [`${url.protocol}//${url.hostname}/*`];
  if (url.hostname === 'localhost') patterns.push(`${url.protocol}//127.0.0.1/*`);
  return patterns;
}

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const shared = {
  outdir,
  bundle: true,
  target: 'chrome120',
  sourcemap: false,
  logLevel: 'info',
  define: { __TIANMING_APP_URL__: JSON.stringify(appUrl) },
};

// service worker 在 manifest 里声明了 type: module，用 ESM。
await build({
  ...shared,
  entryPoints: { background: resolve(root, 'src/background.ts') },
  format: 'esm',
});

// content script 只能是经典脚本，打成 IIFE，避免产物里出现 import/export 时整个脚本加载失败。
await build({
  ...shared,
  entryPoints: {
    linkedin: resolve(root, 'src/content/linkedin.entry.ts'),
    appBridge: resolve(root, 'src/content/appBridge.ts'),
    options: resolve(root, 'src/options/options.ts'),
    copySidebar: resolve(root, 'src/content/copySidebar.entry.ts'),
  },
  format: 'iife',
});

// manifest 里天命页面那条 content script 的 matches 按默认网址生成。
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const bridge = manifest.content_scripts.find((script) => script.js.includes('appBridge.js'));
bridge.matches = bridgeMatches(appUrl);
writeFileSync(resolve(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(resolve(root, 'src/options/options.html'), resolve(outdir, 'options.html'));
console.log(`天命默认网址：${appUrl}`);
