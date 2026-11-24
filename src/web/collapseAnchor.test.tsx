// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App.tsx';
import { clearJobDetailsCache } from './jobDetails.ts';
import searchFixture from '../api/fixtures/search.json';
import detailsFixture from '../api/fixtures/details.json';

const [first, second] = searchFixture.ergebnisliste;
let scrollBy: ReturnType<typeof vi.fn>;

/** jsdom has no layout, so pretend the card's top edge is at `top` px relative to the screen. */
function placeCard(title: string, top: number, bottom = top + 500) {
  const li = screen.getByText(title).closest('li')!;
  li.getBoundingClientRect = () => ({ top, bottom }) as DOMRect;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/?was=Pflege&wo=Hamburg');
  scrollBy = vi.fn();
  vi.stubGlobal('scrollBy', scrollBy);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.startsWith('/api/jobs?') ? searchFixture : detailsFixture;
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearJobDetailsCache();
  sessionStorage.clear();
});

async function openBoth() {
  render(<App />);
  fireEvent.click(await screen.findByText(first.stellenangebotsTitel));
  fireEvent.click(screen.getByText(second.stellenangebotsTitel));
  await within(screen.getByText(second.stellenangebotsTitel).closest('li')!).findByText('Collapse');
}

describe('collapsing keeps the card in view', () => {
  it('scrolls the card back to the top of the screen when its top is above it', async () => {
    await openBoth();
    placeCard(second.stellenangebotsTitel, -800); // scrolled to the bottom of a long card
    fireEvent.click(within(screen.getByText(second.stellenangebotsTitel).closest('li')!).getByText('Collapse'));
    expect(scrollBy).toHaveBeenCalledWith(0, -812);
  });

  it('does not scroll when the card is already visible', async () => {
    await openBoth();
    placeCard(second.stellenangebotsTitel, 200);
    fireEvent.click(screen.getByText(second.stellenangebotsTitel));
    expect(screen.getByText(second.stellenangebotsTitel).getAttribute('aria-expanded')).toBe('false');
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('does not scroll when opening a card', async () => {
    render(<App />);
    fireEvent.click(await screen.findByText(first.stellenangebotsTitel));
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('"Collapse all" keeps the card at the top of the screen in place', async () => {
    await openBoth();
    placeCard(first.stellenangebotsTitel, -2000, -100); // fully above the screen
    placeCard(second.stellenangebotsTitel, -300, 900); // the one being read
    placeCard(searchFixture.ergebnisliste[2].stellenangebotsTitel, 900, 1000);
    fireEvent.click(screen.getByText('Collapse all (2)'));
    expect(scrollBy).toHaveBeenCalledWith(0, -312);
  });
});
