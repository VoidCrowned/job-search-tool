# job-search-tool

My local tool for searching job ads from the Bundesagentur für Arbeit (via the [Jobsuche API](https://github.com/bundesAPI/jobsuche-api)) and writing application letters for them.

## Run it

Needs Node 22 or newer.

```sh
npm install
npm run dev
```

Then open http://localhost:5173.

## Application letters

1. Fill in **Profile** (top right): your details and your CV as plain text. **Load example profile** fills in a made-up person to try it out.
2. Open a job and use **Write application**.

Without an API key, you get a template filled from your profile. With a key from [Anthropic](https://platform.claude.com/settings/keys) or [OpenRouter](https://openrouter.ai/settings/keys), Claude writes the letter:

1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. In `.env`, remove the `#` in front of `ANTHROPIC_API_KEY=` (Anthropic key, `sk-ant-…`) or `OPENROUTER_API_KEY=` (OpenRouter key, `sk-or-…`) and paste your key after the `=`.
3. Restart `npm run dev`.

Each letter costs about 8 cents with the default model (Claude Opus 5.5). `npm run letter:check -- --ai` tests the setup with one fictional letter. Through OpenRouter, the automatic retry on another model after a refusal isn't available.

## Checks

- `npm test`: unit tests
- `npm run api:check`: live check against the Jobsuche API (prints JSON)
- `npm run lint`, `npm run build`

## Private data

Anything personal (profile, letters, API key) stays in `.env` and `data/`, which are never committed. The local server only answers requests from this computer.

## Licence

[WTFPL](LICENSE)
