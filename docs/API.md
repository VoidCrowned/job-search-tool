# Jobsuche API: how it actually behaves

Notes on the Bundesagentur für Arbeit Jobsuche API, checked against the live API on 24 November 2026. The [bundesAPI OpenAPI spec](https://github.com/bundesAPI/jobsuche-api) is partly out of date. Where the two differ, the live behaviour is what's written here.

`npm run api:check` re-tests the main points and prints JSON.

## Basics

| | |
|---|---|
| Base URL | `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service` |
| Auth | Header `X-API-Key: jobboerse-jobsuche` (public client ID; 403 without it) |
| CORS | No `Access-Control-Allow-Origin` header, so browsers can't call it directly. My local server proxies it. |
| Rate limits | None documented, none hit so far. Connections sometimes time out (`UND_ERR_CONNECT_TIMEOUT`), so my client retries once. |

## Endpoints

| Method | Path | Status |
|---|---|---|
| GET | `/pc/v6/jobs` | Search. Works. |
| GET | `/pc/v4/jobdetails/{base64(referenznummer)}` | Details. Works. |
| GET | `/pc/v3/jobdetails/…`, `/pc/v2/jobdetails/…` | 403 |
| GET | `https://rest.arbeitsagentur.de/vermittlung/ag-darstellung-service/ct/v1/arbeitgeberlogo/{hash}` | Employer logo (`image/webp`). 404 if the employer has none. Works without the key. |

The public page of a job ad is `https://www.arbeitsagentur.de/jobsuche/jobdetail/{referenznummer}`.

## Search parameters (`/pc/v6/jobs`)

| Parameter | Values | Notes |
|---|---|---|
| `was` | text | Job title / keywords |
| `wo` | text | Place or postcode |
| `umkreis` | km | Radius around `wo`. Default seems to be 25 (same count as `umkreis=25`). `0` = only that place. |
| `berufsfeld` | text | Occupational field, e.g. `Informatik` |
| `arbeitgeber` | text | Exact employer name |
| `angebotsart` | `1` job, `2` self-employment, `4` apprenticeship/dual study, `34` internship/trainee | |
| `arbeitszeit` | `vz` full-time, `tz` part-time, `snw` shifts/nights/weekends, `mj` mini-job | Several joined with `;`. **`ho` (home office) returns 0 results, so it's broken.** |
| `befristung` | `1` fixed-term, `2` permanent, `3` not stated | Several joined with `;` (`%3B` also works). `3` isn't in the spec. |
| `veroeffentlichtseit` | 0–100 | Days since publication |
| `zeitarbeit` | `true`/`false` | Include temp agencies |
| `pav` | `true`/`false` | Private recruitment agencies |
| `behinderung` | `true`/`false` | Ads aimed at people with disabilities |
| `quereinstieg` | `true`/`false` | Suitable for career changers. Not in the spec. |
| `eintrittsdatum` | facet key, e.g. `26_12_01-27_01_01` | Start-date range. ISO dates give 400. |
| `externestellenboersen` | `true`/`false` | Ads from external job boards |
| `page` | from 1 | `0` gives 400. Very high numbers (≥ 500) give 400 even when small enough. |
| `size` | results per page | Up to at least 500 works. My server caps it at 100. |

**Result window:** `page × size` must stay at or below 10,000, otherwise you get 400 `Ergebnismenge überschritten`.

Rejected: `homeoffice` (all values give 400) and `verguetung`, even though both appear as facets.

## Search response

```jsonc
{
  "ergebnisliste": [ /* items, see below; the spec wrongly calls this "stellenangebote" */ ],
  "maxErgebnisse": 3842,
  "page": 1,
  "size": 25,
  "woOutput": { "bereinigterOrt": "Hamburg", "suchmodus": "UMKREISSUCHE", "koordinaten": [{ "lat": 53.56, "lon": 9.99 }] },
  "facetten": { "arbeitszeit": { "counts": { "vz": 3233, "tz": 1287 }, "maxCount": 3842 } /* 21 facets */ }
}
```

Item fields (all optional except the first two):

- `referenznummer` (ID, e.g. `10001-1003891045-S`) and `stellenangebotsTitel`
- `firma`, `arbeitgeberKundennummerHash` (for the logo)
- `stellenlokationen[]`: `{ adresse: { strasse, hausnummer, plz, ort, region, land }, breite, laenge }`
- `entfernung` (km from `wo`)
- `stellenangebotsart`: `ARBEIT`, `AUSBILDUNG`, `PRAKTIKUM_TRAINEE`, `SELBSTAENDIGKEIT`
- `hauptberuf`, `alternativBeruf1/2`, `alleBerufe[]`, `weitereBerufe[]`
- Dates: `eintrittszeitraum.von`, `veroeffentlichungszeitraum.von`, `datumErsteVeroeffentlichung`, `aenderungsdatum`
- Working time flags: `arbeitszeitVollzeit`, `arbeitszeitTeilzeitVormittag/Nachmittag/Abend/Flexibel`, `arbeitszeitSchichtNachtWochenende`
- `homeofficemoeglich`, `homeofficetyp` (`NACH_VEREINBARUNG`)
- Pay: `verguetungsangabe` (`KEINE_ANGABEN`, `JAHRESGEHALT`, `STUNDENLOHN`), `artDerVerguetung` (`GEHALTSSPANNE`, `FESTGEHALT`), `gehaltsspanneVon/Bis`, `festgehalt`. The unit depends on `verguetungsangabe` (per year or per hour).
- `vertragsdauer` (`UNBEFRISTET`, `BEFRISTET`, `KEINE_ANGABE`), `befristetBis`
- `externeURL`: if set, the ad is hosted on another job board
- `quereinstiegGeeignet`, `istGeringfuegigeBeschaeftigung`, `chiffrenummer`

## Details response

Same fields as a search item, plus:

- `stellenangebotsBeschreibung`: the full description in **Markdown**
- `istBetreut`, `istBehinderungGefordert`, `istPrivateArbeitsvermittlung`, `istArbeitnehmerUeberlassung` (temp agency)
- `allianzpartnerName`, `allianzpartnerUrl`

The reference number is Base64-encoded (standard alphabet, with `=` padding), e.g. `10001-1002716922-S` → `MTAwMDEtMTAwMjcxNjkyMi1T`. The plain number gives 404.

## Errors

```jsonc
// 400 with invalid parameters
{ "messages": [{ "code": "EINGABEN_UNVOLLSTAENDIG_ODER_FEHLERHAFT", "path": "page", "detail": "Wert ungültig" }] }
// 400 when the result window is too big
{ "title": "Bad Request", "status": 400, "detail": "Ergebnismenge überschritten" }
// 404 job ad not found
{ "messages": [{ "code": "STELLENANGEBOT_NICHT_GEFUNDEN" }] }
```
