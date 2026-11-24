import { useEffect, useMemo, useState } from 'react';
import { jobPageUrl } from '../api/client.ts';
import type { JobDetails } from '../api/types.ts';
import { useJson } from './api.ts';
import { formatContract, formatDate, formatOfferType, formatPay, workingTimes } from './format.ts';
import { renderMarkdown } from './markdown.ts';
import { lastSearchHref } from './lastSearch.ts';
import { onLinkClick } from './router.ts';

export function JobPage({ refnr }: { refnr: string }) {
  const result = useJson<JobDetails>(`/api/jobs/${encodeURIComponent(refnr)}`);

  return (
    <article className="job-page">
      <a href={lastSearchHref()} onClick={onLinkClick} className="back">
        ← Back to results
      </a>
      {result.state === 'loading' && <p className="hint">Loading job ad…</p>}
      {result.state === 'error' && (
        <p className="error">
          {result.error.message}{' '}
          {result.error.status === 404 && (
            <a href={jobPageUrl(refnr)} target="_blank" rel="noopener noreferrer">
              Try it on arbeitsagentur.de
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
  useEffect(() => {
    document.title = `${job.stellenangebotsTitel} · Jobsuche`;
  }, [job.stellenangebotsTitel]);
  const description = useMemo(
    () => (job.stellenangebotsBeschreibung ? renderMarkdown(job.stellenangebotsBeschreibung) : undefined),
    [job.stellenangebotsBeschreibung],
  );
  const places = (job.stellenlokationen ?? [])
    .map((l) => [l.adresse?.strasse && `${l.adresse.strasse}${l.adresse.hausnummer ? ` ${l.adresse.hausnummer}` : ''}`, [l.adresse?.plz, l.adresse?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '))
    .filter(Boolean);
  const times = workingTimes(job);
  const start = formatDate(job.eintrittszeitraum?.von);
  const facts: [string, string | undefined][] = [
    ['Place', places.join(' · ') || undefined],
    ['Type', formatOfferType(job)],
    ['Working time', times.join(', ') || undefined],
    ['Contract', formatContract(job)],
    ['Start', start && (new Date(job.eintrittszeitraum!.von!) <= new Date() ? 'As soon as possible' : `From ${start}`)],
    ['Pay', formatPay(job)],
    ['Home office', job.homeofficemoeglich ? (job.homeofficetyp === 'NACH_VEREINBARUNG' ? 'Possible, by arrangement' : 'Possible') : undefined],
    ['Occupation', job.hauptberuf],
    ['Temp agency', job.istArbeitnehmerUeberlassung ? 'Yes (temporary agency work)' : undefined],
    ['Published', formatDate(job.veroeffentlichungszeitraum?.von ?? job.datumErsteVeroeffentlichung)],
    ['Reference', job.referenznummer],
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
        {job.arbeitgeberKundennummerHash && <Logo hash={job.arbeitgeberKundennummerHash} alt={job.firma ? `${job.firma} logo` : 'Employer logo'} />}
        <div>
          <h1>{job.stellenangebotsTitel}</h1>
          {job.firma && <p className="company">{job.firma}</p>}
        </div>
      </header>

      <div className="actions">
        {job.externeURL && externalHost && (
          <a className="button primary" href={job.externeURL} target="_blank" rel="noopener noreferrer">
            Full ad on {externalHost} ↗
          </a>
        )}
        <a className={job.externeURL ? 'button' : 'button primary'} href={jobPageUrl(job.referenznummer)} target="_blank" rel="noopener noreferrer">
          View on arbeitsagentur.de ↗
        </a>
      </div>

      <dl className="facts">
        {facts
          .filter((f): f is [string, string] => Boolean(f[1]))
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      {description ? (
        <section className="description" dangerouslySetInnerHTML={{ __html: description }} />
      ) : (
        <p className="hint">This ad has no description here{job.externeURL ? '. Open the full ad above.' : '.'}</p>
      )}
    </>
  );
}
