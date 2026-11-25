import { describe, expect, it, vi } from 'vitest';
import type { JobDetails } from '../../api/types.ts';
import detailsFixture from '../../api/fixtures/details.json';
import { MAX_VERSIONS, type LetterFile } from '../letter.ts';
import { emptyProfile } from '../profile.ts';
import { addVersion, letterFileFor, writeLetter } from './service.ts';

const job = detailsFixture as JobDetails;
const profile = { ...emptyProfile(), name: 'Void Example' };

describe('writeLetter', () => {
  it('fills the template in the ad\'s language', async () => {
    const version = await writeLetter({ profile, job, language: 'auto', mode: 'template' });
    expect(version).toMatchObject({ source: 'template', language: 'de' });
    expect(version.text).toContain('Void Example');
  });

  it('writes with Claude, passing confirmed points and keeping only non-empty extras', async () => {
    const generator = vi.fn(async () => ({ letter: 'Brief', adKeywords: ['Pflege'], missing: [] }));
    const version = await writeLetter({ profile, job, language: 'en', mode: 'ai', generator, confirmed: ['Umzug'] });
    expect(version).toEqual({ source: 'claude', language: 'en', text: 'Brief', adKeywords: ['Pflege'], missing: undefined, confirmed: ['Umzug'] });
    expect(generator).toHaveBeenCalledWith({ profile, job, language: 'en', confirmed: ['Umzug'] });
  });

  it('refuses AI mode without a generator', async () => {
    await expect(writeLetter({ profile, job, language: 'de', mode: 'ai', generator: null })).rejects.toThrow();
  });
});

describe('letter files', () => {
  it('creates an empty file and refreshes title and company from the ad', () => {
    expect(letterFileFor('x123', undefined)).toEqual({ refnr: 'x123', jobTitle: '', versions: [] });
    expect(letterFileFor('x123', { refnr: 'x123', jobTitle: 'Old', versions: [] }, job)).toMatchObject({
      jobTitle: job.stellenangebotsTitel,
      company: job.firma,
    });
  });

  it('adds versions with id and time, keeping at most MAX_VERSIONS', () => {
    const file: LetterFile = { refnr: 'x123', jobTitle: '', versions: [] };
    for (let i = 0; i < MAX_VERSIONS + 2; i++) addVersion(file, { source: 'edit', language: 'de', text: `v${i}` });
    expect(file.versions).toHaveLength(MAX_VERSIONS);
    expect(file.versions[0].text).toBe('v2');
    const last = addVersion(file, { source: 'edit', language: 'de', text: 'last' }, new Date('2026-11-25T12:00:00Z'));
    expect(last).toMatchObject({ createdAt: '2026-11-25T12:00:00.000Z', text: 'last' });
    expect(last.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
