import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.ts';
import { createStorage, letterFileName } from './storage.ts';
import { emptyProfile } from '../shared/profile.ts';
import type { JobsucheClient } from '../api/client.ts';
import type { LetterFile, LetterVersion } from '../shared/letter.ts';
import detailsFixture from '../api/fixtures/details.json';
import Anthropic from '@anthropic-ai/sdk';
import { RefusalError, type LetterGenerator } from '../shared/letter/claude.ts';

const ref = detailsFixture.referenznummer;
let dir: string;
let client: JobsucheClient;

const app = () => createApp({ client, storage: createStorage(dir), generator: null });
const post = (path: string, body: unknown) =>
  app().request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'jobsuche-test-'));
  client = { searchJobs: vi.fn(), getJobDetails: vi.fn(async () => detailsFixture) } as unknown as JobsucheClient;
  await createStorage(dir).writeProfile({ ...emptyProfile(), name: 'Void Example', city: 'Hamburg' });
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('letters API', () => {
  it('starts with no versions', async () => {
    expect(await (await app().request(`/api/letters/${ref}`)).json()).toEqual({ refnr: ref, jobTitle: '', versions: [] });
  });

  it('reports that AI is not available yet', async () => {
    expect(await (await app().request('/api/config')).json()).toEqual({ ai: false });
  });

  it('fills a template, detects the language and stores it', async () => {
    const res = await post(`/api/letters/${ref}/generate`, { language: 'auto' });
    expect(res.status).toBe(200);
    const { file, version } = (await res.json()) as { file: LetterFile; version: LetterVersion };
    expect(version).toMatchObject({ source: 'template', language: 'de' });
    expect(version.text).toContain('Void Example');
    expect(file).toMatchObject({ refnr: ref, jobTitle: detailsFixture.stellenangebotsTitel, company: detailsFixture.firma });
    expect(await readdir(join(dir, 'letters'))).toEqual([letterFileName(ref)]);
    const again = (await (await app().request(`/api/letters/${ref}`)).json()) as LetterFile;
    expect(again.versions).toHaveLength(1);
  });

  it('honours an explicit language', async () => {
    const { version } = (await (await post(`/api/letters/${ref}/generate`, { language: 'en' })).json()) as { version: LetterVersion };
    expect(version.language).toBe('en');
    expect(version.text).toContain('Dear Sir or Madam');
  });

  it('saves edits as new versions, keeping the old ones', async () => {
    await post(`/api/letters/${ref}/generate`, {});
    const res = await post(`/api/letters/${ref}/versions`, { text: 'My edited letter', language: 'de' });
    expect(res.status).toBe(200);
    const file = (await (await app().request(`/api/letters/${ref}`)).json()) as LetterFile;
    expect(file.versions.map((v) => v.source)).toEqual(['template', 'edit']);
    expect(file.versions[1].text).toBe('My edited letter');
  });

  it('validates input', async () => {
    expect((await post(`/api/letters/${ref}/generate`, { language: 'fr' })).status).toBe(400);
    expect((await post(`/api/letters/${ref}/versions`, { text: '  ', language: 'de' })).status).toBe(400);
    expect((await post(`/api/letters/${ref}/versions`, { text: 'x', language: 'fr' })).status).toBe(400);
    expect((await post(`/api/letters/${ref}/versions`, { text: 'x'.repeat(20_001), language: 'de' })).status).toBe(400);
    expect((await app().request('/api/letters/a%20b')).status).toBe(400);
  });

  it('keeps at most 50 versions', async () => {
    const storage = createStorage(dir);
    const versions = Array.from({ length: 55 }, (_, i) => ({ id: String(i), createdAt: '', source: 'edit' as const, language: 'de' as const, text: `v${i}` }));
    await storage.writeLetters({ refnr: ref, jobTitle: 'x', versions });
    const file = await storage.readLetters(ref);
    expect(file?.versions).toHaveLength(50);
    expect(file?.versions[0].text).toBe('v5');
  });

  it('makes safe file names', () => {
    expect(letterFileName('13643-2L_626832-S')).toBe('13643-2L_626832-S.json');
    expect(letterFileName('a:b*c')).toBe('a_b_c.json');
  });
});

describe('letters API with Claude', () => {
  const withAi = (generator: LetterGenerator) => createApp({ client, storage: createStorage(dir), generator, model: 'claude-opus-5-5' });
  const postAi = (generator: LetterGenerator, body: unknown) =>
    withAi(generator).request(`/api/letters/${ref}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('reports the model in /api/config', async () => {
    expect(await (await withAi(vi.fn()).request('/api/config')).json()).toEqual({ ai: true, model: 'claude-opus-5-5', provider: 'anthropic' });
  });

  it('uses Claude by default when available and stores the keywords', async () => {
    const generator = vi.fn(async () => ({ letter: 'Claude letter', adKeywords: ['Pflege'], missing: ['Umzug nach Berlin'] }));
    const { version } = (await (await postAi(generator, { language: 'auto' })).json()) as { version: LetterVersion };
    expect(version).toMatchObject({ source: 'claude', language: 'de', text: 'Claude letter', adKeywords: ['Pflege'], missing: ['Umzug nach Berlin'] });
    expect(generator).toHaveBeenCalledWith(expect.objectContaining({ language: 'de', job: expect.objectContaining({ referenznummer: ref }) }));
    expect(((generator.mock.calls[0] as unknown[])[0] as { profile: { name: string } }).profile.name).toBe('Void Example');
  });

  it('passes ticked points to Claude as confirmed and stores them', async () => {
    const generator = vi.fn(async () => ({ letter: 'Claude letter', adKeywords: [], missing: [] }));
    const res = await postAi(generator, { language: 'de', mode: 'ai', confirmed: [' Umzug nach Berlin ', 'Umzug nach Berlin', 'Führerschein'] });
    const { version } = (await res.json()) as { version: LetterVersion };
    expect(version.confirmed).toEqual(['Umzug nach Berlin', 'Führerschein']);
    expect(version).not.toHaveProperty('missing');
    expect(generator).toHaveBeenCalledWith(expect.objectContaining({ confirmed: ['Umzug nach Berlin', 'Führerschein'] }));
  });

  it('rejects invalid confirmed points', async () => {
    const generator = vi.fn();
    for (const confirmed of ['x', [1], [''], ['x'.repeat(301)], Array.from({ length: 21 }, (_, i) => `p${i}`)]) {
      expect((await postAi(generator, { mode: 'ai', confirmed })).status).toBe(400);
    }
    expect(generator).not.toHaveBeenCalled();
  });

  it('still fills the template when asked', async () => {
    const generator = vi.fn();
    const { version } = (await (await postAi(generator, { mode: 'template' })).json()) as { version: LetterVersion };
    expect(version.source).toBe('template');
    expect(generator).not.toHaveBeenCalled();
  });

  it('refuses AI mode without a key', async () => {
    const res = await post(`/api/letters/${ref}/generate`, { mode: 'ai' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('maps refusals and API errors to clear codes without storing anything', async () => {
    const refused = await postAi(vi.fn(async () => { throw new RefusalError(); }), {});
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ code: 'AI_REFUSED' });
    const auth = await postAi(vi.fn(async () => { throw new Anthropic.AuthenticationError(401, undefined, 'invalid x-api-key', new Headers()); }), {});
    expect(auth.status).toBe(502);
    expect(await auth.json()).toMatchObject({ code: 'AI_AUTH' });
    const limit = await postAi(vi.fn(async () => { throw new Anthropic.RateLimitError(429, undefined, 'slow down', new Headers()); }), {});
    expect(await limit.json()).toMatchObject({ code: 'AI_RATE_LIMIT' });
    expect((await createStorage(dir).readLetters(ref))?.versions ?? []).toEqual([]);
  });
});
