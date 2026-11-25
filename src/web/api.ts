// Browser-side calls to my local server (never to the Jobsuche API directly).
import { useEffect, useRef, useState } from 'react';

import type { Messages } from './i18n/en.ts';

/** status 0 = the local server itself could not be reached. */
export class RequestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The error text to show, in the current language. */
export function errorText(err: RequestError, t: Messages): string {
  if (err.status === 0) return t.errors.serverDown;
  switch (err.code) {
    case 'AI_REFUSED':
      return t.errors.aiRefused;
    case 'AI_AUTH':
      return t.errors.aiAuth;
    case 'AI_RATE_LIMIT':
      return t.errors.aiRateLimit;
    case 'AI_ERROR':
      return t.errors.aiFailed;
    case 'AI_UNAVAILABLE':
      return t.errors.aiUnavailable;
    case 'INVALID_KEY':
      return t.errors.invalidKey;
    case 'UNKNOWN_ROUTE':
      return t.errors.outdatedServer;
    case 'INVALID_BACKUP':
      return t.errors.invalidBackup;
  }
  if (err.status === 404) return t.errors.notFound;
  if (err.status === 400) return t.errors.invalid;
  if (err.status === 502 || err.status === 503 || err.status === 504) return t.errors.upstream;
  return t.errors.generic(err.status);
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(url, { signal });
}

/** PUT/POST a JSON body and read the JSON answer. */
export async function sendJson<T>(method: 'PUT' | 'POST', url: string, body: unknown): Promise<T> {
  return requestJson<T>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function deleteJson<T>(url: string): Promise<T> {
  return requestJson<T>(url, { method: 'DELETE' });
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new RequestError(0, 'The local server is not reachable.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as { error?: string; code?: string; details?: string[] } | undefined;
    const message = [body?.error ?? `Request failed (${res.status}).`, ...(body?.details ?? [])].join(' ');
    throw new RequestError(res.status, message, body?.code);
  }
  return (await res.json()) as T;
}

export type Loadable<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; error: RequestError }
  | { state: 'done'; data: T };

/**
 * Runs `load` whenever `key` changes; `null` means "don't load". Aborts outdated requests.
 * `key` names what is loaded (e.g. the search query), so `load` itself may be a new function on every render.
 */
export function useLoad<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): Loadable<T> {
  const [result, setResult] = useState<{ key: string | null; value: Loadable<T> }>({ key: null, value: { state: 'idle' } });
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (data) => setResult({ key, value: { state: 'done', data } }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const err = error instanceof RequestError ? error : new RequestError(0, String(error));
        setResult({ key, value: { state: 'error', error: err } });
      },
    );
    return () => controller.abort();
  }, [key]);

  if (key === null) return { state: 'idle' };
  // Until the effect has stored a result for the current key, we are loading.
  return result.key === key ? result.value : { state: 'loading' };
}
