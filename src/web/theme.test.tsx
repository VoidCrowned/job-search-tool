// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App.tsx';
import { readFileSync } from 'node:fs';

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

function renderApp() {
  vi.stubGlobal('fetch', vi.fn());
  window.history.replaceState(null, '', '/');
  render(<App />);
}

const checked = () => screen.getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')?.getAttribute('aria-label');

describe('theme switch', () => {
  it('follows the system by default', () => {
    renderApp();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Light', 'Dark', 'System']);
    expect(checked()).toBe('System');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('applies and saves an explicit choice', () => {
    renderApp();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(checked()).toBe('Dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('jobsuche:theme')).toBe('dark');
  });

  it('going back to System removes the override', () => {
    localStorage.setItem('jobsuche:theme', 'light');
    renderApp();
    expect(checked()).toBe('Light');
    fireEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('jobsuche:theme')).toBeNull();
  });

  it('works with arrow keys, and only the chosen button is in the tab order', () => {
    renderApp();
    const system = screen.getByRole('radio', { name: 'System' });
    expect(system.tabIndex).toBe(0);
    expect(screen.getByRole('radio', { name: 'Light' }).tabIndex).toBe(-1);
    fireEvent.keyDown(system, { key: 'ArrowRight' });
    expect(checked()).toBe('Light');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Light' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(checked()).toBe('System');
  });

  it('index.html applies the saved theme before React starts (from a file, so the CSP needs no inline script)', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<script src="/theme-init.js"></script>');
    expect(html.indexOf('theme-init.js')).toBeLessThan(html.indexOf('<body>'));
    expect(/<script>/.test(html)).toBe(false);
    const script = readFileSync('public/theme-init.js', 'utf8');
    localStorage.setItem('jobsuche:theme', 'dark');
    new Function(script!)();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
