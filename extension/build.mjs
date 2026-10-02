import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 产物在 extension/dist/：Chrome「加载已解压的扩展程序」选这个目录。
const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, 'dist');

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: {
    background: resolve(root, 'src/background.ts'),
    linkedin: resolve(root, 'src/content/linkedin.entry.ts'),
    appBridge: resolve(root, 'src/content/appBridge.ts'),
  },
  outdir,
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  sourcemap: false,
  logLevel: 'info',
});

cpSync(resolve(root, 'manifest.json'), resolve(outdir, 'manifest.json'));
