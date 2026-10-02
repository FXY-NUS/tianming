/**
 * Cloudflare Workers 入口。同一个 Worker 托管前端静态资源（dist/）和 /api/*，同源免 CORS。
 * 配置在仓库根目录 wrangler.jsonc；GEMINI_API_KEY / PROXY_TOKEN 走 wrangler secret。
 * 步骤见 doc/backend-proxy.md §7。
 */
import { handleProxyRequest, type ProxyEnv } from './handler';

export interface WorkerEnv extends ProxyEnv {
  /** wrangler.jsonc 里 assets.binding，指向构建好的 dist/。 */
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/') || !env.ASSETS) {
      return handleProxyRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
