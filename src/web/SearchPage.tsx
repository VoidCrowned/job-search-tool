import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  ANGEBOTSART,
  ARBEITSZEIT,
  BEFRISTUNG,
  MAX_RESULT_WINDOW,
  parseSearchParams,
  toAppQuery,
  toSearchRequest,
  UMKREIS_CHOICES,
  withAppDefaults,
  VEROEFFENTLICHTSEIT_CHOICES,
  type Angebotsart,
  type SearchParams,
} from '../api/params.ts';
import type { JobSearchItem, SearchResponse } from '../api/types.ts';
import { errorText, useLoad } from './api.ts';
import { backend } from './backend/index.ts';
import { formatDate, formatNumber, formatPay, formatPlace } from './format.ts';
import { useT } from './i18n/index.tsx';
import { JobDetailsView } from './JobDetailsView.tsx';
import { LETTER_ANCHOR } from './LetterPanel.tsx';
import { useJobDetails } from './jobDetails.ts';
import { PageTools } from './PageTools.tsx';
import { rememberSearch } from './lastSearch.ts';
import { clearResultsView, readResultsView, saveResultsView } from './resultsView.ts';
import { appHref, navigate, onBeforeNavigate, onLinkClick } from './router.ts';

/** Space (px) kept above a card that is scrolled back into view after collapsing. */
const COLLAPSE_MARGIN = 12;
const cardId = (refnr: string) => `card-${refnr}`;

function hasSearch(p: SearchParams) {
  return Boolean(p.was || p.wo || p.berufsfeld || p.arbeitgeber);
}

export function SearchPage({ search }: { search: string }) {
  const t = useT();
  const params = withAppDefaults(parseSearchParams(new URLSearchParams(search)).params);
  const query = toAppQuery(params).toString();
  const request = toSearchRequest(params).toString();
  const result = useLoad<SearchResponse>(hasSearch(params) ? request : null, (signal) =>
    backend.searchJobs(new URLSearchParams(request), signal),
  );

  useEffect(() => {
    rememberSearch(query ? `?${query}` : '');
  }, [query]);

  useEffect(() => {
    document.title = t.app.pageTitle(t.search.queryTitle(params.was, params.wo));
  }, [t, params.was, params.wo]);

  return (
    <>
      <SearchForm search={search} initial={params} />
      <section aria-live="polite" className="results">
        {result.state === 'idle' && <p className="hint">{t.search.idle}</p>}
        {result.state === 'loading' && <p className="hint">{t.search.loading}</p>}
        {result.state === 'error' && <p className="error">{errorText(result.error, t)}</p>}
        {/* Keyed on the query so expanded cards reset for a new search or page. */}
        {result.state === 'done' && <Results key={query} query={query} data={result.data} params={params} />}
      </section>
    </>
  );
}

function hasFilters(p: SearchParams) {
  return Boolean(p.angebotsart || p.arbeitszeit || p.befristung || p.veroeffentlichtseit !== undefined || p.zeitarbeit === true);
}

function SearchForm({ search, initial }: { search: string; initial: SearchParams }) {
  const t = useT();
  const [draft, setDraft] = useState<SearchParams>(initial);
  const [filtersOpen, setFiltersOpen] = useState(() => hasFilters(initial));
  // A new URL (Back/Forward, a link, or our own search) resets the form to it. Not remounted, so focus stays put.
  const [shownSearch, setShownSearch] = useState(search);
  if (search !== shownSearch) {
    setShownSearch(search);
    setDraft(initial);
    if (hasFilters(initial)) setFiltersOpen(true);
  }

  const run = (p: SearchParams) => navigate(`/?${toAppQuery({ ...p, page: 1 })}`);
  /** Text fields: wait for Enter or the Search button. */
  const set = (patch: Partial<SearchParams>) => setDraft((d) => ({ ...d, ...patch }));
  /** Dropdowns and checkboxes: search straight away, with whatever is typed in the text fields. */
  const apply = (patch: Partial<SearchParams>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    run(next);
  };

  function toggle<T extends string>(list: T[] | undefined, value: T): T[] | undefined {
    const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];
    return next.length ? next : undefined;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    run(draft);
  }

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
            onChange={(e) => apply({ umkreis: e.target.value === '' ? undefined : Number(e.target.value) })}
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

      <details className="filters" open={filtersOpen} onToggle={(e) => setFiltersOpen(e.currentTarget.open)}>
        <summary>{t.search.filters}</summary>
        <div className="row">
          <label>
            {t.search.type}
            <select
              value={draft.angebotsart ?? ''}
              onChange={(e) => apply({ angebotsart: (e.target.value || undefined) as Angebotsart | undefined })}
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
              onChange={(e) => apply({ veroeffentlichtseit: e.target.value === '' ? undefined : Number(e.target.value) })}
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
                onChange={() => apply({ arbeitszeit: toggle(draft.arbeitszeit, value) })}
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
                onChange={() => apply({ befristung: toggle(draft.befristung, value) })}
              />
              {t.options.befristung[value]}
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.zeitarbeit === true}
            onChange={(e) => apply({ zeitarbeit: e.target.checked })}
          />
          {t.search.includeTempAgencies}
        </label>
      </details>
    </form>
  );
}

function Results({ query, data, params }: { query: string; data: SearchResponse; params: SearchParams }) {
  const t = useT();
  const items = data.ergebnisliste ?? [];
  // Coming back to this exact search: restore the cards that were open and the scroll position.
  const [restored] = useState(() => readResultsView(query));
  // Several cards can be open at once, so this is a set rather than a single id.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(restored?.expanded));
  const expandedRef = useRef(expanded);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useLayoutEffect(() => {
    if (!restored) return;
    window.scrollTo(0, restored.scrollY);
    clearResultsView();
  }, [restored]);

  useEffect(() => {
    // Save the view when leaving: in-app links (before the page changes) and the browser's Back/Forward.
    const save = () => saveResultsView({ query, scrollY: window.scrollY, expanded: [...expandedRef.current] });
    const unsubscribe = onBeforeNavigate(save);
    window.addEventListener('popstate', save);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', save);
    };
  }, [query]);

  // Collapsing makes the page shorter while the scroll offset stays, which would drop you far below
  // the card. So after a collapse, the "anchor" card is scrolled back to the top of the screen if needed.
  const anchorRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (!anchor) return;
    const top = anchor.getBoundingClientRect().top;
    if (top < COLLAPSE_MARGIN) window.scrollBy(0, top - COLLAPSE_MARGIN);
  }, [expanded]);

  const toggle = (refnr: string) => {
    if (expanded.has(refnr)) anchorRef.current = document.getElementById(cardId(refnr));
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(refnr)) next.add(refnr);
      return next;
    });
  };

  const collapseAll = () => {
    // Keep the card that is currently at the top of the screen in place.
    anchorRef.current =
      [...document.querySelectorAll<HTMLElement>('.job-card')].find((el) => el.getBoundingClientRect().bottom > 0) ?? null;
    setExpanded(new Set());
  };
  if (data.maxErgebnisse === 0 || items.length === 0) {
    return <p className="hint">{t.search.noResults}</p>;
  }
  const lastPage = Math.max(1, Math.min(Math.ceil(data.maxErgebnisse / params.size), Math.floor(MAX_RESULT_WINDOW / params.size)));
  const pageHref = (page: number) => appHref(`/?${toAppQuery({ ...params, page })}`);
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
      <PageTools expandedCount={expanded.size} onCollapseAll={collapseAll} />
    </>
  );
}

function JobCard({ job, expanded, onToggle }: { job: JobSearchItem; expanded: boolean; onToggle: () => void }) {
  const t = useT();
  const place = formatPlace(job, t);
  const pay = formatPay(job, t);
  const published = formatDate(job.veroeffentlichungszeitraum?.von ?? job.datumErsteVeroeffentlichung, t);
  const href = appHref(`/job/${encodeURIComponent(job.referenznummer)}`);
  const bodyId = `job-${job.referenznummer}`;

  function onTitleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/Cmd/Shift/middle click keep the browser's default: open the job page in a new tab or window.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onToggle();
  }

  return (
    <li className={expanded ? 'job-card expanded' : 'job-card'} id={cardId(job.referenznummer)}>
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
            <span className="footer-links">
              <a href={href} onClick={onLinkClick}>
                {t.card.openAsPage}
              </a>
              <a href={`${href}#${LETTER_ANCHOR}`} onClick={onLinkClick}>
                {t.card.writeApplication}
              </a>
            </span>
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
