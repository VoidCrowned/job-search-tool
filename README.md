# job-search-tool

My tool for searching job ads from the Bundesagentur für Arbeit (via the [Jobsuche API](https://github.com/bundesAPI/jobsuche-api)) and writing application letters for them. It runs on your own computer, or online at https://voidcrowned.github.io/job-search-tool/.

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

1. Open **Profile** and scroll to **Claude API key**.
2. Paste your key (`sk-or-…` or `sk-ant-…`) and press **Save key**. It's saved in `.env` on this computer and works straight away.

You can also put it into `.env` yourself (see `.env.example`) and restart `npm run dev`.

Each letter costs about 8 cents with the default model (Claude Opus 5.5). `npm run letter:check -- --ai` tests the setup with one fictional letter. Through OpenRouter, the automatic retry on another model after a refusal isn't available.

## Online version

The online version is the same website, but everything personal stays in your browser: profile, letters and your API key (sent only to OpenRouter or Anthropic when Claude writes). Job searches go through a small relay on Cloudflare (`worker/`), because the Jobsuche API can't be called from a browser directly. Use **Profile → Backup → Export** to keep a copy of your data.

It is deployed by `.github/workflows/deploy.yml` on every push to `main`, once the repository variable `ONLINE` is `true` and the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set. The optional variable `IMPRINT` adds an imprint to the privacy page.

## Checks

- `npm test`: unit tests
- `npm run api:check`: live check against the Jobsuche API (prints JSON)
- `npm run relay:dev` and `npm run relay:check -- <relay URL>`: run the job-search relay for the online version locally, and check a relay live (prints JSON)
- `npm run lint`, `npm run build`

## Private data

Anything personal (profile, letters, API key) stays in `.env` and `data/`, which are never committed. The local server only answers requests from this computer.

## Licence

[WTFPL](LICENSE)
