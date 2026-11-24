// Live smoke test against the real Jobsuche API. Prints one JSON object; exit code 1 if any check fails.
// Usage: npm run api:check

import { createJobsucheClient, logoUrl } from '../src/api/client.ts';
import { parseSearchParams } from '../src/api/params.ts';

interface Check {
  name: string;
  ok: boolean;
  detail?: unknown;
}

const client = createJobsucheClient();
const checks: Check[] = [];

async function check(name: string, fn: () => Promise<unknown>) {
  try {
    checks.push({ name, ok: true, detail: await fn() });
  } catch (err) {
    checks.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

let refnr: string | undefined;
let logoHash: string | undefined;

await check('search', async () => {
  const res = await client.searchJobs(parseSearchParams({ was: 'Entwickler', wo: 'Berlin', size: '10' }).params);
  const items = res.ergebnisliste ?? [];
  assert(res.maxErgebnisse > 0, 'no results');
  assert(items.length > 0, 'ergebnisliste is empty (response format changed?)');
  assert(items.every((i) => i.referenznummer && i.stellenangebotsTitel), 'items lack referenznummer/stellenangebotsTitel');
  refnr = items[0].referenznummer;
  logoHash = items.find((i) => i.arbeitgeberKundennummerHash)?.arbeitgeberKundennummerHash;
  return { total: res.maxErgebnisse, returned: items.length, first: refnr };
});

await check('filters', async () => {
  const base = parseSearchParams({ was: 'Pflege', wo: 'Hamburg', size: '1' }).params;
  const all = (await client.searchJobs(base)).maxErgebnisse;
  const permanent = (await client.searchJobs({ ...base, befristung: ['2'] })).maxErgebnisse;
  const both = (await client.searchJobs({ ...base, befristung: ['1', '2'] })).maxErgebnisse;
  assert(permanent > 0 && permanent < all, 'befristung=2 did not narrow the results');
  assert(both >= permanent, 'befristung=1;2 returned fewer results than befristung=2');
  return { all, permanent, fixedTermOrPermanent: both };
});

await check('details', async () => {
  assert(refnr, 'no reference number from search');
  const job = await client.getJobDetails(refnr);
  assert(job.referenznummer === refnr, 'details returned a different job');
  return { refnr, title: job.stellenangebotsTitel, hasDescription: Boolean(job.stellenangebotsBeschreibung) };
});

await check('details-not-found', async () => {
  const err = await client.getJobDetails('00000-0000000000-S').then(
    () => undefined,
    (e: unknown) => e as { status?: number },
  );
  assert(err?.status === 404, `expected 404, got ${err?.status ?? 'success'}`);
  return { status: 404 };
});

await check('logo', async () => {
  if (!logoHash) return { skipped: 'no employer with logo hash in results' };
  const res = await fetch(logoUrl(logoHash));
  // 404 is normal: many employers have no logo.
  assert(res.status === 200 || res.status === 404, `unexpected status ${res.status}`);
  return { status: res.status, contentType: res.headers.get('content-type') };
});

const ok = checks.every((c) => c.ok);
console.log(JSON.stringify({ ok, checkedAt: new Date().toISOString(), checks }, null, 2));
process.exit(ok ? 0 : 1);
