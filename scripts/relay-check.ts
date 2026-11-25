// Live check of a job-search relay (local or deployed). Prints one JSON object; exit code 1 if a check fails.
// Usage: npm run relay:check -- https://job-search-relay.<account>.workers.dev
import { createJobsucheClient, encodeRefnr } from '../src/api/client.ts';
import { parseSearchParams } from '../src/api/params.ts';

const relay = process.argv[2]?.replace(/\/$/, '');
const origin = process.argv[3] ?? 'https://voidcrowned.github.io';
if (!relay) {
  console.log(JSON.stringify({ ok: false, error: 'Usage: npm run relay:check -- <relay URL> [allowed origin]' }));
  process.exit(1);
}

const checks: Record<string, boolean> = {};
const facts: Record<string, unknown> = { relay, origin };
const started = Date.now();
try {
  const client = createJobsucheClient({ baseUrl: `${relay}/jobboerse/jobsuche-service`, retries: 0 });
  const search = await client.searchJobs(parseSearchParams({ was: 'Pflege', wo: 'Hamburg', size: '5' }).params);
  const items = search.ergebnisliste ?? [];
  checks.search = items.length > 0;
  facts.results = search.maxErgebnisse;
  const first = items[0];
  if (first) {
    const details = await client.getJobDetails(first.referenznummer);
    checks.details = details.referenznummer === first.referenznummer;
    const detailsPath = `/jobboerse/jobsuche-service/pc/v4/jobdetails/${encodeURIComponent(encodeRefnr(first.referenznummer))}`;
    const cors = await fetch(`${relay}${detailsPath}`, { headers: { Origin: origin } });
    checks.corsForSite = cors.headers.get('Access-Control-Allow-Origin') === origin;
    const other = await fetch(`${relay}${detailsPath}`, { headers: { Origin: 'https://example.com' } });
    checks.noCorsForOthers = other.headers.get('Access-Control-Allow-Origin') === null;
    checks.cached = /max-age=\d+/.test(cors.headers.get('Cache-Control') ?? '');
  }
  checks.otherPathsBlocked = (await fetch(`${relay}/jobboerse/jobsuche-service/pc/v6/other`)).status === 404;
  checks.postBlocked = (await fetch(`${relay}/jobboerse/jobsuche-service/pc/v6/jobs`, { method: 'POST' })).status === 405;
} catch (err) {
  facts.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
const ok = Object.keys(checks).length >= 7 && Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checkedAt: new Date().toISOString(), seconds: (Date.now() - started) / 1000, checks, ...facts }, null, 2));
process.exit(ok ? 0 : 1);
