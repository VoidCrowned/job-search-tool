// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App.tsx';
import { clearJobDetailsCache } from './jobDetails.ts';
import searchFixture from '../api/fixtures/search.json';
import detailsFixture from '../api/fixtures/details.json';

const [first, second] = searchFixture.ergebnisliste;

/** Search requests get the search fixture; details requests get the details fixture with the asked-for refnr. */
function routeFetch() {
  const fn = vi.fn(async (url: string) => {
    const body = url.startsWith('/api/jobs?')
      ? searchFixture
      : { ...detailsFixture, referenznummer: decodeURIComponent(url.split('/').pop()!) };
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const detailCalls = (fn: ReturnType<typeof routeFetch>) =>
  fn.mock.calls.filter(([url]) => /^\/api\/jobs\/[^?]/.test(url as string)).length;

function card(title: string) {
  return screen.getByText(title).closest('li')!;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/?was=Pflege&wo=Hamburg');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearJobDetailsCache();
  localStorage.clear();
});

describe('expanding cards', () => {
  it('opens the details below the title without leaving the results', async () => {
    routeFetch();
    render(<App />);
    fireEvent.click(await screen.findByText(first.stellenangebotsTitel));
    expect(window.location.pathname).toBe('/');
    const body = within(card(first.stellenangebotsTitel));
    expect(await body.findByText(/Gemeinsam die Pflege von morgen gestalten/)).toBeTruthy();
    expect(body.getByText('Permanent')).toBeTruthy();
    expect(screen.getByText(first.stellenangebotsTitel).getAttribute('aria-expanded')).toBe('true');
    // The card title is not repeated as a page heading.
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('keeps several cards open at once', async () => {
    routeFetch();
    render(<App />);
    fireEvent.click(await screen.findByText(first.stellenangebotsTitel));
    fireEvent.click(screen.getByText(second.stellenangebotsTitel));
    expect(await within(card(first.stellenangebotsTitel)).findByText('Open as page')).toBeTruthy();
    expect(await within(card(second.stellenangebotsTitel)).findByText('Open as page')).toBeTruthy();
  });

  it('collapses on a second click or via the Collapse button', async () => {
    routeFetch();
    render(<App />);
    const title = await screen.findByText(first.stellenangebotsTitel);
    fireEvent.click(title);
    fireEvent.click(title);
    expect(title.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(title);
    fireEvent.click(await within(card(first.stellenangebotsTitel)).findByText('Collapse'));
    expect(title.getAttribute('aria-expanded')).toBe('false');
  });

  it('loads details only once when reopening', async () => {
    const fetch = routeFetch();
    render(<App />);
    const title = await screen.findByText(first.stellenangebotsTitel);
    fireEvent.click(title);
    await within(card(first.stellenangebotsTitel)).findByText('Open as page');
    fireEvent.click(title);
    fireEvent.click(title);
    expect(within(card(first.stellenangebotsTitel)).getByText(/Gemeinsam die Pflege/)).toBeTruthy();
    expect(detailCalls(fetch)).toBe(1);
  });

  it('leaves ctrl-click to the browser (opens the page in a new tab)', async () => {
    routeFetch();
    render(<App />);
    const title = await screen.findByText(first.stellenangebotsTitel);
    const notPrevented = fireEvent.click(title, { ctrlKey: true });
    expect(notPrevented).toBe(true);
    expect(title.getAttribute('aria-expanded')).toBe('false');
  });

  it('"Open as page" shows the job page', async () => {
    routeFetch();
    render(<App />);
    fireEvent.click(await screen.findByText(first.stellenangebotsTitel));
    fireEvent.click(await within(card(first.stellenangebotsTitel)).findByText('Open as page'));
    expect(window.location.pathname).toBe(`/job/${first.referenznummer}`);
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
  });
});
