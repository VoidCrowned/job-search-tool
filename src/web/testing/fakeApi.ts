// A fake local server for UI tests: answers every /api route the web app uses.
import { vi } from 'vitest';
import searchFixture from '../../api/fixtures/search.json';
import detailsFixture from '../../api/fixtures/details.json';
import { emptyProfile } from '../../shared/profile.ts';

type Handler = (url: string, init?: RequestInit) => unknown | Promise<unknown>;

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** `overrides` maps a URL prefix to a handler; the first matching prefix wins over the defaults. */
export function fakeApi(overrides: Record<string, Handler> = {}) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    for (const [prefix, handler] of Object.entries(overrides)) {
      if (url.startsWith(prefix)) {
        const result = await handler(url, init);
        return result instanceof Response ? result : json(result);
      }
    }
    if (url.startsWith('/api/jobs?')) return json(searchFixture);
    if (url.startsWith('/api/jobs/')) return json({ ...detailsFixture, referenznummer: decodeURIComponent(url.split('/').pop()!) });
    if (url.startsWith('/api/letters/')) return json({ refnr: decodeURIComponent(url.split('/')[3]), jobTitle: '', versions: [] });
    if (url === '/api/profile') return json(emptyProfile());
    if (url === '/api/config') return json({ ai: false });
    return json({ error: 'Not found.' }, 404);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
