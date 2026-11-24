import { useState, type FormEvent } from 'react';
import {
  ANGEBOTSART,
  ARBEITSZEIT,
  BEFRISTUNG,
  MAX_RESULT_WINDOW,
  parseSearchParams,
  toAppQuery,
  UMKREIS_CHOICES,
  VEROEFFENTLICHTSEIT_CHOICES,
  type Angebotsart,
  type Arbeitszeit,
  type Befristung,
  type SearchParams,
} from '../api/params.ts';
import type { JobSearchItem, SearchResponse } from '../api/types.ts';
import { useJson } from './api.ts';
import { formatDate, formatPay, formatPlace } from './format.ts';
import { navigate, onLinkClick } from './router.ts';

const PUBLISHED_LABELS: Record<number, string> = { 0: 'Today', 1: 'Since yesterday', 7: 'Last 7 days', 14: 'Last 14 days', 28: 'Last 28 days' };

function hasSearch(p: SearchParams) {
  return Boolean(p.was || p.wo || p.berufsfeld || p.arbeitgeber);
}

export function SearchPage({ search }: { search: string }) {
  const { params } = parseSearchParams(new URLSearchParams(search));
  const query = toAppQuery(params).toString();
  const result = useJson<SearchResponse>(hasSearch(params) ? `/api/jobs?${query}` : null);

  return (
    <>
      {/* Keyed on the URL so the form resets on back/forward navigation. */}
      <SearchForm key={search} initial={params} />
      <section aria-live="polite" className="results">
        {result.state === 'idle' && <p className="hint">Enter a job title or a place to start.</p>}
        {result.state === 'loading' && <p className="hint">Searching…</p>}
        {result.state === 'error' && <p className="error">{result.error.message}</p>}
        {result.state === 'done' && <Results data={result.data} params={params} />}
      </section>
    </>
  );
}

function SearchForm({ initial }: { initial: SearchParams }) {
  const [draft, setDraft] = useState<SearchParams>(initial);
  const set = (patch: Partial<SearchParams>) => setDraft((d) => ({ ...d, ...patch }));

  function toggle<T extends string>(list: T[] | undefined, value: T): T[] | undefined {
    const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];
    return next.length ? next : undefined;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    navigate(`/?${toAppQuery({ ...draft, page: 1 })}`);
  }

  return (
    <form className="search-form" onSubmit={submit} role="search">
      <div className="row main-row">
        <label>
          What
          <input
            type="search"
            value={draft.was ?? ''}
            onChange={(e) => set({ was: e.target.value || undefined })}
            placeholder="Job title, keyword"
          />
        </label>
        <label>
          Where
          <input value={draft.wo ?? ''} onChange={(e) => set({ wo: e.target.value || undefined })} placeholder="Town or postcode" />
        </label>
        <label className="narrow">
          Radius
          <select
            value={draft.umkreis ?? ''}
            onChange={(e) => set({ umkreis: e.target.value === '' ? undefined : Number(e.target.value) })}
          >
            <option value="">Default (25 km)</option>
            {UMKREIS_CHOICES.map((km) => (
              <option key={km} value={km}>
                {km === 0 ? 'Only this place' : `${km} km`}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary">
          Search
        </button>
      </div>

      <details className="filters" open={Boolean(initial.angebotsart || initial.arbeitszeit || initial.befristung || initial.veroeffentlichtseit !== undefined || initial.zeitarbeit === false)}>
        <summary>Filters</summary>
        <div className="row">
          <label>
            Type
            <select
              value={draft.angebotsart ?? ''}
              onChange={(e) => set({ angebotsart: (e.target.value || undefined) as Angebotsart | undefined })}
            >
              <option value="">Any</option>
              {Object.entries(ANGEBOTSART).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Published
            <select
              value={draft.veroeffentlichtseit ?? ''}
              onChange={(e) => set({ veroeffentlichtseit: e.target.value === '' ? undefined : Number(e.target.value) })}
            >
              <option value="">Any time</option>
              {VEROEFFENTLICHTSEIT_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {PUBLISHED_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Working time</legend>
          {Object.entries(ARBEITSZEIT).map(([value, label]) => (
            <label key={value} className="check">
              <input
                type="checkbox"
                checked={draft.arbeitszeit?.includes(value as Arbeitszeit) ?? false}
                onChange={() => set({ arbeitszeit: toggle(draft.arbeitszeit, value as Arbeitszeit) })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Contract</legend>
          {Object.entries(BEFRISTUNG).map(([value, label]) => (
            <label key={value} className="check">
              <input
                type="checkbox"
                checked={draft.befristung?.includes(value as Befristung) ?? false}
                onChange={() => set({ befristung: toggle(draft.befristung, value as Befristung) })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.zeitarbeit !== false}
            onChange={(e) => set({ zeitarbeit: e.target.checked ? undefined : false })}
          />
          Include temporary agency jobs
        </label>
      </details>
    </form>
  );
}

function Results({ data, params }: { data: SearchResponse; params: SearchParams }) {
  const items = data.ergebnisliste ?? [];
  if (data.maxErgebnisse === 0 || items.length === 0) {
    return <p className="hint">No jobs found. Try a wider radius or fewer filters.</p>;
  }
  const lastPage = Math.max(1, Math.min(Math.ceil(data.maxErgebnisse / params.size), Math.floor(MAX_RESULT_WINDOW / params.size)));
  const pageHref = (page: number) => `/?${toAppQuery({ ...params, page })}`;
  const from = (params.page - 1) * params.size + 1;

  const pager = (
    <nav className="pager" aria-label="Pages">
      {params.page > 1 ? (
        <a href={pageHref(params.page - 1)} onClick={onLinkClick}>
          ← Previous
        </a>
      ) : (
        <span />
      )}
      <span>
        Page {params.page} of {lastPage.toLocaleString('en-GB')}
      </span>
      {params.page < lastPage ? (
        <a href={pageHref(params.page + 1)} onClick={onLinkClick}>
          Next →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <>
      <p className="count">
        {data.maxErgebnisse.toLocaleString('en-GB')} jobs
        {data.woOutput?.bereinigterOrt ? ` near ${data.woOutput.bereinigterOrt}` : ''} · showing {from}–{from + items.length - 1}
      </p>
      <ol className="job-list">
        {items.map((job) => (
          <JobCard key={job.referenznummer} job={job} />
        ))}
      </ol>
      {pager}
    </>
  );
}

function JobCard({ job }: { job: JobSearchItem }) {
  const place = formatPlace(job);
  const pay = formatPay(job);
  const published = formatDate(job.veroeffentlichungszeitraum?.von ?? job.datumErsteVeroeffentlichung);
  return (
    <li className="job-card">
      <a className="job-title" href={`/job/${encodeURIComponent(job.referenznummer)}`} onClick={onLinkClick}>
        {job.stellenangebotsTitel}
      </a>
      <div className="job-meta">
        {job.firma && <span className="company">{job.firma}</span>}
        {place && (
          <span>
            {place}
            {job.entfernung ? ` · ${job.entfernung} km` : ''}
          </span>
        )}
        {published && <span>Published {published}</span>}
      </div>
      <div className="badges">
        {job.homeofficemoeglich && <span className="badge">Home office</span>}
        {pay && <span className="badge">{pay}</span>}
        {job.externeURL && <span className="badge muted">External ad</span>}
      </div>
    </li>
  );
}
