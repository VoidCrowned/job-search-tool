/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = Number(process.env.PORT ?? 8787);
/** The online version (#10): built with VITE_HOSTED=1 and VITE_RELAY_URL, served from GitHub Pages. */
const hosted = process.env.VITE_HOSTED === '1';
const relay = process.env.VITE_RELAY_URL?.replace(/\/$/, '') ?? '';

/**
 * The online version keeps the visitor's API key in the browser, so the page may only run its own scripts
 * and only talk to the relay, Anthropic and OpenRouter. (Inline styles stay allowed: React sets some.)
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${relay}`,
    `connect-src 'self' ${relay} https://api.anthropic.com https://openrouter.ai`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'content-security-policy',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  };
}

export default defineConfig({
  base: hosted ? '/job-search-tool/' : '/',
  plugins: [react(), ...(hosted ? [contentSecurityPolicy()] : [])],
  server: {
    port: 5173,
    proxy: { '/api': `http://127.0.0.1:${serverPort}` },
  },
  test: {
    environment: 'node',
  },
});
