// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App.tsx';
import searchFixture from '../api/fixtures/search.json';

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('search page', () => {
  it('asks for input before searching', () => {
    const fetch = mockFetch(searchFixture);
    render(<App />);
    expect(screen.getByText(/Enter a job title or a place/)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows results from the URL query', async () => {
    window.history.replaceState(null, '', '/?was=Pflege&wo=Hamburg');
    const fetch = mockFetch(searchFixture);
    render(<App />);
    expect(await screen.findByText(searchFixture.ergebnisliste[0].stellenangebotsTitel)).toBeTruthy();
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('/api/jobs?was=Pflege&wo=Hamburg');
    expect(screen.getByText(/3,842 jobs near Hamburg/)).toBeTruthy();
    expect(screen.getByText('External ad')).toBeTruthy();
    const link = screen.getByText(searchFixture.ergebnisliste[0].stellenangebotsTitel).closest('a');
    expect(link?.getAttribute('href')).toBe('/job/10001-1003891045-S');
    expect(screen.getByText('Next →').getAttribute('href')).toBe('/?was=Pflege&wo=Hamburg&page=2');
  });

  it('puts the search into the URL on submit', async () => {
    mockFetch(searchFixture);
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Job title, keyword'), { target: { value: 'Koch' } });
    fireEvent.click(screen.getByLabelText('Part-time'));
    fireEvent.click(screen.getByText('Search'));
    expect(window.location.search).toBe('?was=Koch&arbeitszeit=tz');
    expect(await screen.findByText(searchFixture.ergebnisliste[0].stellenangebotsTitel)).toBeTruthy();
  });

  it('shows server errors', async () => {
    window.history.replaceState(null, '', '/?was=x');
    mockFetch({ error: 'The Jobsuche API could not be reached.' }, 502);
    render(<App />);
    expect(await screen.findByText(/The Jobsuche API is not answering right now/)).toBeTruthy();
  });

  it('switches the language and remembers it', async () => {
    window.history.replaceState(null, '', '/?was=Pflege&wo=Hamburg');
    mockFetch(searchFixture);
    render(<App />);
    await screen.findByText(/3,842 jobs/);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });
    expect(screen.getByText(/3\.842 Jobs bei Hamburg/)).toBeTruthy();
    expect(screen.getByText('Suchen')).toBeTruthy();
    expect(screen.getByText('Weiter →')).toBeTruthy();
    expect(document.documentElement.lang).toBe('de');
    expect(localStorage.getItem('jobsuche:lang')).toBe('de');
  });

  it('starts in the saved language', () => {
    localStorage.setItem('jobsuche:lang', 'es');
    mockFetch(searchFixture);
    render(<App />);
    expect(screen.getByText('Buscar')).toBeTruthy();
    expect(screen.getByText(/Introduce un puesto/)).toBeTruthy();
  });

  it('shows an empty state', async () => {
    window.history.replaceState(null, '', '/?was=zzzz');
    mockFetch({ ergebnisliste: [], maxErgebnisse: 0, page: 1, size: 25 });
    render(<App />);
    expect(await screen.findByText(/No jobs found/)).toBeTruthy();
  });
});
