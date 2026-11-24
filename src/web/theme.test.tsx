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

describe('theme switch', () => {
  it('follows the system by default', () => {
    renderApp();
    expect((screen.getByLabelText('Theme') as HTMLSelectElement).value).toBe('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('applies and saves an explicit choice', () => {
    renderApp();
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('jobsuche:theme')).toBe('dark');
  });

  it('going back to System removes the override', () => {
    localStorage.setItem('jobsuche:theme', 'light');
    renderApp();
    expect((screen.getByLabelText('Theme') as HTMLSelectElement).value).toBe('light');
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'system' } });
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('jobsuche:theme')).toBeNull();
  });

  it('index.html applies the saved theme before React starts', () => {
    const html = readFileSync('index.html', 'utf8');
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(script).toBeTruthy();
    localStorage.setItem('jobsuche:theme', 'dark');
    new Function(script!)();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
