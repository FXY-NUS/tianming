import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { tianmingProxyPlugin } from './server/vitePlugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // 本地 dev/preview 同端口挂 /api/* 代理；Key 只在 Node 侧读取，不注入前端 bundle（D9）。
      tianmingProxyPlugin({
        LLM_PROVIDER: env.LLM_PROVIDER,
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
        KIMI_API_KEY: env.KIMI_API_KEY,
        LLM_MODEL_FAST: env.LLM_MODEL_FAST,
        LLM_MODEL_STRONG: env.LLM_MODEL_STRONG,
        LLM_BASE_URL: env.LLM_BASE_URL,
        ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
        PROXY_TOKEN: env.PROXY_TOKEN,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'services/**/*.{test,spec}.{ts,tsx}',
        'extension/**/*.{test,spec}.{ts,tsx}',
        'server/**/*.{test,spec}.{ts,tsx}',
      ],
    },
  };
});
