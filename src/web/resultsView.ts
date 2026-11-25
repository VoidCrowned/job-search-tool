// Remembers how the results list looked (scroll position, open cards) when you left it,
// so coming back via "Back to results" or the browser's Back button shows it the same way.
const KEY = 'jobsuche:resultsView';

export interface ResultsView {
  query: string;
  scrollY: number;
  expanded: string[];
}

export function saveResultsView(view: ResultsView) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    // Storage unavailable: the list just starts at the top.
  }
}

/** The saved view for this query, if any. */
export function readResultsView(query: string): ResultsView | undefined {
  try {
    const raw = sessionStorage.getItem(KEY);
    const view = raw ? (JSON.parse(raw) as ResultsView) : undefined;
    if (view?.query === query && Array.isArray(view.expanded) && typeof view.scrollY === 'number') return view;
  } catch {
    // Unreadable: ignore.
  }
  return undefined;
}

/** Keeps the saved open cards but forgets the scroll position, so the list comes back at the top. */
export function resetResultsScroll() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) sessionStorage.setItem(KEY, JSON.stringify({ ...(JSON.parse(raw) as ResultsView), scrollY: 0 }));
  } catch {
    // Unreadable: the list just starts fresh.
  }
}

export function clearResultsView() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
