// Privacy (and, if configured, imprint) for the online version: what goes where.
import { useEffect } from 'react';
import { useT } from './i18n/index.tsx';

/** Imprint text, set at build time from the repository variable IMPRINT (see .github/workflows/deploy.yml). */
const IMPRINT = import.meta.env.VITE_IMPRINT?.trim();

export function AboutPage() {
  const t = useT();
  useEffect(() => {
    document.title = t.app.pageTitle(t.about.title);
  }, [t]);

  return (
    <article className="about-page">
      <h1>{t.about.title}</h1>
      <h2>{t.about.whereTitle}</h2>
      <ul>
        {t.about.where.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>{t.about.noTracking}</p>
      {IMPRINT && (
        <>
          <h2>{t.about.imprintTitle}</h2>
          <p className="imprint">{IMPRINT}</p>
        </>
      )}
    </article>
  );
}
