// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from './App.tsx';
import { clearJobDetailsCache } from './jobDetails.ts';
import { fakeApi } from './testing/fakeApi.ts';
import searchFixture from '../api/fixtures/search.json';

const [first, second] = searchFixture.ergebnisliste;

let scroll: ReturnType<typeof vi.fn>;

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/?was=Pflege&wo=Hamburg');
  setScrollY(0);
  scroll = vi.fn((_x: number, y: number) => setScrollY(y));
  vi.stubGlobal('scrollTo', scroll);
  fakeApi();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearJobDetailsCache();
  sessionStorage.clear();
});

const card = (title: string) => screen.getByText(title).closest('li')!;
const isOpen = (title: string) => screen.getByText(title).getAttribute('aria-expanded') === 'true';

async function openTwoCardsAndLeave() {
  render(<App />);
  fireEvent.click(await screen.findByText(first.stellenangebotsTitel));
  fireEvent.click(screen.getByText(second.stellenangebotsTitel));
  setScrollY(1234);
  fireEvent.click(await within(card(second.stellenangebotsTitel)).findByText('Open as page'));
  await screen.findByRole('heading', { level: 1 });
}

describe('returning to the results', () => {
  it('"Back to results" restores open cards and scroll position', async () => {
    await openTwoCardsAndLeave();
    expect(window.scrollY).toBe(0); // the job page starts at the top
    fireEvent.click(screen.getByText('← Back to results'));
    await screen.findByText(first.stellenangebotsTitel);
    expect(isOpen(first.stellenangebotsTitel)).toBe(true);
    expect(isOpen(second.stellenangebotsTitel)).toBe(true);
    expect(isOpen(searchFixture.ergebnisliste[2].stellenangebotsTitel)).toBe(false);
    await waitFor(() => expect(window.scrollY).toBe(1234));
  });

  it("the browser's Back button restores it too", async () => {
    await openTwoCardsAndLeave();
    act(() => {
      window.history.replaceState(null, '', '/?was=Pflege&wo=Hamburg');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByText(first.stellenangebotsTitel);
    expect(isOpen(first.stellenangebotsTitel)).toBe(true);
    await waitFor(() => expect(window.scrollY).toBe(1234));
  });

  it('restores only once: a later visit to the same search starts fresh', async () => {
    await openTwoCardsAndLeave();
    fireEvent.click(screen.getByText('← Back to results'));
    await screen.findByText(first.stellenangebotsTitel);
    cleanup();
    render(<App />);
    await screen.findByText(first.stellenangebotsTitel);
    expect(isOpen(first.stellenangebotsTitel)).toBe(false);
  });

  it('a different search does not inherit the view', async () => {
    await openTwoCardsAndLeave();
    act(() => {
      window.history.replaceState(null, '', '/?was=Koch');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByText(first.stellenangebotsTitel);
    expect(isOpen(first.stellenangebotsTitel)).toBe(false);
  });

  it('"Job search" in the header shows the same search with the same cards open, but at the top', async () => {
    await openTwoCardsAndLeave();
    fireEvent.click(screen.getByText('Profile'));
    await screen.findByRole('heading', { level: 1, name: 'My profile' });
    fireEvent.click(screen.getByText('Job search'));
    await screen.findByText(first.stellenangebotsTitel);
    expect(window.location.search).toBe('?was=Pflege&wo=Hamburg');
    expect(isOpen(first.stellenangebotsTitel)).toBe(true);
    expect(isOpen(second.stellenangebotsTitel)).toBe(true);
    expect(isOpen(searchFixture.ergebnisliste[2].stellenangebotsTitel)).toBe(false);
    expect(window.scrollY).toBe(0);
    expect(scroll).not.toHaveBeenCalledWith(0, 1234);
  });

  it('"Job search" on the search page itself scrolls to the top', async () => {
    render(<App />);
    await screen.findByText(first.stellenangebotsTitel);
    setScrollY(900);
    fireEvent.click(screen.getByText('Job search'));
    expect(window.scrollY).toBe(0);
    expect(window.location.search).toBe('?was=Pflege&wo=Hamburg');
  });
});
