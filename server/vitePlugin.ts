/**
 * 本地开发用：把代理挂进 `npm run dev` / `npm run preview` 的同一个端口，
 * 前端直接请求同源 /api/*，不需要另开服务、不需要 CORS。
 * Key 从 .env.local 的 GEMINI_API_KEY 读（服务端变量，不会打进前端 bundle）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { handleProxyRequest, type ProxyEnv } from './handler';

export function tianmingProxyPlugin(env: ProxyEnv): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next();
    forward(req, res, env).catch(next);
  };

  return {
    name: 'tianming-llm-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

async function forward(req: IncomingMessage, res: ServerResponse, env: ProxyEnv) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });

  const response = await handleProxyRequest(request, env);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
