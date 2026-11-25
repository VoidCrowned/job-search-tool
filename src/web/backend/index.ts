// The backend the website uses, picked at build time: the local server (npm run dev / npm start), or the
// browser-only backend of the online version (built with VITE_HOSTED=1 and VITE_RELAY_URL, see #10).
import { createBrowserBackend, localKeyStorage } from './browser.ts';
import { localBackend } from './local.ts';
import { indexedDbStore } from './store.ts';
import type { Backend } from './types.ts';
export type { AiConfig, Backend, GenerateRequest, KeyStatus, LetterResult } from './types.ts';

export const isHosted = import.meta.env.VITE_HOSTED === '1';

export const backend: Backend = isHosted
  ? createBrowserBackend({ relayUrl: import.meta.env.VITE_RELAY_URL ?? '', store: indexedDbStore(), keyStorage: localKeyStorage() })
  : localBackend;
