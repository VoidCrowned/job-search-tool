import { JobPage } from './JobPage.tsx';
import { SearchPage } from './SearchPage.tsx';
import { onLinkClick, useLocation } from './router.ts';

function route(pathname: string, search: string) {
  if (pathname === '/') return <SearchPage search={search} />;
  const job = /^\/job\/([^/]+)$/.exec(pathname);
  if (job) {
    const refnr = decodeURIComponent(job[1]);
    return <JobPage key={refnr} refnr={refnr} />;
  }
  return (
    <p className="error">
      Page not found. <a href="/" onClick={onLinkClick}>Back to search</a>
    </p>
  );
}

export function App() {
  const location = useLocation();

  return (
    <div className="page">
      <header className="site-header">
        <a href="/" onClick={onLinkClick} className="brand">
          Jobsuche
        </a>
      </header>
      <main>{route(location.pathname, location.search)}</main>
      <footer className="site-footer">
        Data: <a href="https://www.arbeitsagentur.de/jobsuche/">Bundesagentur für Arbeit</a>
      </footer>
    </div>
  );
}
