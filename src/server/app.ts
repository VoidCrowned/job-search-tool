import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createJobsucheClient, JobsucheError, logoUrl, type JobsucheClient } from '../api/client.ts';
import { parseSearchParams } from '../api/params.ts';
import { randomUUID } from 'node:crypto';
import type { JobDetails } from '../api/types.ts';
import { isLanguageChoice, MAX_LETTER_LENGTH, type LetterFile, type LetterLanguage, type LetterVersion } from '../shared/letter.ts';
import { parseProfile } from '../shared/profile.ts';
import { detectLanguage } from './letter/language.ts';
import { fillTemplate } from './letter/template.ts';
import Anthropic from '@anthropic-ai/sdk';
import { aiConfigFromEnv, createClaudeGenerator, RefusalError, type LetterGenerator } from './letter/claude.ts';
import { createStorage, type Storage } from './storage.ts';

export interface AppOptions {
  client?: JobsucheClient;
  /** Used for logo requests. */
  fetch?: typeof fetch;
  storage?: Storage;
  /** Writes letters with Claude. `null` = no AI (template only). Default: from ANTHROPIC_API_KEY. */
  generator?: LetterGenerator | null;
  /** Shown in /api/config. */
  model?: string;
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
  const aiConfig = aiConfigFromEnv();
  const generator =
    options.generator !== undefined ? options.generator : aiConfig.apiKey ? createClaudeGenerator(aiConfig) : null;
  const model = options.model ?? aiConfig.model;
  const app = new Hono();

  // Personal data is served here, so only answer requests addressed to this machine.
  app.use('/api/*', async (c, next) => {
    if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname)) return c.json({ error: 'Forbidden host.' }, 403);
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof RefusalError) return c.json({ error: err.message, code: 'AI_REFUSED' }, 422);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return c.json({ error: 'The Anthropic API key was rejected.', code: 'AI_AUTH' }, 502);
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

  app.get('/api/config', (c) => c.json(generator ? { ai: true, model } : { ai: false }));

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
    const body = (await c.req.json().catch(() => ({}))) as { language?: unknown; mode?: unknown };
    const choice = body.language ?? 'auto';
    if (!isLanguageChoice(choice)) return c.json({ error: 'Invalid language.' }, 400);
    const mode = body.mode ?? (generator ? 'ai' : 'template');
    if (mode !== 'ai' && mode !== 'template') return c.json({ error: 'Invalid mode.' }, 400);
    if (mode === 'ai' && !generator) return c.json({ error: 'No Anthropic API key is set.', code: 'AI_UNAVAILABLE' }, 400);

    const [job, profile] = await Promise.all([client.getJobDetails(refnr), storage.readProfile()]);
    const language: LetterLanguage =
      choice === 'auto' ? detectLanguage(job.stellenangebotsTitel, job.stellenangebotsBeschreibung) : choice;
    const file = await lettersFor(refnr, job);

    if (mode === 'ai' && generator) {
      const result = await generator({ profile, job, language });
      const version = await addVersion(file, { source: 'claude', language, text: result.letter, adKeywords: result.adKeywords });
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

  app.all('/api/*', (c) => c.json({ error: 'Not found.' }, 404));

  return app;
}
