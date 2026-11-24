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

const ref = detailsFixture.referenznummer;
let dir: string;
let client: JobsucheClient;

const app = () => createApp({ client, storage: createStorage(dir) });
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
