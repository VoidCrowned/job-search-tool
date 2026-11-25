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

describe('base path (online version on GitHub Pages)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('prefixes real URLs and strips the prefix from app paths', async () => {
    vi.stubEnv('BASE_URL', '/job-search-tool/');
    vi.stubGlobal('scrollTo', vi.fn());
    vi.resetModules();
    const router = await import('./router.ts');
    expect(router.appHref('/profile')).toBe('/job-search-tool/profile');
    window.history.replaceState(null, '', '/job-search-tool/?was=x');
    router.navigate('/job/10001-1-S');
    expect(window.location.pathname).toBe('/job-search-tool/job/10001-1-S');

    const link = document.createElement('a');
    link.setAttribute('href', router.appHref('/profile?x=1#key'));
    let prevented = false;
    router.onLinkClick({ currentTarget: link, button: 0, defaultPrevented: false, preventDefault: () => (prevented = true) } as never);
    expect(prevented).toBe(true);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/job-search-tool/profile?x=1#key');
  });
});
