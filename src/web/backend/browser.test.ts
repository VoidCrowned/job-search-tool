import { describe, expect, it, vi } from 'vitest';
import detailsFixture from '../../api/fixtures/details.json';
import searchFixture from '../../api/fixtures/search.json';
import { MAX_VERSIONS } from '../../shared/letter.ts';
import type { AiConfig, LetterGenerator } from '../../shared/letter/claude.ts';
import { RefusalError } from '../../shared/letter/claude.ts';
import { emptyProfile } from '../../shared/profile.ts';
import { RequestError } from '../api.ts';
import { createBrowserBackend, type KeyStorage } from './browser.ts';
import { memoryStore } from './store.ts';

const RELAY = 'https://relay.example';
const ref = detailsFixture.referenznummer;
const OR_KEY = 'sk-or-v1-0123456789abcdefWXYZ';

function setup(generator: LetterGenerator = vi.fn(async () => ({ letter: 'Claude letter', adKeywords: ['Pflege'], missing: ['Umzug'] }))) {
  const store = memoryStore();
  let key: string | null = null;
  const keyStorage: KeyStorage = { get: () => key, set: (k) => void (key = k), remove: () => void (key = null) };
  const fetch = vi.fn(async (url: string) => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/pc/v6/jobs?')) return json(searchFixture);
    if (url.includes('/pc/v4/jobdetails/')) return json(detailsFixture);
    return json({}, 404);
  });
  const configs: AiConfig[] = [];
  const backend = createBrowserBackend({
    relayUrl: `${RELAY}/`,
    store,
    keyStorage,
    fetch: fetch as unknown as typeof globalThis.fetch,
    createGenerator: (config) => {
      configs.push(config);
      return generator;
    },
  });
  return { backend, store, fetch, configs, getKey: () => key };
}

describe('browser backend', () => {
  it('searches and loads details through the relay, and builds logo URLs on it', async () => {
    const { backend, fetch } = setup();
    const result = await backend.searchJobs(new URLSearchParams('was=Pflege&wo=Hamburg&zeitarbeit=false'));
    expect(result.ergebnisliste).toHaveLength(searchFixture.ergebnisliste.length);
    expect(fetch.mock.calls[0][0]).toBe(`${RELAY}/jobboerse/jobsuche-service/pc/v6/jobs?page=1&size=25&was=Pflege&wo=Hamburg&zeitarbeit=false`);
    expect((await backend.jobDetails(ref)).referenznummer).toBe(ref);
    expect(backend.logoUrl('abc_DEF-123')).toBe(`${RELAY}/vermittlung/ag-darstellung-service/ct/v1/arbeitgeberlogo/abc_DEF-123`);
    await expect(backend.searchJobs(new URLSearchParams('umkreis=-5'))).rejects.toMatchObject({ status: 400 });
  });

  it('keeps the profile in browser storage, validated', async () => {
    const { backend, store } = setup();
    expect(await backend.getProfile()).toEqual(emptyProfile());
    await backend.saveProfile({ ...emptyProfile(), name: 'Void' });
    expect(store.data.get('profile')).toMatchObject({ name: 'Void' });
    expect((await backend.getProfile()).name).toBe('Void');
    await expect(backend.saveProfile({ ...emptyProfile(), name: 'x'.repeat(10_000) })).rejects.toMatchObject({ status: 400 });
  });

  it('stores the key only in its key storage and shows a hint', async () => {
    const { backend, getKey, store } = setup();
    expect(await backend.keyStatus()).toEqual({ set: false });
    expect(await backend.aiConfig()).toEqual({ ai: false });
    await expect(backend.setKey('hello')).rejects.toMatchObject({ code: 'INVALID_KEY' });
    expect(await backend.setKey(` ${OR_KEY} `)).toEqual({ set: true, provider: 'openrouter', hint: 'sk-or-…WXYZ' });
    expect(getKey()).toBe(OR_KEY);
    expect(JSON.stringify([...store.data])).not.toContain('0123456789');
    expect(await backend.aiConfig()).toEqual({ ai: true, model: 'anthropic/claude-opus-5.5', provider: 'openrouter' });
    expect(await backend.removeKey()).toEqual({ set: false });
  });

  it('fills templates without a key, and refuses Claude until one is set', async () => {
    const { backend } = setup();
    await backend.saveProfile({ ...emptyProfile(), name: 'Void' });
    const { version, file } = await backend.generateLetter(ref, { language: 'auto', mode: 'template' });
    expect(version).toMatchObject({ source: 'template', language: 'de' });
    expect(file.jobTitle).toBe(detailsFixture.stellenangebotsTitel);
    await expect(backend.generateLetter(ref, { language: 'auto', mode: 'ai' })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('writes with Claude in the browser using the visitor\'s key, and keeps versions', async () => {
    const { backend, configs } = setup();
    await backend.setKey(OR_KEY);
    const first = await backend.generateLetter(ref, { language: 'de', mode: 'ai', confirmed: ['Führerschein'] });
    expect(first.version).toMatchObject({ source: 'claude', text: 'Claude letter', missing: ['Umzug'], confirmed: ['Führerschein'] });
    expect(configs).toEqual([{ provider: 'openrouter', apiKey: OR_KEY, model: 'anthropic/claude-opus-5.5' }]);
    await backend.saveVersion(ref, { text: 'Edited', language: 'de' });
    const file = await backend.getLetters(ref);
    expect(file.versions.map((v) => v.source)).toEqual(['claude', 'edit']);
    await expect(backend.saveVersion(ref, { text: ' ', language: 'de' })).rejects.toMatchObject({ status: 400 });
    for (let i = 0; i < MAX_VERSIONS; i++) await backend.saveVersion(ref, { text: `v${i}`, language: 'de' });
    expect((await backend.getLetters(ref)).versions).toHaveLength(MAX_VERSIONS);
  });

  it('turns Claude errors into the same codes as the local server', async () => {
    const { backend } = setup(vi.fn(async () => Promise.reject(new RefusalError())));
    await backend.setKey(OR_KEY);
    const err = await backend.generateLetter(ref, { language: 'de', mode: 'ai' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RequestError);
    expect(err).toMatchObject({ status: 422, code: 'AI_REFUSED' });
  });

  it('exports everything (key only when asked) and imports it into another browser', async () => {
    const a = setup();
    await a.backend.saveProfile({ ...emptyProfile(), name: 'Void' });
    await a.backend.setKey(OR_KEY);
    await a.backend.generateLetter(ref, { language: 'de', mode: 'template' });
    const without = await a.backend.exportData(false);
    expect(without.apiKey).toBeUndefined();
    const backup = await a.backend.exportData(true);
    expect(backup).toMatchObject({ app: 'job-search-tool', version: 1, apiKey: OR_KEY, profile: { name: 'Void' } });
    expect(backup.letters).toHaveLength(1);

    const b = setup();
    await b.backend.saveVersion(ref, { text: 'Already here', language: 'de' });
    expect(await b.backend.importData(JSON.parse(JSON.stringify(backup)))).toEqual({ letters: 1 });
    expect((await b.backend.getProfile()).name).toBe('Void');
    expect((await b.backend.getLetters(ref)).versions).toHaveLength(2);
    expect(b.getKey()).toBeNull();
    await expect(b.backend.importData({ nope: true } as never)).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
  });
});
