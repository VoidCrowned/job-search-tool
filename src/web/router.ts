// Minimal router on top of the History API: no dependency needed for two pages.
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

const snapshot = () => window.location.pathname + window.location.search;

/** Current path + query, re-rendering on navigation. */
export function useLocation(): URL {
  const href = useSyncExternalStore(subscribe, snapshot);
  return new URL(href, window.location.origin);
}

export function navigate(to: string) {
  if (to === snapshot()) return;
  window.history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  // A new page starts at the top, like a normal page load. (Browser back/forward keep their own behaviour.)
  window.scrollTo(0, 0);
}

/** Click handler for internal links: lets ctrl/middle-click open new tabs as usual. */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(e.currentTarget.getAttribute('href') ?? '/');
}
