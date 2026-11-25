import { describe, expect, it, vi } from 'vitest';
import { CACHE_SECONDS, handleRelay } from './relay.ts';

const env = { ALLOWED_ORIGINS: 'https://voidcrowned.github.io, http://localhost:5173' };
const SITE = 'https://voidcrowned.github.io';
const SEARCH = '/jobboerse/jobsuche-service/pc/v6/jobs';
const DETAILS = '/jobboerse/jobsuche-service/pc/v4/jobdetails/MTAwMDEtMTAwMzg5MTA0NS1T';
const LOGO = '/vermittlung/ag-darstellung-service/ct/v1/arbeitgeberlogo/abcDEF123_-xyz';

function upstream(body = '{"ok":true}', status = 200, contentType = 'application/json') {
  return vi.fn(async (url: string, init?: RequestInit) => {
    void url;
    void init;
    return new Response(body, { status, headers: { 'Content-Type': contentType, 'Set-Cookie': 'tracking=1' } });
  });
}
const call = (path: string, init: RequestInit & { origin?: string } = {}, fetchFn = upstream()) => {
  const headers = new Headers(init.headers);
  if (init.origin) headers.set('Origin', init.origin);
  return { res: handleRelay(new Request(`https://relay.example${path}`, { ...init, headers }), env, fetchFn), fetchFn };
};

describe('job-search relay', () => {
  it('forwards a search with its query, adds the public key and lets the site read it', async () => {
    const { res, fetchFn } = call(`${SEARCH}?was=Pflege&wo=Hamburg`, { origin: SITE });
    const r = await res;
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(r.headers.get('Cache-Control')).toBe(`public, max-age=${CACHE_SECONDS}`);
    expect(r.headers.get('Set-Cookie')).toBeNull();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`https://rest.arbeitsagentur.de${SEARCH}?was=Pflege&wo=Hamburg`);
    expect(new Headers(init!.headers).get('X-API-Key')).toBe('jobboerse-jobsuche');
  });

  it('forwards details and logos without a query string', async () => {
    for (const path of [DETAILS, LOGO]) {
      const { res, fetchFn } = call(`${path}?evil=1`);
      expect((await res).status).toBe(200);
      expect(fetchFn.mock.calls[0][0]).toBe(`https://rest.arbeitsagentur.de${path}`);
    }
  });

  it('gives other websites no CORS access', async () => {
    const r = await call(SEARCH, { origin: 'https://evil.example' }).res;
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(r.headers.get('Vary')).toBe('Origin');
  });

  it('answers the preflight for the site only', async () => {
    const ok = await call(SEARCH, { method: 'OPTIONS', origin: SITE }).res;
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('X-API-Key');
    const other = await call(SEARCH, { method: 'OPTIONS', origin: 'https://evil.example' }).res;
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('refuses other paths and methods without calling upstream', async () => {
    const cases: [string, RequestInit][] = [
      ['/jobboerse/jobsuche-service/pc/v6/other', {}],
      ['/jobboerse/jobsuche-service/pc/v4/jobdetails/../../secret', {}],
      ['/anything', {}],
      [SEARCH, { method: 'POST', body: '{}' }],
      [`${SEARCH}?q=${'x'.repeat(2100)}`, {}],
    ];
    for (const [path, init] of cases) {
      const { res, fetchFn } = call(path, init);
      expect((await res).status).toBeGreaterThanOrEqual(400);
      expect(fetchFn).not.toHaveBeenCalled();
    }
  });

  it('passes upstream errors through without caching them, and reports an unreachable upstream', async () => {
    const r = await call(DETAILS, {}, upstream('{"messages":[{"code":"STELLENANGEBOT_NICHT_GEFUNDEN"}]}', 404)).res;
    expect(r.status).toBe(404);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    const down = await call(SEARCH, {}, vi.fn(async () => Promise.reject(new Error('down')))).res;
    expect(down.status).toBe(502);
  });

  it('does not pass on the upstream body length (fetch has decompressed the body)', async () => {
    const fetchFn = vi.fn(async () => new Response('{"ok":true}', { headers: { 'Content-Length': '5', 'Content-Encoding': 'gzip' } }));
    const r = await call(SEARCH, {}, fetchFn).res;
    expect(r.headers.get('Content-Length')).toBeNull();
    expect(r.headers.get('Content-Encoding')).toBeNull();
    expect(await r.json()).toEqual({ ok: true });
  });

  it('has a health check', async () => {
    expect((await call('/health').res).status).toBe(200);
  });
});
