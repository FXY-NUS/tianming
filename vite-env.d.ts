/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'byok' = 浏览器用用户自带 Key 直连 Gemini；缺省 = 走后端代理。 */
  readonly VITE_LLM_MODE?: string;
  /** 代理部署在别的域名时填写，例如 https://tianming-proxy.example.workers.dev；缺省为同源。 */
  readonly VITE_TIANMING_API_BASE?: string;
  /** 代理开启 PROXY_TOKEN 时前端携带的口令（会进前端 bundle，只适合私人部署）。 */
  readonly VITE_TIANMING_PROXY_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
