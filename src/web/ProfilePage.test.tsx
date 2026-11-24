// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App.tsx';
import { emptyProfile } from '../shared/profile.ts';

let stored = { ...emptyProfile(), name: 'Void', cv: 'Old CV' };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stored = { ...emptyProfile(), name: 'Void', cv: 'Old CV' };
  window.history.replaceState(null, '', '/profile');
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/profile' && init?.method === 'PUT') {
      stored = JSON.parse(init.body as string);
      return new Response(JSON.stringify(stored), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(stored), { headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('profile page', () => {
  it('loads the saved profile into the form', async () => {
    render(<App />);
    expect(((await screen.findByLabelText('Full name')) as HTMLInputElement).value).toBe('Void');
    expect((screen.getByLabelText('CV as text') as HTMLTextAreaElement).value).toBe('Old CV');
    expect(screen.getByRole('heading', { level: 1, name: 'My profile' })).toBeTruthy();
  });

  it('marks unsaved changes and saves them', async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Town'), { target: { value: 'Hamburg' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByText('Save profile'));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(JSON.parse((put![1] as RequestInit).body as string)).toMatchObject({ name: 'Void', city: 'Hamburg' });
  });

  it('shows save errors', async () => {
    render(<App />);
    await screen.findByLabelText('Full name');
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'Invalid profile.' }), { status: 400 }));
    fireEvent.click(screen.getByText('Save profile'));
    expect(await screen.findByText('Some values are invalid.')).toBeTruthy();
  });

  it('is reachable from the header', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    fireEvent.click(screen.getByText('Profile'));
    expect(window.location.pathname).toBe('/profile');
    expect(await screen.findByLabelText('Full name')).toBeTruthy();
  });
});
