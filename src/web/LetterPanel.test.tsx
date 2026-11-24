// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App.tsx';
import { clearJobDetailsCache } from './jobDetails.ts';
import { fakeApi } from './testing/fakeApi.ts';
import { emptyProfile } from '../shared/profile.ts';
import type { LetterFile, LetterVersion } from '../shared/letter.ts';
import detailsFixture from '../api/fixtures/details.json';
import searchFixture from '../api/fixtures/search.json';

const ref = detailsFixture.referenznummer;
let file: LetterFile;
let profile = emptyProfile();

/** A tiny in-memory version of the server's letter routes. */
function letterServer() {
  return fakeApi({
    '/api/profile': () => profile,
    [`/api/letters/${ref}/generate`]: (_url, init) => {
      const { language } = JSON.parse(init!.body as string) as { language: string };
      const lang = language === 'en' ? 'en' : 'de';
      return add({ source: 'template', language: lang, text: `Template ${lang}\n[Dein Name]` });
    },
    [`/api/letters/${ref}/versions`]: (_url, init) => {
      const { text, language } = JSON.parse(init!.body as string) as { text: string; language: 'de' | 'en' };
      return add({ source: 'edit', language, text });
    },
    [`/api/letters/${ref}`]: () => file,
  });
}

function add(v: Omit<LetterVersion, 'id' | 'createdAt'>) {
  const version = { id: String(file.versions.length + 1), createdAt: '2026-11-24T12:00:00Z', ...v };
  file = { ...file, versions: [...file.versions, version] };
  return { file, version };
}

const panel = () => within(document.getElementById('letter')!);

beforeEach(() => {
  file = { refnr: ref, jobTitle: '', versions: [] };
  profile = emptyProfile();
  window.history.replaceState(null, '', `/job/${ref}`);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearJobDetailsCache();
  sessionStorage.clear();
});

describe('letter panel', () => {
  it('starts closed and opens on request', async () => {
    letterServer();
    render(<App />);
    const open = await screen.findByText('Write application');
    expect(screen.queryByText('Fill template')).toBeNull();
    fireEvent.click(open);
    expect(await panel().findByText('Fill template')).toBeTruthy();
    expect(panel().getByText(/Your profile is empty/)).toBeTruthy();
  });

  it('fills a template, shows placeholders left, saves edits and copies', async () => {
    letterServer();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    profile = { ...emptyProfile(), name: 'Void' };
    render(<App />);
    fireEvent.click(await screen.findByText('Write application'));
    fireEvent.change(await panel().findByLabelText('Letter language'), { target: { value: 'en' } });
    fireEvent.click(panel().getByText('Fill template'));
    const box = (await panel().findByLabelText('Letter text')) as HTMLTextAreaElement;
    expect(box.value).toBe('Template en\n[Dein Name]');
    expect(panel().getByText(/1 placeholder left/)).toBeTruthy();
    expect(panel().queryByText(/Your profile is empty/)).toBeNull();

    fireEvent.change(box, { target: { value: 'Final letter' } });
    expect(panel().getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(panel().getByText('Save changes'));
    expect(await panel().findByText('Saved.')).toBeTruthy();
    expect(file.versions.map((v) => v.source)).toEqual(['template', 'edit']);
    expect(file.versions[1]).toMatchObject({ text: 'Final letter', language: 'en' });

    fireEvent.click(panel().getByText('Copy'));
    expect(await panel().findByText('Copied.')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith('Final letter');
  });

  it('opens straight away with the latest saved letter', async () => {
    file = { refnr: ref, jobTitle: 'x', versions: [] };
    add({ source: 'template', language: 'de', text: 'Old' });
    add({ source: 'edit', language: 'de', text: 'Newest' });
    letterServer();
    render(<App />);
    expect(((await screen.findByLabelText('Letter text')) as HTMLTextAreaElement).value).toBe('Newest');
  });

  it('asks before replacing unsaved changes', async () => {
    add({ source: 'template', language: 'de', text: 'Saved text' });
    letterServer();
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    render(<App />);
    const box = (await screen.findByLabelText('Letter text')) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'My edits' } });
    fireEvent.click(panel().getByText('Fill template'));
    expect(confirm).toHaveBeenCalled();
    expect(box.value).toBe('My edits');
    expect(file.versions).toHaveLength(1);
  });

  it('shows server errors', async () => {
    fakeApi({ [`/api/letters/${ref}/generate`]: () => new Response(JSON.stringify({ error: 'x' }), { status: 502 }) });
    render(<App />);
    fireEvent.click(await screen.findByText('Write application'));
    fireEvent.click(await panel().findByText('Fill template'));
    expect(await panel().findByText(/not answering right now/)).toBeTruthy();
  });

  it('expanded cards link to the letter section', async () => {
    window.history.replaceState(null, '', '/?was=Pflege');
    letterServer();
    render(<App />);
    const first = searchFixture.ergebnisliste[0];
    fireEvent.click(await screen.findByText(first.stellenangebotsTitel));
    const link = await within(screen.getByText(first.stellenangebotsTitel).closest('li')!).findByText('Write application');
    expect(link.getAttribute('href')).toBe(`/job/${first.referenznummer}#letter`);
  });
});
