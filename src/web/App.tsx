import { I18nProvider, LanguageSelect, useT } from './i18n/index.tsx';
import { JobPage } from './JobPage.tsx';
import { ProfilePage } from './ProfilePage.tsx';
import { SearchPage } from './SearchPage.tsx';
import { ThemeSelect } from './theme.tsx';
import { onLinkClick, useLocation } from './router.ts';

function Route({ pathname, search }: { pathname: string; search: string }) {
  const t = useT();
  if (pathname === '/') return <SearchPage search={search} />;
  if (pathname === '/profile') return <ProfilePage />;
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
  const onProfile = location.pathname === '/profile';

  return (
    <div className="page">
      <header className="site-header">
        {/* Pages on the left, settings (language, theme) on the right. */}
        <nav className="site-nav" aria-label={t.app.navigation}>
          <a href="/" onClick={onLinkClick} className="nav-link" aria-current={onProfile ? undefined : 'page'}>
            {t.app.jobSearch}
          </a>
          <span className="nav-separator" aria-hidden="true">
            |
          </span>
          <a href="/profile" onClick={onLinkClick} className="nav-link" aria-current={onProfile ? 'page' : undefined}>
            {t.app.profile}
          </a>
        </nav>
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
