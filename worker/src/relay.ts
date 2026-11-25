// Job-search relay for the online version (#10). The Jobsuche API sends no CORS headers, so a browser can't
// call it directly. This relay forwards a few read-only paths unchanged, adds the API's public key header,
// and lets only the website's own origins read the answers. It holds no secrets and logs nothing.

export const UPSTREAM = 'https://rest.arbeitsagentur.de';
/** The Jobsuche API's public client key (documented in docs/API.md), not a secret. */
const API_KEY = 'jobboerse-jobsuche';
/** Answers are cached at the edge for this long: job ads change slowly, and it spares the upstream API. */
export const CACHE_SECONDS = 300;
const MAX_URL_LENGTH = 2000;

/** The only upstream paths the relay forwards. Paths mirror the upstream API, so the normal client works unchanged. */
const ALLOWED_PATHS = [
  /^\/jobboerse\/jobsuche-service\/pc\/v6\/jobs$/,
  /^\/jobboerse\/jobsuche-service\/pc\/v4\/jobdetails\/[A-Za-z0-9%_=.-]{4,300}$/,
  /^\/vermittlung\/ag-darstellung-service\/ct\/v1\/arbeitgeberlogo\/[A-Za-z0-9%_=.+-]{10,300}$/,
];

export interface RelayEnv {
  /** Comma-separated origins allowed to read answers, e.g. "https://voidcrowned.github.io,http://localhost:5173". */
  ALLOWED_ORIGINS?: string;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function corsHeaders(origin: string | null, env: RelayEnv): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, X-API-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const plain = (status: number, message: string, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', ...extra },
  });

export async function handleRelay(request: Request, env: RelayEnv, doFetch: Fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeaders(request.headers.get('Origin'), env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET' && request.method !== 'HEAD') return plain(405, 'Only GET is allowed.', { ...cors, Allow: 'GET, HEAD, OPTIONS' });
  if (url.pathname === '/' || url.pathname === '/health') return plain(200, 'ok', cors);
  if (request.url.length > MAX_URL_LENGTH) return plain(414, 'URL too long.', cors);
  if (!ALLOWED_PATHS.some((p) => p.test(url.pathname))) return plain(404, 'Not found.', cors);

  // Only the search takes a query string; details and logos must not carry one.
  const isSearch = url.pathname.endsWith('/pc/v6/jobs');
  const target = `${UPSTREAM}${url.pathname}${isSearch ? url.search : ''}`;

  let upstream: Response;
  try {
    upstream = await doFetch(target, {
      method: request.method,
      headers: { 'X-API-Key': API_KEY, Accept: request.headers.get('Accept') ?? 'application/json' },
      // Cloudflare's edge cache (ignored outside Workers).
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    } as RequestInit);
  } catch {
    return plain(502, 'The Jobsuche API could not be reached.', cors);
  }

  const headers = new Headers(cors);
  // No Content-Length/-Encoding: fetch has already decompressed the body, so the upstream's length would be wrong.
  for (const name of ['Content-Type', 'ETag', 'Last-Modified']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Cache-Control', upstream.ok ? `public, max-age=${CACHE_SECONDS}` : 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
}
