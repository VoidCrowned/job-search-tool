import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createJobsucheClient, JobsucheError, logoUrl, type JobsucheClient } from '../api/client.ts';
import { parseSearchParams } from '../api/params.ts';
import { parseProfile } from '../shared/profile.ts';
import { createStorage, type Storage } from './storage.ts';

export interface AppOptions {
  client?: JobsucheClient;
  /** Used for logo requests. */
  fetch?: typeof fetch;
  storage?: Storage;
}

/** Host names the API answers to. Anything else (e.g. a DNS-rebinding attack from a website) is refused. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Reference numbers look like "10001-1003891045-S", but external ones contain letters, "." and "_"
 * ("13643-2L_626832-S"). It's Base64-encoded before going upstream, so only obvious junk is refused.
 */
const REFNR = /^[^\s/\\?#]{3,120}$/;
/** Logo hashes are URL-safe Base64. */
const LOGO_HASH = /^[A-Za-z0-9_\-+/=]{10,200}$/;

export function createApp(options: AppOptions = {}) {
  const client = options.client ?? createJobsucheClient();
  const doFetch = options.fetch ?? globalThis.fetch;
  const storage = options.storage ?? createStorage();
  const app = new Hono();

  // Personal data is served here, so only answer requests addressed to this machine.
  app.use('/api/*', async (c, next) => {
    if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname)) return c.json({ error: 'Forbidden host.' }, 403);
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof JobsucheError) {
      // Pass 400/404 through; anything else is the upstream API's fault.
      const status = (err.status === 400 || err.status === 404 ? err.status : 502) as ContentfulStatusCode;
      return c.json({ error: err.message, code: err.code }, status);
    }
    console.error(err);
    return c.json({ error: 'Unexpected server error.' }, 500);
  });

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/profile', async (c) => c.json(await storage.readProfile()));

  app.put('/api/profile', async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const { profile, errors } = parseProfile(body);
    if (errors.length) return c.json({ error: 'Invalid profile.', details: errors }, 400);
    await storage.writeProfile(profile);
    return c.json(profile);
  });

  app.get('/api/jobs', async (c) => {
    const { params, errors } = parseSearchParams(c.req.query());
    if (errors.length) return c.json({ error: 'Invalid search parameters.', details: errors }, 400);
    return c.json(await client.searchJobs(params));
  });

  app.get('/api/jobs/:refnr', async (c) => {
    const refnr = c.req.param('refnr');
    if (!REFNR.test(refnr)) return c.json({ error: 'Invalid reference number.' }, 400);
    return c.json(await client.getJobDetails(refnr));
  });

  app.get('/api/logo/:hash', async (c) => {
    const hash = c.req.param('hash');
    if (!LOGO_HASH.test(hash)) return c.json({ error: 'Invalid logo hash.' }, 400);
    let res: Response;
    try {
      res = await doFetch(logoUrl(hash), { signal: AbortSignal.timeout(10_000) });
    } catch {
      return c.json({ error: 'Logo service could not be reached.' }, 502);
    }
    if (res.status === 404) return c.body(null, 404);
    if (!res.ok) return c.json({ error: `Logo service answered with ${res.status}.` }, 502);
    return c.body(await res.arrayBuffer(), 200, {
      'Content-Type': res.headers.get('content-type') ?? 'image/webp',
      'Cache-Control': 'public, max-age=86400',
    });
  });

  app.all('/api/*', (c) => c.json({ error: 'Not found.' }, 404));

  return app;
}
