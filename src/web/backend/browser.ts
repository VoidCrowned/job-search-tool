// The online version's backend (#10): everything happens in the visitor's browser. Job search goes through
// the relay (worker/), profile and letters stay in browser storage, and Claude is called directly with the
// visitor's own key, which never leaves this browser except to Anthropic or OpenRouter.
import { createJobsucheClient, logoUrl, UPSTREAM_HOST } from '../../api/client.ts';
import { parseSearchParams } from '../../api/params.ts';
import { isValidApiKey, keyHint } from '../../shared/apiKey.ts';
import { describeError } from '../../shared/errors.ts';
import { makeBackup, mergeLetterFiles, parseBackup } from '../../shared/backup.ts';
import { isLanguageChoice, MAX_LETTER_LENGTH, parseConfirmed, type LetterFile } from '../../shared/letter.ts';
import { aiConfigFromEnv, createClaudeGenerator, type AiConfig as ClaudeConfig, type LetterGenerator } from '../../shared/letter/claude.ts';
import { addVersion, letterFileFor, writeLetter, type NewVersion } from '../../shared/letter/service.ts';
import { emptyProfile, parseProfile } from '../../shared/profile.ts';
import { RequestError } from '../api.ts';
import type { KeyValueStore } from './store.ts';
import type { Backend, KeyStatus } from './types.ts';

export interface KeyStorage {
  get(): string | null;
  set(key: string): void;
  remove(): void;
}

/** The visitor's key in localStorage: only this site can read it. */
export function localKeyStorage(name = 'jobsuche:apiKey'): KeyStorage {
  return {
    get: () => localStorage.getItem(name),
    set: (key) => localStorage.setItem(name, key),
    remove: () => localStorage.removeItem(name),
  };
}

export interface BrowserBackendOptions {
  /** The job-search relay, e.g. https://job-search-relay.example.workers.dev */
  relayUrl: string;
  store: KeyValueStore;
  keyStorage: KeyStorage;
  fetch?: typeof fetch;
  /** For tests: replaces the real Claude generator. */
  createGenerator?: (config: ClaudeConfig) => LetterGenerator;
}

const PROFILE = 'profile';
const lettersKey = (refnr: string) => `letters:${refnr}`;

/** Errors as RequestErrors with the same codes the local server sends, so the website shows the same texts. */
async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof RequestError) throw err;
    const info = describeError(err);
    throw new RequestError(info.status, info.message, info.code);
  }
}

export function createBrowserBackend(options: BrowserBackendOptions): Backend {
  const relay = options.relayUrl.replace(/\/$/, '');
  const client = createJobsucheClient({ baseUrl: `${relay}/jobboerse/jobsuche-service`, fetch: options.fetch });
  const makeGenerator = options.createGenerator ?? ((config) => createClaudeGenerator({ ...config, browser: true }));
  const { store, keyStorage } = options;

  let cached: { key: string; config: ClaudeConfig; generator: LetterGenerator } | undefined;
  const ai = () => {
    const key = keyStorage.get();
    if (!key) return undefined;
    if (cached?.key !== key) {
      const config = aiConfigFromEnv({ ANTHROPIC_API_KEY: key });
      cached = { key, config, generator: makeGenerator(config) };
    }
    return cached;
  };
  const keyStatus = (): KeyStatus => {
    const current = ai();
    return current ? { set: true, provider: current.config.provider, hint: keyHint(current.key) } : { set: false };
  };

  const readProfile = async () => parseProfile((await store.get(PROFILE)) ?? emptyProfile()).profile;
  const readLetters = async (refnr: string) => {
    const raw = await store.get<LetterFile>(lettersKey(refnr));
    return raw && Array.isArray(raw.versions) ? raw : undefined;
  };
  const saveNew = async (file: LetterFile, version: NewVersion) => {
    const full = addVersion(file, version);
    await store.set(lettersKey(file.refnr), file);
    return { file, version: full };
  };

  return {
    kind: 'browser',

    searchJobs: (query) =>
      guard(async () => {
        const { params, errors } = parseSearchParams(query);
        if (errors.length) throw new RequestError(400, 'Invalid search.');
        return client.searchJobs(params);
      }),
    jobDetails: (refnr) => guard(() => client.getJobDetails(refnr)),
    logoUrl: (hash) => logoUrl(hash).replace(UPSTREAM_HOST, relay),

    getProfile: () => guard(readProfile),
    saveProfile: (profile) =>
      guard(async () => {
        const parsed = parseProfile(profile);
        if (parsed.errors.length) throw new RequestError(400, 'Invalid profile.');
        await store.set(PROFILE, parsed.profile);
        return parsed.profile;
      }),

    getLetters: (refnr) => guard(async () => letterFileFor(refnr, await readLetters(refnr))),
    generateLetter: (refnr, request) =>
      guard(async () => {
        const confirmed = parseConfirmed(request.confirmed);
        if (confirmed === null || !isLanguageChoice(request.language)) throw new RequestError(400, 'Invalid request.');
        const generator = ai()?.generator;
        if (request.mode === 'ai' && !generator) throw new RequestError(400, 'No API key is set.', 'AI_UNAVAILABLE');
        const [job, profile, stored] = await Promise.all([client.getJobDetails(refnr), readProfile(), readLetters(refnr)]);
        const version = await writeLetter({ profile, job, language: request.language, mode: request.mode, generator, confirmed });
        return saveNew(letterFileFor(refnr, stored, job), version);
      }),
    saveVersion: (refnr, { text, language }) =>
      guard(async () => {
        if (!text.trim() || text.length > MAX_LETTER_LENGTH || (language !== 'de' && language !== 'en')) {
          throw new RequestError(400, 'Invalid letter text.');
        }
        return saveNew(letterFileFor(refnr, await readLetters(refnr)), { source: 'edit', language, text });
      }),

    exportData: (includeKey) =>
      guard(async () => {
        const keys = await store.keys('letters:');
        const files = (await Promise.all(keys.map((k) => store.get<LetterFile>(k)))).filter((f): f is LetterFile => Boolean(f));
        return makeBackup(await readProfile(), files, includeKey ? (keyStorage.get() ?? undefined) : undefined);
      }),
    importData: (input) =>
      guard(async () => {
        const { backup, error } = parseBackup(input);
        if (!backup) throw new RequestError(400, error ?? 'Invalid backup.', 'INVALID_BACKUP');
        await store.set(PROFILE, backup.profile);
        for (const imported of backup.letters) {
          await store.set(lettersKey(imported.refnr), mergeLetterFiles(await readLetters(imported.refnr), imported));
        }
        return { letters: backup.letters.length };
      }),

    aiConfig: async () => {
      const current = ai();
      return current ? { ai: true, model: current.config.model, provider: current.config.provider } : { ai: false };
    },
    keyStatus: async () => keyStatus(),
    setKey: async (key) => {
      const trimmed = key.trim();
      if (!isValidApiKey(trimmed)) {
        throw new RequestError(400, 'That does not look like an OpenRouter (sk-or-…) or Anthropic (sk-ant-…) key.', 'INVALID_KEY');
      }
      keyStorage.set(trimmed);
      return keyStatus();
    },
    removeKey: async () => {
      keyStorage.remove();
      return keyStatus();
    },
  };
}
