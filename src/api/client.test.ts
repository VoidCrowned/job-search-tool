import { describe, expect, it, vi } from 'vitest';
import { API_KEY, createJobsucheClient, encodeRefnr, jobPageUrl, JobsucheError, logoUrl } from './client.ts';
import searchFixture from './fixtures/search.json';
import detailsFixture from './fixtures/details.json';

function mockFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('encodeRefnr', () => {
  it('matches the example from the API docs', () => {
    expect(encodeRefnr('10001-1002716922-S')).toBe('MTAwMDEtMTAwMjcxNjkyMi1T');
  });
  it('keeps padding', () => {
    expect(encodeRefnr('13644-305714-S')).toBe('MTM2NDQtMzA1NzE0LVM=');
  });
  it('handles non-ASCII as UTF-8', () => {
    expect(atob(encodeRefnr('ä'))).toBe('\xc3\xa4');
  });
});

describe('URLs', () => {
  it('URL-encodes the logo hash', () => {
    expect(logoUrl('abc=')).toMatch(/\/ct\/v1\/arbeitgeberlogo\/abc%3D$/);
  });
  it('builds the public job page URL', () => {
    expect(jobPageUrl('10001-1-S')).toBe('https://www.arbeitsagentur.de/jobsuche/jobdetail/10001-1-S');
  });
});

describe('searchJobs', () => {
  it('sends the API key and joins lists with ;', async () => {
    const fetch = mockFetch(searchFixture);
    const client = createJobsucheClient({ fetch });
    const res = await client.searchJobs({ was: 'Pflege', befristung: ['1', '2'], page: 2, size: 10 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/jobboerse/jobsuche-service/pc/v6/jobs');
    expect(parsed.searchParams.get('befristung')).toBe('1;2');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe(API_KEY);
    expect(res.ergebnisliste).toHaveLength(3);
    expect(res.ergebnisliste?.[0].referenznummer).toBe('10001-1003891045-S');
  });

  it('returns an empty list when the API leaves ergebnisliste out', async () => {
    const client = createJobsucheClient({ fetch: mockFetch({ maxErgebnisse: 0, page: 1, size: 25 }) });
    expect((await client.searchJobs({ page: 1, size: 25 })).ergebnisliste).toEqual([]);
  });

  it('explains invalid parameters', async () => {
    const body = { messages: [{ code: 'EINGABEN_UNVOLLSTAENDIG_ODER_FEHLERHAFT', path: 'page', detail: 'Wert ungültig' }] };
    const client = createJobsucheClient({ fetch: mockFetch(body, 400) });
    await expect(client.searchJobs({ page: 1, size: 25 })).rejects.toMatchObject({
      status: 400,
      message: 'Invalid value for "page": Wert ungültig.',
    });
  });

  it('explains the result window limit', async () => {
    const client = createJobsucheClient({ fetch: mockFetch({ detail: 'Ergebnismenge überschritten', status: 400 }, 400) });
    await expect(client.searchJobs({ page: 1, size: 25 })).rejects.toThrow(/Narrow the search/);
  });

  it('turns network failures into a 502 JobsucheError after retrying', async () => {
    const fetch = vi.fn(async () => { throw new TypeError('fetch failed'); });
    const client = createJobsucheClient({ fetch });
    const err = await client.searchJobs({ page: 1, size: 25 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobsucheError);
    expect((err as JobsucheError).status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('recovers when a retry succeeds', async () => {
    const ok = mockFetch(searchFixture);
    const fetch = vi.fn()
      .mockImplementationOnce(async () => { throw new TypeError('fetch failed'); })
      .mockImplementation(ok);
    const client = createJobsucheClient({ fetch });
    expect((await client.searchJobs({ page: 1, size: 25 })).maxErgebnisse).toBe(searchFixture.maxErgebnisse);
  });

  it('does not retry HTTP errors', async () => {
    const fetch = mockFetch({ messages: [{ code: 'STELLENANGEBOT_NICHT_GEFUNDEN' }] }, 404);
    await createJobsucheClient({ fetch }).getJobDetails('x').catch(() => undefined);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('getJobDetails', () => {
  it('requests the Base64-encoded reference number', async () => {
    const fetch = mockFetch(detailsFixture);
    const client = createJobsucheClient({ fetch });
    const job = await client.getJobDetails('20294-109030X354680-S');
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(url).toContain(`/pc/v4/jobdetails/${encodeURIComponent(encodeRefnr('20294-109030X354680-S'))}`);
    expect(job.stellenangebotsBeschreibung).toBeTruthy();
  });

  it('explains missing job ads', async () => {
    const client = createJobsucheClient({ fetch: mockFetch({ messages: [{ code: 'STELLENANGEBOT_NICHT_GEFUNDEN' }] }, 404) });
    await expect(client.getJobDetails('x')).rejects.toMatchObject({ status: 404, code: 'STELLENANGEBOT_NICHT_GEFUNDEN' });
  });
});
