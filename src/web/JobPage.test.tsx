// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from './App.tsx';
import { renderMarkdown } from './markdown.ts';
import detailsFixture from '../api/fixtures/details.json';

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('renderMarkdown', () => {
  it('renders headings and lists', () => {
    const html = renderMarkdown('## Aufgaben\n\n- eins\n- zwei');
    expect(html).toContain('<h2>Aufgaben</h2>');
    expect(html).toContain('<li>eins</li>');
  });

  it('removes scripts, event handlers and images', () => {
    const html = renderMarkdown('<script>alert(1)</script><a href="javascript:alert(1)" onclick="x()">a</a><img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/script|onclick|onerror|javascript:|<img/);
  });

  it('opens links in a new tab safely', () => {
    expect(renderMarkdown('[x](https://example.org)')).toContain('rel="noopener noreferrer"');
  });
});

describe('job page', () => {
  const ref = detailsFixture.referenznummer;

  it('shows title, company, facts, description and links', async () => {
    window.history.replaceState(null, '', `/job/${ref}`);
    const fetch = mockFetch(detailsFixture);
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: detailsFixture.stellenangebotsTitel })).toBeTruthy();
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe(`/api/jobs/${ref}`);
    expect(screen.getByText(detailsFixture.firma)).toBeTruthy();
    expect(screen.getByText('Permanent')).toBeTruthy();
    expect(screen.getByText('Possible, by arrangement')).toBeTruthy();
    expect(screen.getByText(/Gemeinsam die Pflege von morgen gestalten/)).toBeTruthy();
    expect(screen.getByText(/View on arbeitsagentur.de/).getAttribute('href')).toBe(`https://www.arbeitsagentur.de/jobsuche/jobdetail/${ref}`);
    expect(screen.getByRole('img').getAttribute('src')).toBe(`/api/logo/${encodeURIComponent(detailsFixture.arbeitgeberKundennummerHash)}`);
    expect(document.title).toBe(`${detailsFixture.stellenangebotsTitel} · Jobsuche`);
  });

  it('links back to the last search', async () => {
    sessionStorage.setItem('jobsuche:lastSearch', '?was=Pflege');
    window.history.replaceState(null, '', `/job/${ref}`);
    mockFetch(detailsFixture);
    render(<App />);
    expect(screen.getByText('← Back to results').getAttribute('href')).toBe('/?was=Pflege');
  });

  it('explains missing ads', async () => {
    window.history.replaceState(null, '', '/job/10001-1-S');
    mockFetch({ error: 'This job ad no longer exists.', code: 'STELLENANGEBOT_NICHT_GEFUNDEN' }, 404);
    render(<App />);
    expect(await screen.findByText(/This job ad no longer exists/)).toBeTruthy();
    expect(screen.getByText('Try it on arbeitsagentur.de')).toBeTruthy();
  });
});
