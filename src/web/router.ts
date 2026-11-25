// Minimal router on top of the History API: no dependency needed for two pages.
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

/**
 * Where the site lives: "" locally, "/job-search-tool" on GitHub Pages (Vite's `base`). App paths like
 * "/profile" stay the same everywhere; only real URLs carry the prefix.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** The real URL for an app path, for href attributes. */
export function appHref(path: string): string {
  return BASE + path;
}

/** The app path for a real URL path (the reverse of appHref). */
function appPath(pathname: string): string {
  return BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
}

const snapshot = () => appPath(window.location.pathname) + window.location.search;

/** Current path + query, re-rendering on navigation. */
export function useLocation(): URL {
  const href = useSyncExternalStore(subscribe, snapshot);
  return new URL(href, window.location.origin);
}

// The app restores the results list itself (see resultsView.ts), so the browser shouldn't also try.
if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual';

const beforeNavigate = new Set<() => void>();

/** Runs `fn` just before an in-app navigation, while the old page is still on screen. Returns an unsubscribe function. */
export function onBeforeNavigate(fn: () => void): () => void {
  beforeNavigate.add(fn);
  return () => beforeNavigate.delete(fn);
}

export function navigate(to: string) {
  if (to === snapshot()) return;
  for (const fn of beforeNavigate) fn();
  window.history.pushState(null, '', appHref(to));
  window.dispatchEvent(new PopStateEvent('popstate'));
  // A new page starts at the top, like a normal page load. (Browser back/forward keep their own behaviour.)
  window.scrollTo(0, 0);
}

/** Click handler for internal links: lets ctrl/middle-click open new tabs as usual. */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const url = new URL(e.currentTarget.getAttribute('href') ?? '/', window.location.href);
  navigate(appPath(url.pathname) + url.search + url.hash);
}
