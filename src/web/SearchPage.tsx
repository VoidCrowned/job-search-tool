import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
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
  type SearchParams,
} from '../api/params.ts';
import type { JobSearchItem, SearchResponse } from '../api/types.ts';
import { errorText, useJson } from './api.ts';
import { formatDate, formatNumber, formatPay, formatPlace } from './format.ts';
import { useT } from './i18n/index.tsx';
import { JobDetailsView } from './JobDetailsView.tsx';
import { useJobDetails } from './jobDetails.ts';
import { PageTools } from './PageTools.tsx';
import { rememberSearch } from './lastSearch.ts';
import { navigate, onLinkClick } from './router.ts';

function hasSearch(p: SearchParams) {
  return Boolean(p.was || p.wo || p.berufsfeld || p.arbeitgeber);
}

export function SearchPage({ search }: { search: string }) {
  const t = useT();
  const { params } = parseSearchParams(new URLSearchParams(search));
  const query = toAppQuery(params).toString();
  const result = useJson<SearchResponse>(hasSearch(params) ? `/api/jobs?${query}` : null);

  useEffect(() => {
    rememberSearch(query ? `?${query}` : '');
  }, [query]);

  useEffect(() => {
    document.title = t.app.pageTitle(t.search.queryTitle(params.was, params.wo));
  }, [t, params.was, params.wo]);

  return (
    <>
      {/* Keyed on the URL so the form resets on back/forward navigation. */}
      <SearchForm key={search} initial={params} />
      <section aria-live="polite" className="results">
        {result.state === 'idle' && <p className="hint">{t.search.idle}</p>}
        {result.state === 'loading' && <p className="hint">{t.search.loading}</p>}
        {result.state === 'error' && <p className="error">{errorText(result.error, t)}</p>}
        {/* Keyed on the query so expanded cards reset for a new search or page. */}
        {result.state === 'done' && <Results key={query} data={result.data} params={params} />}
      </section>
    </>
  );
}

function SearchForm({ initial }: { initial: SearchParams }) {
  const t = useT();
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

  const filtersActive = Boolean(
    initial.angebotsart || initial.arbeitszeit || initial.befristung || initial.veroeffentlichtseit !== undefined || initial.zeitarbeit === false,
  );

  return (
    <form className="search-form" onSubmit={submit} role="search">
      <div className="row main-row">
        <label>
          {t.search.what}
          <input
            type="search"
            value={draft.was ?? ''}
            onChange={(e) => set({ was: e.target.value || undefined })}
            placeholder={t.search.whatPlaceholder}
          />
        </label>
        <label>
          {t.search.where}
          <input value={draft.wo ?? ''} onChange={(e) => set({ wo: e.target.value || undefined })} placeholder={t.search.wherePlaceholder} />
        </label>
        <label className="narrow">
          {t.search.radius}
          <select
            value={draft.umkreis ?? ''}
            onChange={(e) => set({ umkreis: e.target.value === '' ? undefined : Number(e.target.value) })}
          >
            <option value="">{t.search.radiusDefault}</option>
            {UMKREIS_CHOICES.map((km) => (
              <option key={km} value={km}>
                {km === 0 ? t.search.radiusOnlyPlace : t.search.km(km)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary">
          {t.search.submit}
        </button>
      </div>

      <details className="filters" open={filtersActive}>
        <summary>{t.search.filters}</summary>
        <div className="row">
          <label>
            {t.search.type}
            <select
              value={draft.angebotsart ?? ''}
              onChange={(e) => set({ angebotsart: (e.target.value || undefined) as Angebotsart | undefined })}
            >
              <option value="">{t.search.any}</option>
              {ANGEBOTSART.map((value) => (
                <option key={value} value={value}>
                  {t.options.angebotsart[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.search.published}
            <select
              value={draft.veroeffentlichtseit ?? ''}
              onChange={(e) => set({ veroeffentlichtseit: e.target.value === '' ? undefined : Number(e.target.value) })}
            >
              <option value="">{t.search.anyTime}</option>
              {VEROEFFENTLICHTSEIT_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {t.search.publishedWithin[d]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>{t.search.workingTime}</legend>
          {ARBEITSZEIT.map((value) => (
            <label key={value} className="check">
              <input
                type="checkbox"
                checked={draft.arbeitszeit?.includes(value) ?? false}
                onChange={() => set({ arbeitszeit: toggle(draft.arbeitszeit, value) })}
              />
              {t.options.arbeitszeit[value]}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t.search.contract}</legend>
          {BEFRISTUNG.map((value) => (
            <label key={value} className="check">
              <input
                type="checkbox"
                checked={draft.befristung?.includes(value) ?? false}
                onChange={() => set({ befristung: toggle(draft.befristung, value) })}
              />
              {t.options.befristung[value]}
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.zeitarbeit !== false}
            onChange={(e) => set({ zeitarbeit: e.target.checked ? undefined : false })}
          />
          {t.search.includeTempAgencies}
        </label>
      </details>
    </form>
  );
}

function Results({ data, params }: { data: SearchResponse; params: SearchParams }) {
  const t = useT();
  const items = data.ergebnisliste ?? [];
  // Several cards can be open at once, so this is a set rather than a single id.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (refnr: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(refnr)) next.add(refnr);
      return next;
    });
  if (data.maxErgebnisse === 0 || items.length === 0) {
    return <p className="hint">{t.search.noResults}</p>;
  }
  const lastPage = Math.max(1, Math.min(Math.ceil(data.maxErgebnisse / params.size), Math.floor(MAX_RESULT_WINDOW / params.size)));
  const pageHref = (page: number) => `/?${toAppQuery({ ...params, page })}`;
  const from = (params.page - 1) * params.size + 1;

  return (
    <>
      <p className="count">
        {t.search.count(formatNumber(data.maxErgebnisse, t), data.woOutput?.bereinigterOrt, from, from + items.length - 1)}
      </p>
      <ol className="job-list">
        {items.map((job) => (
          <JobCard
            key={job.referenznummer}
            job={job}
            expanded={expanded.has(job.referenznummer)}
            onToggle={() => toggle(job.referenznummer)}
          />
        ))}
      </ol>
      <nav className="pager" aria-label={t.search.pages}>
        {params.page > 1 ? (
          <a href={pageHref(params.page - 1)} onClick={onLinkClick}>
            {t.search.previous}
          </a>
        ) : (
          <span />
        )}
        <span>{t.search.pageOf(formatNumber(params.page, t), formatNumber(lastPage, t))}</span>
        {params.page < lastPage ? (
          <a href={pageHref(params.page + 1)} onClick={onLinkClick}>
            {t.search.next}
          </a>
        ) : (
          <span />
        )}
      </nav>
      <PageTools expandedCount={expanded.size} onCollapseAll={() => setExpanded(new Set())} />
    </>
  );
}

function JobCard({ job, expanded, onToggle }: { job: JobSearchItem; expanded: boolean; onToggle: () => void }) {
  const t = useT();
  const place = formatPlace(job, t);
  const pay = formatPay(job, t);
  const published = formatDate(job.veroeffentlichungszeitraum?.von ?? job.datumErsteVeroeffentlichung, t);
  const href = `/job/${encodeURIComponent(job.referenznummer)}`;
  const bodyId = `job-${job.referenznummer}`;

  function onTitleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/Cmd/Shift/middle click keep the browser's default: open the job page in a new tab or window.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onToggle();
  }

  return (
    <li className={expanded ? 'job-card expanded' : 'job-card'}>
      <a className="job-title" href={href} onClick={onTitleClick} aria-expanded={expanded} aria-controls={bodyId}>
        {job.stellenangebotsTitel}
      </a>
      <div className="job-meta">
        {job.firma && <span className="company">{job.firma}</span>}
        {place && (
          <span>
            {place}
            {job.entfernung ? ` · ${t.search.km(job.entfernung)}` : ''}
          </span>
        )}
        {published && <span>{t.card.publishedOn(published)}</span>}
      </div>
      <div className="badges">
        {job.homeofficemoeglich && <span className="badge">{t.card.homeOffice}</span>}
        {pay && <span className="badge">{pay}</span>}
        {job.externeURL && <span className="badge muted">{t.card.externalAd}</span>}
      </div>
      {expanded && (
        <div className="job-body" id={bodyId}>
          <CardDetails refnr={job.referenznummer} />
          <div className="job-body-footer">
            <a href={href} onClick={onLinkClick}>
              {t.card.openAsPage}
            </a>
            <button type="button" className="link-button" onClick={onToggle}>
              {t.card.collapse}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function CardDetails({ refnr }: { refnr: string }) {
  const t = useT();
  const result = useJobDetails(refnr);
  if (result.state === 'error') return <p className="error">{errorText(result.error, t)}</p>;
  if (result.state !== 'done') return <p className="hint">{t.job.loading}</p>;
  return <JobDetailsView job={result.data} compact />;
}
