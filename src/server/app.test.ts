import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';
import { JobsucheError, type JobsucheClient } from '../api/client.ts';
import searchFixture from '../api/fixtures/search.json';
import detailsFixture from '../api/fixtures/details.json';

function fakeClient(overrides: Partial<JobsucheClient> = {}): JobsucheClient {
  return {
    searchJobs: vi.fn(async () => searchFixture),
    getJobDetails: vi.fn(async () => detailsFixture),
    ...overrides,
  } as JobsucheClient;
}

describe('server', () => {
  it('answers the health check', async () => {
    const res = await createApp({ client: fakeClient() }).request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('unknown API routes give a JSON 404', async () => {
    const res = await createApp({ client: fakeClient() }).request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.', code: 'UNKNOWN_ROUTE' });
  });
});

describe('GET /api/jobs', () => {
  it('passes parsed parameters to the client', async () => {
    const client = fakeClient();
    const res = await createApp({ client }).request('/api/jobs?was=Pflege&befristung=1;2&page=2');
    expect(res.status).toBe(200);
    expect((await res.json()).maxErgebnisse).toBe(searchFixture.maxErgebnisse);
    expect(client.searchJobs).toHaveBeenCalledWith({ was: 'Pflege', befristung: ['1', '2'], page: 2, size: 25 });
  });

  it('rejects invalid parameters without calling the API', async () => {
    const client = fakeClient();
    const res = await createApp({ client }).request('/api/jobs?umkreis=abc');
    expect(res.status).toBe(400);
    expect((await res.json()).details).toHaveLength(1);
    expect(client.searchJobs).not.toHaveBeenCalled();
  });

  it('maps upstream failures to 502', async () => {
    const client = fakeClient({ searchJobs: vi.fn(async () => { throw new JobsucheError(403, 'refused'); }) });
    const res = await createApp({ client }).request('/api/jobs');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'refused' });
  });
});

describe('GET /api/jobs/:refnr', () => {
  it('returns details', async () => {
    const client = fakeClient();
    const res = await createApp({ client }).request('/api/jobs/20294-109030X354680-S');
    expect(res.status).toBe(200);
    expect((await res.json()).referenznummer).toBe('20294-109030X354680-S');
    expect(client.getJobDetails).toHaveBeenCalledWith('20294-109030X354680-S');
  });

  it('passes 404 through', async () => {
    const client = fakeClient({
      getJobDetails: vi.fn(async () => { throw new JobsucheError(404, 'gone', 'STELLENANGEBOT_NICHT_GEFUNDEN'); }),
    });
    const res = await createApp({ client }).request('/api/jobs/10001-1-S');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'gone', code: 'STELLENANGEBOT_NICHT_GEFUNDEN' });
  });

  it.each(['13643-2L_626832-S', '13456-k14802.11829-S', '12951-4a19f40c-d84a-4349--S'])('accepts real reference number %s', async (ref) => {
    const client = fakeClient();
    const res = await createApp({ client }).request(`/api/jobs/${encodeURIComponent(ref)}`);
    expect(res.status).toBe(200);
    expect(client.getJobDetails).toHaveBeenCalledWith(ref);
  });

  it('rejects malformed reference numbers', async () => {
    const res = await createApp({ client: fakeClient() }).request('/api/jobs/a%20b');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/logo/:hash', () => {
  const hash = 'CJ6F8Z8g9s_FhCe36p7vfOZ8ero9xbcAJR2qLMzY5AU=';

  it('streams the image', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } }));
    const res = await createApp({ client: fakeClient(), fetch }).request(`/api/logo/${encodeURIComponent(hash)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toMatch(/arbeitgeberlogo\/CJ6F8Z8g9s_FhCe36p7vfOZ8ero9xbcAJR2qLMzY5AU%3D$/);
  });

  it('passes 404 through when there is no logo', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 404 }));
    const res = await createApp({ client: fakeClient(), fetch }).request(`/api/logo/${encodeURIComponent(hash)}`);
    expect(res.status).toBe(404);
  });
});
