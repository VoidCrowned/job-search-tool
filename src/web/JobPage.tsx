import { useEffect } from 'react';
import { jobPageUrl } from '../api/client.ts';
import { errorText } from './api.ts';
import { useT } from './i18n/index.tsx';
import { JobDetailsView } from './JobDetailsView.tsx';
import { useJobDetails } from './jobDetails.ts';
import { lastSearchHref } from './lastSearch.ts';
import { onLinkClick } from './router.ts';

export function JobPage({ refnr }: { refnr: string }) {
  const t = useT();
  const result = useJobDetails(refnr);
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
      {result.state === 'done' && <JobDetailsView job={result.data} />}
    </article>
  );
}
