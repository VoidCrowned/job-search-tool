import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import { createApp } from './app.ts';

// Secrets such as ANTHROPIC_API_KEY live in .env (never committed). Variables already set in the shell win.
if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

// After `npm run build`, `npm start` also serves the built website from dist/.
if (existsSync('dist/index.html')) {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

// Bound to localhost only: this server is for local use.
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`Server on http://127.0.0.1:${info.port}`);
});
