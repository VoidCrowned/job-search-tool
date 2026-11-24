// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App.tsx';
import { emptyProfile, parseProfile } from '../shared/profile.ts';
import exampleProfile from '../../examples/profile.example.json';

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

  it('the example profile is valid and complete', () => {
    const { profile, errors } = parseProfile(exampleProfile);
    expect(errors).toEqual([]);
    expect(Object.values(profile).every((v) => v.trim() !== '')).toBe(true);
    expect(profile.email).toMatch(/@example\.org$/);
  });

  it('loads the example after confirming, without saving', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    render(<App />);
    await screen.findByLabelText('Full name');
    fireEvent.click(screen.getByText('Load example profile'));
    expect(confirm).toHaveBeenCalled(); // the form already had "Void" in it
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Alex Beispiel');
    expect(screen.getByText(/Example loaded/)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
  });

  it('keeps the form when the replace question is declined', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<App />);
    await screen.findByLabelText('Full name');
    fireEvent.click(screen.getByText('Load example profile'));
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Void');
  });

  it('does not ask when the form is empty', async () => {
    stored = emptyProfile();
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    render(<App />);
    await screen.findByLabelText('Full name');
    fireEvent.click(screen.getByText('Load example profile'));
    expect(confirm).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Town') as HTMLInputElement).value).toBe('Hamburg');
  });
});
