// Live check of Claude letter writing. Costs one letter (about 8 cents), so it only runs with --ai.
// Usage: npm run letter:check -- --ai      Prints one JSON object; exit code 1 if a check fails.
import { existsSync } from 'node:fs';
import { aiConfigFromEnv, createClaudeGenerator } from '../src/server/letter/claude.ts';
import { containsCompany } from '../src/shared/ats.ts';
import { parseProfile } from '../src/shared/profile.ts';
import exampleProfile from '../examples/profile.example.json' with { type: 'json' };
import type { JobDetails } from '../src/api/types.ts';
import job from '../src/api/fixtures/details.json' with { type: 'json' };

if (existsSync('.env')) process.loadEnvFile('.env');

function done(result: object, ok: boolean): never {
  console.log(JSON.stringify({ ok, checkedAt: new Date().toISOString(), ...result }, null, 2));
  process.exit(ok ? 0 : 1);
}

if (!process.argv.includes('--ai')) done({ error: 'This check calls Claude and costs about 8 cents. Run it with: npm run letter:check -- --ai' }, false);
const config = aiConfigFromEnv();
if (!config.apiKey) done({ error: 'No ANTHROPIC_API_KEY or OPENROUTER_API_KEY found (environment or .env).' }, false);

// The fictional example profile: no real personal data is sent.
const profile = parseProfile(exampleProfile).profile;

const started = Date.now();
try {
  const result = await createClaudeGenerator(config)({ profile, job: job as JobDetails, language: 'de' });
  const checks = {
    hasLetter: result.letter.length > 300,
    namesCompany: containsCompany(result.letter, (job as JobDetails).firma ?? '__'),
    namesReference: result.letter.includes(job.referenznummer),
    usesCandidateName: result.letter.includes(profile.name),
    germanGreeting: /Sehr geehrte/.test(result.letter),
    noPromptLeak: !/<\/?(job_ad|candidate_profile)>/.test(result.letter),
    keywords: result.adKeywords.length >= 3,
  };
  const usage = result.usage ?? { inputTokens: 0, outputTokens: 0 };
  done(
    {
      provider: config.provider,
      model: result.model,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      usage,
      // Anthropic's Opus 5.5 prices ($4 / $20 per million tokens); OpenRouter's own prices may differ slightly.
      estimatedCostUsd: Math.round(((usage.inputTokens * 4 + usage.outputTokens * 20) / 1e6) * 1000) / 1000,
      checks,
      adKeywords: result.adKeywords,
      letterPreview: result.letter.slice(0, 400),
    },
    Object.values(checks).every(Boolean),
  );
} catch (err) {
  done({ provider: config.provider, model: config.model, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }, false);
}
