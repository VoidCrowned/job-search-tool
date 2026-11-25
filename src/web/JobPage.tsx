import { useEffect } from 'react';
import { jobPageUrl } from '../api/client.ts';
import { errorText } from './api.ts';
import { TextSkeleton } from './Skeleton.tsx';
import { useT } from './i18n/index.tsx';
import { JobDetailsView } from './JobDetailsView.tsx';
import { useJobDetails } from './jobDetails.ts';
import { LetterPanel } from './LetterPanel.tsx';
import { lastSearchHref } from './lastSearch.ts';
import { appHref, onLinkClick } from './router.ts';

export function JobPage({ refnr }: { refnr: string }) {
  const t = useT();
  const result = useJobDetails(refnr);
  const title = result.state === 'done' ? result.data.stellenangebotsTitel : undefined;

  useEffect(() => {
    document.title = t.app.pageTitle(title);
  }, [t, title]);

  return (
    <article className="job-page">
      <a href={appHref(lastSearchHref())} onClick={onLinkClick} className="back">
        {t.job.back}
      </a>
      {result.state === 'loading' && <TextSkeleton label={t.job.loading} lines={10} />}
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
      {result.state === 'done' && <JobDetailsView job={result.data} beforeDescription={<LetterPanel refnr={refnr} />} />}
    </article>
  );
}
