import { useEffect, useMemo, useState } from 'react';
import { jobPageUrl } from '../api/client.ts';
import type { JobDetails } from '../api/types.ts';
import { errorText, useJson } from './api.ts';
import { formatContract, formatDate, formatOfferType, formatPay, workingTimes } from './format.ts';
import { useT } from './i18n/index.tsx';
import { lastSearchHref } from './lastSearch.ts';
import { renderMarkdown } from './markdown.ts';
import { onLinkClick } from './router.ts';

export function JobPage({ refnr }: { refnr: string }) {
  const t = useT();
  const result = useJson<JobDetails>(`/api/jobs/${encodeURIComponent(refnr)}`);
  const title = result.state === 'done' ? result.data.stellenangebotsTitel : undefined;

  useEffect(() => {
    document.title = t.app.pageTitle(title);
  }, [t, title]);

  return (
    <article className="job-page">
      <a href={lastSearchHref()} onClick={onLinkClick} className="back">
        {t.job.back}
      </a>
      {result.state === 'loading' && <p className="hint">{t.job.loading}</p>}
      {result.state === 'error' && (
        <p className="error">
          {errorText(result.error, t)}{' '}
          {result.error.status === 404 && (
            <a href={jobPageUrl(refnr)} target="_blank" rel="noopener noreferrer">
              {t.job.tryOriginal}
            </a>
          )}
        </p>
      )}
      {result.state === 'done' && <JobView job={result.data} />}
    </article>
  );
}

function Logo({ hash, alt }: { hash: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img className="logo" src={`/api/logo/${encodeURIComponent(hash)}`} alt={alt} onError={() => setFailed(true)} />;
}

function JobView({ job }: { job: JobDetails }) {
  const t = useT();
  const description = useMemo(
    () => (job.stellenangebotsBeschreibung ? renderMarkdown(job.stellenangebotsBeschreibung) : undefined),
    [job.stellenangebotsBeschreibung],
  );
  const places = (job.stellenlokationen ?? [])
    .map((l) =>
      [
        l.adresse?.strasse && `${l.adresse.strasse}${l.adresse.hausnummer ? ` ${l.adresse.hausnummer}` : ''}`,
        [l.adresse?.plz, l.adresse?.ort].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', '),
    )
    .filter(Boolean);
  const times = workingTimes(job, t);
  const startIso = job.eintrittszeitraum?.von;
  const start = formatDate(startIso, t);
  const homeOffice = job.homeofficemoeglich
    ? job.homeofficetyp === 'NACH_VEREINBARUNG'
      ? t.job.homeOfficeByArrangement
      : t.job.homeOfficePossible
    : undefined;
  const f = t.job.facts;
  const facts: [string, string | undefined][] = [
    [f.place, places.join(' · ') || undefined],
    [f.type, formatOfferType(job, t)],
    [f.workingTime, times.join(', ') || undefined],
    [f.contract, formatContract(job, t)],
    [f.start, start && (new Date(startIso!) <= new Date() ? t.job.asap : t.job.startFrom(start))],
    [f.pay, formatPay(job, t)],
    [f.homeOffice, homeOffice],
    [f.occupation, job.hauptberuf],
    [f.tempAgency, job.istArbeitnehmerUeberlassung ? t.job.tempAgencyYes : undefined],
    [f.published, formatDate(job.veroeffentlichungszeitraum?.von ?? job.datumErsteVeroeffentlichung, t)],
    [f.reference, job.referenznummer],
  ];
  let externalHost: string | undefined;
  try {
    externalHost = job.externeURL ? new URL(job.externeURL).hostname.replace(/^www\./, '') : undefined;
  } catch {
    externalHost = undefined;
  }

  return (
    <>
      <header className="job-header">
        {job.arbeitgeberKundennummerHash && <Logo hash={job.arbeitgeberKundennummerHash} alt={t.job.logoAlt(job.firma)} />}
        <div>
          <h1>{job.stellenangebotsTitel}</h1>
          {job.firma && <p className="company">{job.firma}</p>}
        </div>
      </header>

      <div className="actions">
        {job.externeURL && externalHost && (
          <a className="button primary" href={job.externeURL} target="_blank" rel="noopener noreferrer">
            {t.job.fullAdOn(externalHost)}
          </a>
        )}
        <a className={job.externeURL ? 'button' : 'button primary'} href={jobPageUrl(job.referenznummer)} target="_blank" rel="noopener noreferrer">
          {t.job.viewOriginal}
        </a>
      </div>

      <dl className="facts">
        {facts
          .filter((x): x is [string, string] => Boolean(x[1]))
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      {description ? (
        <section className="description" lang="de" dangerouslySetInnerHTML={{ __html: description }} />
      ) : (
        <p className="hint">{job.externeURL ? t.job.noDescriptionExternal : t.job.noDescription}</p>
      )}
    </>
  );
}
