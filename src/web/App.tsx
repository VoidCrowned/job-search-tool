import { I18nProvider, LanguageSelect, useT } from './i18n/index.tsx';
import { JobPage } from './JobPage.tsx';
import { ProfilePage } from './ProfilePage.tsx';
import { AboutPage } from './AboutPage.tsx';
import { isHosted } from './backend/index.ts';
import { lastSearchHref } from './lastSearch.ts';
import { SearchPage } from './SearchPage.tsx';
import { ThemeSelect } from './theme.tsx';
import { appHref, onLinkClick, useLocation } from './router.ts';

function Route({ pathname, search }: { pathname: string; search: string }) {
  const t = useT();
  if (pathname === '/') return <SearchPage search={search} />;
  if (pathname === '/profile') return <ProfilePage />;
  if (pathname === '/about' && isHosted) return <AboutPage />;
  const job = /^\/job\/([^/]+)$/.exec(pathname);
  if (job) {
    const refnr = decodeURIComponent(job[1]);
    return <JobPage key={refnr} refnr={refnr} />;
  }
  return (
    <p className="error">
      {t.app.notFound}{' '}
      <a href={appHref('/')} onClick={onLinkClick}>
        {t.app.backToSearch}
      </a>
    </p>
  );
}

function Shell() {
  const t = useT();
  const location = useLocation();
  const onProfile = location.pathname === '/profile';
  // "Job search" goes back to the last search of this tab, not to an empty one.
  const searchHref = location.pathname === '/' ? `/${location.search}` : lastSearchHref();

  return (
    <div className="page">
      <header className="site-header">
        {/* Pages on the left, settings (language, theme) on the right. */}
        <nav className="site-nav" aria-label={t.app.navigation}>
          <a href={appHref(searchHref)} onClick={onLinkClick} className="nav-link" aria-current={onProfile ? undefined : 'page'}>
            {t.app.jobSearch}
          </a>
          <span className="nav-separator" aria-hidden="true">
            |
          </span>
          <a href={appHref('/profile')} onClick={onLinkClick} className="nav-link" aria-current={onProfile ? 'page' : undefined}>
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
        {isHosted && (
          <>
            {' · '}
            {t.app.staysInBrowser}{' '}
            <a href={appHref('/about')} onClick={onLinkClick}>
              {t.app.privacy}
            </a>
          </>
        )}
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
