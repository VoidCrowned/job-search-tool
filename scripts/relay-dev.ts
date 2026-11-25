// Runs the job-search relay (worker/src/relay.ts) locally with Node, as Cloudflare would.
// Usage: npm run relay:dev   (then e.g. npm run relay:check -- http://localhost:8788)
import { serve } from '@hono/node-server';
import { handleRelay } from '../worker/src/relay.ts';

const port = Number(process.env.RELAY_PORT ?? 8788);
const env = { ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:4173' };
serve({ fetch: (request) => handleRelay(request, env), port, hostname: '127.0.0.1' }, (info) => {
  console.log(`Relay on http://127.0.0.1:${info.port}`);
});
