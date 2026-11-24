import { serve } from '@hono/node-server';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 8787);

// Bound to localhost only: this server is for local use.
serve({ fetch: createApp().fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`API server on http://127.0.0.1:${info.port}`);
});
