import { useMemo, useState, type ReactNode } from 'react';
import { jobPageUrl } from '../api/client.ts';
import type { JobDetails } from '../api/types.ts';
import { formatContract, formatDate, formatOfferType, formatPay, workingTimes } from './format.ts';
import { useT } from './i18n/index.tsx';
import { renderMarkdown } from './markdown.ts';

function Logo({ hash, alt, small = false }: { hash: string; alt: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      className={small ? 'logo small' : 'logo'}
      src={`/api/logo/${encodeURIComponent(hash)}`}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The body of a job ad. `compact` is used inside a result card: the card already shows the title
 * and company, so only the logo, links, facts and description are rendered.
 */
export function JobDetailsView({
  job,
  compact = false,
  beforeDescription,
}: {
  job: JobDetails;
  compact?: boolean;
  /** Rendered between the facts and the (often long) description, e.g. the letter section. */
  beforeDescription?: ReactNode;
}) {
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
      {!compact && (
        <header className="job-header">
          {job.arbeitgeberKundennummerHash && <Logo hash={job.arbeitgeberKundennummerHash} alt={t.job.logoAlt(job.firma)} />}
          <div>
            <h1>{job.stellenangebotsTitel}</h1>
            {job.firma && <p className="company">{job.firma}</p>}
          </div>
        </header>
      )}

      <div className="actions">
        {compact && job.arbeitgeberKundennummerHash && (
          <Logo hash={job.arbeitgeberKundennummerHash} alt={t.job.logoAlt(job.firma)} small />
        )}
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

      {beforeDescription}

      {description ? (
        <section className="description" lang="de" dangerouslySetInnerHTML={{ __html: description }} />
      ) : (
        <p className="hint">{job.externeURL ? t.job.noDescriptionExternal : t.job.noDescription}</p>
      )}
    </>
  );
}
