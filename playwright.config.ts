import { defineConfig } from '@playwright/test';

/**
 * 扩展端到端测试：真 Chromium 加载 extension/dist，天命跑本地 dev server，
 * LinkedIn 页面用保存的片段路由出来，/api/generate 用桩，不碰真网站也不调 Gemini。
 * 跑法：npm run test:e2e（会先构建扩展）。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: 'npx vite --port 3000 --strictPort',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
