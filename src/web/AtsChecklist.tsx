// ATS checklist under the letter editor. Recomputed on every edit, so fixes show up straight away.
import { useMemo } from 'react';
import { checkAts, type AtsCheck } from '../shared/ats.ts';
import { useT, type Messages } from './i18n/index.tsx';

function label(check: AtsCheck, t: Messages): string {
  switch (check.id) {
    case 'length':
      return t.ats.length(check.words ?? 0);
    case 'plainText':
      return t.ats.plainText;
    case 'symbols':
      return t.ats.symbols;
    case 'placeholders':
      return t.ats.placeholders(check.count ?? 0);
    case 'company':
      return t.ats.company;
    case 'jobTitle':
      return t.ats.jobTitle;
    case 'keywords':
      return t.ats.keywords(check.found ?? 0, check.total ?? 0);
  }
}

export function AtsChecklist({ text, jobTitle, company, keywords }: { text: string; jobTitle?: string; company?: string; keywords?: string[] }) {
  const t = useT();
  const checks = useMemo(() => checkAts(text, { jobTitle, company, keywords }), [text, jobTitle, company, keywords]);

  return (
    <section className="ats" aria-labelledby="ats-title">
      <h3 id="ats-title">{t.ats.title}</h3>
      <p className="hint">{t.ats.intro}</p>
      <ul>
        {checks.map((check) => (
          <li key={check.id} className={check.ok ? 'ats-ok' : 'ats-fix'} data-check={check.id}>
            <span className="ats-status">{check.ok ? t.ats.ok : t.ats.fix}</span>
            <span>
              {label(check, t)}
              {check.id === 'keywords' && check.missing?.length ? (
                <span className="hint"> · {t.ats.missing(check.missing.join(', '))}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {!keywords?.length && <p className="hint">{t.ats.noKeywords}</p>}
    </section>
  );
}
