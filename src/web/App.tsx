import { I18nProvider, LanguageSelect, useT } from './i18n/index.tsx';
import { JobPage } from './JobPage.tsx';
import { SearchPage } from './SearchPage.tsx';
import { ThemeSelect } from './theme.tsx';
import { onLinkClick, useLocation } from './router.ts';

function Route({ pathname, search }: { pathname: string; search: string }) {
  const t = useT();
  if (pathname === '/') return <SearchPage search={search} />;
  const job = /^\/job\/([^/]+)$/.exec(pathname);
  if (job) {
    const refnr = decodeURIComponent(job[1]);
    return <JobPage key={refnr} refnr={refnr} />;
  }
  return (
    <p className="error">
      {t.app.notFound}{' '}
      <a href="/" onClick={onLinkClick}>
        {t.app.backToSearch}
      </a>
    </p>
  );
}

function Shell() {
  const t = useT();
  const location = useLocation();

  return (
    <div className="page">
      <header className="site-header">
        <a href="/" onClick={onLinkClick} className="brand">
          {t.app.brand}
        </a>
        <div className="header-controls">
          <LanguageSelect />
          <ThemeSelect />
        </div>
      </header>
      <main>
        <Route pathname={location.pathname} search={location.search} />
      </main>
      <footer className="site-footer">
        {t.app.dataSource} <a href="https://www.arbeitsagentur.de/jobsuche/">Bundesagentur für Arbeit</a>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
