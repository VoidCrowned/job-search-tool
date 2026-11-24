import { SearchPage } from './SearchPage.tsx';
import { onLinkClick, useLocation } from './router.ts';

export function App() {
  const location = useLocation();

  return (
    <div className="page">
      <header className="site-header">
        <a href="/" onClick={onLinkClick} className="brand">
          Jobsuche
        </a>
      </header>
      <main>
        {location.pathname === '/' ? (
          <SearchPage search={location.search} />
        ) : (
          <p className="error">
            Page not found. <a href="/" onClick={onLinkClick}>Back to search</a>
          </p>
        )}
      </main>
      <footer className="site-footer">
        Data: <a href="https://www.arbeitsagentur.de/jobsuche/">Bundesagentur für Arbeit</a>
      </footer>
    </div>
  );
}
