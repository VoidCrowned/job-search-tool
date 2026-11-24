// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate } from './router.ts';

afterEach(() => vi.unstubAllGlobals());

describe('navigate', () => {
  it('changes the URL and starts the new page at the top', () => {
    const scroll = vi.fn();
    vi.stubGlobal('scrollTo', scroll);
    window.history.replaceState(null, '', '/?was=x');
    navigate('/job/10001-1-S');
    expect(window.location.pathname).toBe('/job/10001-1-S');
    expect(scroll).toHaveBeenCalledWith(0, 0);
  });

  it('does nothing when already on that URL', () => {
    const scroll = vi.fn();
    vi.stubGlobal('scrollTo', scroll);
    window.history.replaceState(null, '', '/job/a');
    navigate('/job/a');
    expect(scroll).not.toHaveBeenCalled();
  });
});
