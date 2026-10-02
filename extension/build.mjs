import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 产物在 extension/dist/：Chrome「加载已解压的扩展程序」选这个目录。
const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, 'dist');

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const shared = { outdir, bundle: true, target: 'chrome120', sourcemap: false, logLevel: 'info' };

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
  },
  format: 'iife',
});

cpSync(resolve(root, 'manifest.json'), resolve(outdir, 'manifest.json'));
