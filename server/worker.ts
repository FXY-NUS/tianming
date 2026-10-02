/**
 * Cloudflare Workers 入口。部署时在 Worker 环境变量里配置 GEMINI_API_KEY（secret）、
 * ALLOWED_ORIGINS、可选 PROXY_TOKEN。步骤见 doc/backend-proxy.md。
 */
import { handleProxyRequest, type ProxyEnv } from './handler';

export default {
  fetch(request: Request, env: ProxyEnv): Promise<Response> {
    return handleProxyRequest(request, env);
  },
};
