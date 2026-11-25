// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('/api/jobs?was=Pflege&wo=Hamburg&zeitarbeit=false');
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

  it('applies filters instantly and keeps the typed text', async () => {
    window.history.replaceState(null, '', '/?was=Pflege');
    const fetch = mockFetch(searchFixture);
    render(<App />);
    await screen.findByText(/3,842 jobs/);
    fireEvent.change(screen.getByPlaceholderText('Job title, keyword'), { target: { value: 'Koch' } });
    expect(window.location.search).toBe('?was=Pflege');
    const partTime = screen.getByLabelText('Part-time');
    partTime.focus();
    fireEvent.click(partTime);
    expect(window.location.search).toBe('?was=Koch&arbeitszeit=tz');
    expect(document.activeElement).toBe(partTime);
    expect(screen.getByText('Filters').closest('details')?.open).toBe(true);
    fireEvent.click(partTime);
    expect(window.location.search).toBe('?was=Koch');
    expect(screen.getByText('Filters').closest('details')?.open).toBe(true);
    fireEvent.change(screen.getByLabelText('Radius'), { target: { value: '10' } });
    expect(window.location.search).toBe('?was=Koch&umkreis=10');
    await screen.findByText(/3,842 jobs/);
    expect((fetch.mock.calls.at(-1) as unknown as [string])[0]).toBe('/api/jobs?was=Koch&umkreis=10&zeitarbeit=false');
  });

  it('leaves temp agency jobs out unless the box is ticked', async () => {
    window.history.replaceState(null, '', '/?was=Pflege');
    const fetch = mockFetch(searchFixture);
    render(<App />);
    await screen.findByText(/3,842 jobs/);
    const box = screen.getByLabelText('Include temporary agency jobs') as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText('Filters').closest('details')?.open).toBe(false);
    fireEvent.click(box);
    expect(window.location.search).toBe('?was=Pflege&zeitarbeit=true');
    await screen.findByText(/3,842 jobs/);
    expect((fetch.mock.calls.at(-1) as unknown as [string])[0]).toBe('/api/jobs?was=Pflege&zeitarbeit=true');
    fireEvent.click(box);
    expect(window.location.search).toBe('?was=Pflege');
  });

  it('still understands old links with zeitarbeit=false', async () => {
    window.history.replaceState(null, '', '/?was=Pflege&zeitarbeit=false');
    const fetch = mockFetch(searchFixture);
    render(<App />);
    await screen.findByText(/3,842 jobs/);
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('/api/jobs?was=Pflege&zeitarbeit=false');
    expect((screen.getByLabelText('Include temporary agency jobs') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('Next →').getAttribute('href')).toBe('/?was=Pflege&page=2');
  });

  it('resets the form on Back', async () => {
    window.history.replaceState(null, '', '/?was=Pflege');
    mockFetch(searchFixture);
    render(<App />);
    fireEvent.click(screen.getByLabelText('Part-time'));
    expect(window.location.search).toBe('?was=Pflege&arbeitszeit=tz');
    await act(async () => {
      window.history.replaceState(null, '', '/?was=Pflege');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect((screen.getByLabelText('Part-time') as HTMLInputElement).checked).toBe(false);
  });

  it('shows placeholder cards while searching, then logos or letter tiles', async () => {
    window.history.replaceState(null, '', '/?was=Pflege');
    let answer: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))));
    render(<App />);
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Searching…');
    expect(status.querySelectorAll('.skeleton-card')).toHaveLength(5);
    await act(async () => answer(new Response(JSON.stringify(searchFixture), { headers: { 'Content-Type': 'application/json' } })));
    await screen.findByText(searchFixture.ergebnisliste[0].stellenangebotsTitel);
    expect(screen.queryByRole('status')).toBeNull();
    const cards = [...document.querySelectorAll('.job-card')];
    expect(cards).toHaveLength(searchFixture.ergebnisliste.length);
    searchFixture.ergebnisliste.forEach((job, i) => {
      const logo = cards[i].querySelector('.card-logo')!;
      if (job.arbeitgeberKundennummerHash) expect(logo.tagName).toBe('IMG');
      else expect(logo.textContent).toBe(job.firma.charAt(0).toUpperCase());
    });
    const img = cards.map((c) => c.querySelector('img.card-logo')).find(Boolean);
    if (img) {
      fireEvent.error(img);
      expect(img.isConnected).toBe(false);
    }
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
    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }));
    fireEvent.click(screen.getByRole('option', { name: 'Deutsch' }));
    expect(screen.getByText(/3\.842 Jobs bei Hamburg/)).toBeTruthy();
    expect(screen.getByText('Suchen')).toBeTruthy();
    expect(screen.getByText('Weiter →')).toBeTruthy();
    expect(document.documentElement.lang).toBe('de');
    expect(localStorage.getItem('jobsuche:lang')).toBe('de');
  });

  it('language list: flags with names, keyboard, Escape and click outside', () => {
    mockFetch(searchFixture);
    render(<App />);
    const button = screen.getByRole('button', { name: 'Language: English' });
    expect(button.querySelector('svg.flag')).toBeTruthy();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const list = screen.getByRole('listbox', { name: 'Language' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Deutsch', 'English', 'Español']);
    expect(within(list).getByRole('option', { name: 'English' }).getAttribute('aria-selected')).toBe('true');
    expect(within(list).getAllByRole('option').every((o) => o.querySelector('svg.flag'))).toBe(true);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Idioma: Español' })).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Idioma: Español' }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Idioma: Español' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
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
