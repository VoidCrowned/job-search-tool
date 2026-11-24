// Browser-side calls to my local server (never to the Jobsuche API directly).
import { useEffect, useState } from 'react';

export class RequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new RequestError(0, 'The local server is not reachable. Is `npm run dev` running?');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as { error?: string; details?: string[] } | undefined;
    const message = [body?.error ?? `Request failed (${res.status}).`, ...(body?.details ?? [])].join(' ');
    throw new RequestError(res.status, message);
  }
  return (await res.json()) as T;
}

export type Loadable<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; error: RequestError }
  | { state: 'done'; data: T };

/** Fetches `url` whenever it changes; `null` means "don't fetch". Aborts outdated requests. */
export function useJson<T>(url: string | null): Loadable<T> {
  const [result, setResult] = useState<{ url: string | null; value: Loadable<T> }>({ url: null, value: { state: 'idle' } });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    getJson<T>(url, controller.signal).then(
      (data) => setResult({ url, value: { state: 'done', data } }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const err = error instanceof RequestError ? error : new RequestError(0, String(error));
        setResult({ url, value: { state: 'error', error: err } });
      },
    );
    return () => controller.abort();
  }, [url]);

  if (!url) return { state: 'idle' };
  // Until the effect has stored a result for the current URL, we are loading.
  return result.url === url ? result.value : { state: 'loading' };
}
