# job-search-tool

My local tool for searching job ads from the Bundesagentur für Arbeit (via the [Jobsuche API](https://github.com/bundesAPI/jobsuche-api)), and later for writing application texts.

## Run it

Needs Node 22 or newer.

```sh
npm install
npm run dev
```

Then open http://localhost:5173.

## Checks

- `npm test`: unit tests
- `npm run api:check`: live check against the Jobsuche API (prints JSON)
- `npm run lint`, `npm run build`

## Private data

Anything personal (profile, CV, API keys) stays in `.env` and `data/`, which are never committed.

## Licence

[WTFPL](LICENSE)
