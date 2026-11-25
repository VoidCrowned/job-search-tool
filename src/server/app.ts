import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createJobsucheClient, JobsucheError, logoUrl, type JobsucheClient } from '../api/client.ts';
import { parseSearchParams } from '../api/params.ts';
import { randomUUID } from 'node:crypto';
import type { JobDetails } from '../api/types.ts';
import { isLanguageChoice, MAX_LETTER_LENGTH, parseConfirmed, type LetterFile, type LetterLanguage, type LetterVersion } from '../shared/letter.ts';
import { parseProfile } from '../shared/profile.ts';
import { detectLanguage } from './letter/language.ts';
import { fillTemplate } from './letter/template.ts';
import Anthropic from '@anthropic-ai/sdk';
import { aiConfigFromEnv, createClaudeGenerator, RefusalError, type LetterGenerator } from './letter/claude.ts';
import { createStorage, type Storage } from './storage.ts';
import { updateEnvFile } from './envFile.ts';

export interface AppOptions {
  client?: JobsucheClient;
  /** Used for logo requests. */
  fetch?: typeof fetch;
  storage?: Storage;
  /** Writes letters with Claude. `null` = no AI (template only). Default: from ANTHROPIC_API_KEY. */
  generator?: LetterGenerator | null;
  /** Shown in /api/config. */
  model?: string;
  provider?: 'anthropic' | 'openrouter';
  /** Environment the API key is read from and written to. Default: process.env. */
  env?: NodeJS.ProcessEnv;
  /** The .env file a key entered on the profile page is saved in. Default: .env */
  envPath?: string;
}

const KEY_VARS = ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'] as const;
/** OpenRouter ("sk-or-…") or Anthropic ("sk-ant-…") keys; one line, no spaces or quotes. */
const API_KEY = /^sk-(or|ant)-[A-Za-z0-9_-]{16,250}$/;
/** Enough of the key to recognise it, never enough to use it. */
const keyHint = (key: string) => `${key.slice(0, key.startsWith('sk-ant-') ? 7 : 6)}…${key.slice(-4)}`;
/** Origins of pages allowed to change things: the app itself (dev server or built site), never another website. */
const isLocalOrigin = (origin: string) => {
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
};

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
  const env = options.env ?? process.env;
  const envPath = options.envPath ?? '.env';

  // The AI setup can change at runtime when a key is entered on the profile page.
  const aiFromEnv = () => {
    const config = aiConfigFromEnv(env);
    return {
      generator: config.apiKey ? createClaudeGenerator(config) : null,
      model: config.model,
      provider: config.provider ?? 'anthropic',
      key: config.apiKey,
    };
  };
  let ai = aiFromEnv();
  if (options.generator !== undefined) ai = { ...ai, generator: options.generator };
  if (options.model) ai.model = options.model;
  if (options.provider) ai.provider = options.provider;
  const app = new Hono();

  // Personal data is served here, so only answer requests addressed to this machine.
  app.use('/api/*', async (c, next) => {
    if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname)) return c.json({ error: 'Forbidden host.' }, 403);
    await next();
  });

  // Requests that change something must come from the app itself: a JSON body (other websites can't send one
  // without a CORS preflight, which this server never answers) and, if the browser names it, a local Origin.
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const origin = c.req.header('Origin');
      if (origin && !isLocalOrigin(origin)) return c.json({ error: 'Forbidden origin.' }, 403);
      if (c.req.method !== 'DELETE' && !c.req.header('Content-Type')?.startsWith('application/json')) {
        return c.json({ error: 'Expected JSON.' }, 415);
      }
    }
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof RefusalError) return c.json({ error: err.message, code: 'AI_REFUSED' }, 422);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return c.json({ error: 'The API key was rejected.', code: 'AI_AUTH' }, 502);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return c.json({ error: 'Anthropic rate limit reached.', code: 'AI_RATE_LIMIT' }, 503);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return c.json({ error: 'Claude could not write the letter.', code: 'AI_ERROR' }, 502);
    }
    if (err instanceof JobsucheError) {
      // Pass 400/404 through; anything else is the upstream API's fault.
      const status = (err.status === 400 || err.status === 404 ? err.status : 502) as ContentfulStatusCode;
      return c.json({ error: err.message, code: err.code }, status);
    }
    console.error(err);
    return c.json({ error: 'Unexpected server error.' }, 500);
  });

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/config', (c) => c.json(ai.generator ? { ai: true, model: ai.model, provider: ai.provider } : { ai: false }));

  // The API key itself never leaves the server: only whether one is set, the provider and a short hint.
  const keyStatus = () => (ai.key ? { set: true, provider: ai.provider, hint: keyHint(ai.key) } : { set: false });

  const setKey = async (key: string | undefined) => {
    const changes: Record<string, string | undefined> = { ANTHROPIC_API_KEY: undefined, OPENROUTER_API_KEY: undefined };
    if (key) changes[key.startsWith('sk-or-') ? 'OPENROUTER_API_KEY' : 'ANTHROPIC_API_KEY'] = key;
    await updateEnvFile(envPath, changes);
    for (const name of KEY_VARS) {
      if (changes[name] === undefined) delete env[name];
      else env[name] = changes[name];
    }
    ai = aiFromEnv();
  };

  app.get('/api/settings/key', (c) => c.json(keyStatus()));

  app.put('/api/settings/key', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { key?: unknown };
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!API_KEY.test(key)) return c.json({ error: 'That does not look like an OpenRouter (sk-or-…) or Anthropic (sk-ant-…) key.', code: 'INVALID_KEY' }, 400);
    await setKey(key);
    return c.json(keyStatus());
  });

  app.delete('/api/settings/key', async (c) => {
    await setKey(undefined);
    return c.json(keyStatus());
  });

  const lettersFor = async (refnr: string, job?: JobDetails): Promise<LetterFile> => {
    const file = (await storage.readLetters(refnr)) ?? { refnr, jobTitle: '', versions: [] };
    if (job) {
      file.jobTitle = job.stellenangebotsTitel;
      file.company = job.firma;
    }
    return file;
  };

  const addVersion = async (file: LetterFile, version: Omit<LetterVersion, 'id' | 'createdAt'>) => {
    const full: LetterVersion = { id: randomUUID(), createdAt: new Date().toISOString(), ...version };
    file.versions.push(full);
    await storage.writeLetters(file);
    return full;
  };

  app.get('/api/letters/:refnr', async (c) => {
    const refnr = c.req.param('refnr');
    if (!REFNR.test(refnr)) return c.json({ error: 'Invalid reference number.' }, 400);
    return c.json(await lettersFor(refnr));
  });

  app.post('/api/letters/:refnr/generate', async (c) => {
    const refnr = c.req.param('refnr');
    if (!REFNR.test(refnr)) return c.json({ error: 'Invalid reference number.' }, 400);
    const body = (await c.req.json().catch(() => ({}))) as { language?: unknown; mode?: unknown; confirmed?: unknown };
    const confirmed = parseConfirmed(body.confirmed);
    if (confirmed === null) return c.json({ error: 'Invalid confirmed points.' }, 400);
    const choice = body.language ?? 'auto';
    if (!isLanguageChoice(choice)) return c.json({ error: 'Invalid language.' }, 400);
    const { generator } = ai;
    const mode = body.mode ?? (generator ? 'ai' : 'template');
    if (mode !== 'ai' && mode !== 'template') return c.json({ error: 'Invalid mode.' }, 400);
    if (mode === 'ai' && !generator) return c.json({ error: 'No Anthropic API key is set.', code: 'AI_UNAVAILABLE' }, 400);

    const [job, profile] = await Promise.all([client.getJobDetails(refnr), storage.readProfile()]);
    const language: LetterLanguage =
      choice === 'auto' ? detectLanguage(job.stellenangebotsTitel, job.stellenangebotsBeschreibung) : choice;
    const file = await lettersFor(refnr, job);

    if (mode === 'ai' && generator) {
      const result = await generator({ profile, job, language, confirmed });
      const version = await addVersion(file, {
        source: 'claude',
        language,
        text: result.letter,
        adKeywords: result.adKeywords,
        missing: result.missing.length ? result.missing : undefined,
        confirmed: confirmed?.length ? confirmed : undefined,
      });
      return c.json({ file, version });
    }
    const version = await addVersion(file, { source: 'template', language, text: fillTemplate(profile, job, language) });
    return c.json({ file, version });
  });

  app.post('/api/letters/:refnr/versions', async (c) => {
    const refnr = c.req.param('refnr');
    if (!REFNR.test(refnr)) return c.json({ error: 'Invalid reference number.' }, 400);
    const body = (await c.req.json().catch(() => ({}))) as { text?: unknown; language?: unknown };
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > MAX_LETTER_LENGTH) {
      return c.json({ error: 'Invalid letter text.' }, 400);
    }
    if (body.language !== 'de' && body.language !== 'en') return c.json({ error: 'Invalid language.' }, 400);
    const file = await lettersFor(refnr);
    const version = await addVersion(file, { source: 'edit', language: body.language, text: body.text });
    return c.json({ file, version });
  });

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

  app.all('/api/*', (c) => c.json({ error: 'Not found.', code: 'UNKNOWN_ROUTE' }, 404));

  return app;
}
