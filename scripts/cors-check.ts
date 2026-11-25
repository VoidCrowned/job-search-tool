// Checks that a browser may call OpenRouter and Anthropic the way the online version does: builds the real
// request with the SDK (fake key, nothing is sent to the API), then asks each provider's CORS preflight
// whether every header is allowed. No key needed, no cost. Prints JSON; exit code 1 if a check fails.
// Usage: npm run cors:check [-- <site origin>]
import { createClaudeGenerator, createClient, DEFAULT_MODEL, DEFAULT_OPENROUTER_MODEL, type AiConfig } from '../src/shared/letter/claude.ts';
import { emptyProfile } from '../src/shared/profile.ts';
import type { JobDetails } from '../src/api/types.ts';
import job from '../src/api/fixtures/details.json' with { type: 'json' };

const origin = process.argv[2] ?? 'https://voidcrowned.github.io';
/** Browsers set these themselves (or allow them without asking), so a preflight never lists them. */
const NOT_PREFLIGHTED = new Set(['accept', 'user-agent', 'content-length']);

async function requestOf(config: AiConfig): Promise<{ url: string; headers: string[] }> {
  let captured: { url: string; headers: string[] } | undefined;
  const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
    captured = { url: String(url), headers: [...new Headers(init?.headers).keys()] };
    const answer = JSON.stringify({ letter: 'x'.repeat(200), adKeywords: [], missing: [] });
    return new Response(
      JSON.stringify({ id: 'x', type: 'message', role: 'assistant', model: config.model, content: [{ type: 'text', text: answer }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  await createClaudeGenerator(config, createClient(config, fakeFetch))({ profile: emptyProfile(), job: job as JobDetails, language: 'de' });
  return captured!;
}

async function check(name: string, config: AiConfig) {
  const { url, headers } = await requestOf(config);
  const needed = headers.filter((h) => !NOT_PREFLIGHTED.has(h));
  const res = await fetch(url, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': needed.join(',') },
  });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  const allowed = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase().split(',').map((h) => h.trim());
  const blocked = allowed.includes('*') ? [] : needed.filter((h) => !allowed.includes(h));
  return {
    name,
    ok: res.ok && (allowOrigin === '*' || allowOrigin === origin) && blocked.length === 0,
    url,
    status: res.status,
    allowOrigin,
    blocked,
  };
}

const results = [];
try {
  results.push(await check('openrouter', { provider: 'openrouter', apiKey: 'sk-or-fake', model: DEFAULT_OPENROUTER_MODEL, browser: true }));
  results.push(await check('anthropic', { provider: 'anthropic', apiKey: 'sk-ant-fake', model: DEFAULT_MODEL, browser: true }));
} catch (err) {
  results.push({ name: 'error', ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
}
const ok = results.length === 2 && results.every((r) => r.ok);
console.log(JSON.stringify({ ok, checkedAt: new Date().toISOString(), origin, results }, null, 2));
process.exit(ok ? 0 : 1);
