// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App.tsx';
import { emptyProfile, parseProfile } from '../shared/profile.ts';
import exampleProfile from '../../examples/profile.example.json';

const saveButton = () => document.querySelector<HTMLButtonElement>('.profile-form .form-actions button')!;
/** The label a button shows (StableLabel keeps the others in the DOM, invisible, to fix the size). */
const visibleLabel = (el: Element) => el.querySelector('.stable-label > span:not(.stable-label-hidden)')?.textContent;

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

  it('shows "Saved" on the button until the form differs from the saved data', async () => {
    render(<App />);
    const town = (await screen.findByLabelText('Town')) as HTMLInputElement;
    expect(saveButton()).toMatchObject({ disabled: true });
    expect(visibleLabel(saveButton())).toBe('Saved');
    fireEvent.change(town, { target: { value: 'Hamburg' } });
    expect(saveButton()).toMatchObject({ disabled: false });
    expect(visibleLabel(saveButton())).toBe('Save profile');
    fireEvent.change(town, { target: { value: '' } });
    expect(visibleLabel(saveButton())).toBe('Saved');
    fireEvent.change(town, { target: { value: 'Hamburg' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(visibleLabel(saveButton())).toBe('Saved'));
    expect(saveButton().disabled).toBe(true);
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(JSON.parse((put![1] as RequestInit).body as string)).toMatchObject({ name: 'Void', city: 'Hamburg' });
  });

  it('shows save errors', async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Town'), { target: { value: 'Hamburg' } });
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'Invalid profile.' }), { status: 400 }));
    fireEvent.click(saveButton());
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

  it('saves and removes the API key, showing only its hint', async () => {
    let keyStatus: Record<string, unknown> = { set: false };
    const keyCalls: { method: string; body?: string }[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/settings/key') {
        const method = init?.method ?? 'GET';
        if (method !== 'GET') keyCalls.push({ method, body: init?.body as string | undefined });
        if (method === 'PUT') keyStatus = { set: true, provider: 'openrouter', hint: 'sk-or-…WXYZ' };
        if (method === 'DELETE') keyStatus = { set: false };
        return new Response(JSON.stringify(keyStatus), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(stored), { headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('confirm', () => true);
    render(<App />);
    const input = (await screen.findByLabelText('API key')) as HTMLInputElement;
    const keyButton = () => document.querySelector<HTMLButtonElement>('.key-actions button[type=submit]')!;
    await waitFor(() => expect(input.placeholder).toBe('sk-or-…'));
    expect(input.type).toBe('password');
    expect(keyButton().disabled).toBe(true);
    expect(visibleLabel(keyButton())).toBe('Save key');

    fireEvent.change(input, { target: { value: 'sk-or-v1-secret0123456789WXYZ' } });
    fireEvent.click(screen.getByLabelText('Show key'));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByLabelText('Hide key'));
    expect(input.type).toBe('password');
    fireEvent.click(keyButton());

    await waitFor(() => expect(input.placeholder).toBe('sk-or-…WXYZ'));
    expect(input.value).toBe('');
    expect(keyButton().disabled).toBe(true);
    expect(visibleLabel(keyButton())).toBe('Key set');
    expect(screen.queryByText(/Key set: OpenRouter/)).toBeNull();
    fireEvent.change(input, { target: { value: 'sk-or-v1-other' } });
    expect(visibleLabel(keyButton())).toBe('Save key');
    fireEvent.change(input, { target: { value: '' } });

    fireEvent.click(screen.getByText('Remove key'));
    expect(await screen.findByText('Key removed.')).toBeTruthy();
    expect(input.placeholder).toBe('sk-or-…');
    expect(keyCalls).toEqual([
      { method: 'PUT', body: JSON.stringify({ key: 'sk-or-v1-secret0123456789WXYZ' }) },
      { method: 'DELETE', body: undefined },
    ]);
  });

  it('shows the key section first, and asks for a restart when the server is outdated', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/settings/key'
        ? new Response(JSON.stringify({ error: 'Not found.' }), { status: 404 })
        : new Response(JSON.stringify(stored), { headers: { 'Content-Type': 'application/json' } }),
    );
    render(<App />);
    expect(await screen.findByText(/running older code.*start it again/)).toBeTruthy();
    expect(screen.queryByText(/job ad/)).toBeNull();
    await screen.findByDisplayValue('Void');
    const legends = [...document.querySelectorAll('legend')].map((l) => l.textContent);
    expect(legends).toEqual(['Claude API key', 'Personal details', 'What you are looking for', 'CV']);
    const save = screen.getByText('Save profile');
    expect(save.compareDocumentPosition(screen.getByLabelText('CV as text')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});
