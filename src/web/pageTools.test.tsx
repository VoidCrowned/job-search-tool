// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App.tsx';
import { clearJobDetailsCache } from './jobDetails.ts';
import { SCROLL_THRESHOLD } from './PageTools.tsx';
import searchFixture from '../api/fixtures/search.json';
import detailsFixture from '../api/fixtures/details.json';

const [first, second] = searchFixture.ergebnisliste;

function routeFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.startsWith('/api/jobs?') ? searchFixture : detailsFixture;
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new Event('scroll'));
  });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/?was=Pflege&wo=Hamburg');
  scrollTo(0);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearJobDetailsCache();
});

describe('page tools', () => {
  it('shows nothing at the top with no card open', async () => {
    routeFetch();
    render(<App />);
    await screen.findByText(first.stellenangebotsTitel);
    expect(screen.queryByText(/Back to top/)).toBeNull();
    expect(screen.queryByText(/Collapse all/)).toBeNull();
  });

  it('shows "Back to top" after scrolling and scrolls up', async () => {
    routeFetch();
    const scroll = vi.fn();
    vi.stubGlobal('scrollTo', scroll);
    render(<App />);
    await screen.findByText(first.stellenangebotsTitel);
    scrollTo(SCROLL_THRESHOLD + 1);
    fireEvent.click(screen.getByText(/Back to top/));
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    scrollTo(0);
    expect(screen.queryByText(/Back to top/)).toBeNull();
  });

  it('"Collapse all" closes every open card', async () => {
    routeFetch();
    render(<App />);
    fireEvent.click(await screen.findByText(first.stellenangebotsTitel));
    fireEvent.click(screen.getByText(second.stellenangebotsTitel));
    fireEvent.click(screen.getByText('Collapse all (2)'));
    expect(screen.getByText(first.stellenangebotsTitel).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText(second.stellenangebotsTitel).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Collapse all/)).toBeNull();
  });
});
