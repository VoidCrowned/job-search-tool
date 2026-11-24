// Remembers the last search (per tab) so "Back to results" works even after opening a job in a new tab.
const KEY = 'jobsuche:lastSearch';

export function rememberSearch(search: string) {
  try {
    sessionStorage.setItem(KEY, search);
  } catch {
    // Storage can be unavailable (private mode); the back link then goes to an empty search.
  }
}

export function lastSearchHref(): string {
  try {
    return `/${sessionStorage.getItem(KEY) ?? ''}`;
  } catch {
    return '/';
  }
}
