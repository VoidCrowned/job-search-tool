import { describe, expect, it } from 'vitest';
import { fillTemplate, splitList } from './template.ts';
import { detectLanguage } from './language.ts';
import { emptyProfile } from '../profile.ts';
import { PLACEHOLDER } from '../letter.ts';
import type { JobDetails } from '../../api/types.ts';
import detailsFixture from '../../api/fixtures/details.json';

const job = detailsFixture as JobDetails;
const today = new Date('2026-11-24T12:00:00');
const profile = {
  ...emptyProfile(),
  name: 'Void Example',
  street: 'Musterweg 1',
  postcode: '20095',
  city: 'Hamburg',
  email: 'void@example.org',
  phone: '040 123',
  skills: 'Pflegeplanung\nTeamleitung, Qualitätsmanagement',
};

describe('fillTemplate', () => {
  it('fills a German letter from profile and ad', () => {
    const text = fillTemplate(profile, job, 'de', today);
    expect(text).toContain('Void Example\nMusterweg 1\n20095 Hamburg\nvoid@example.org · 040 123');
    expect(text).toContain(`Bewerbung als ${job.stellenangebotsTitel} (Referenznummer ${job.referenznummer})`);
    expect(text).toContain('Hamburg, 24. November 2026');
    expect(text).toContain(`bei ${job.firma}`);
    expect(text).toContain('Pflegeplanung, Teamleitung und Qualitätsmanagement');
    expect(text).toContain('Mit freundlichen Grüßen\n\nVoid Example');
    // Only the parts a template can't know stay as placeholders.
    expect(text.match(PLACEHOLDER)).toHaveLength(2);
  });

  it('fills an English letter', () => {
    const text = fillTemplate(profile, job, 'en', today);
    expect(text).toContain('Application for');
    expect(text).toContain('Hamburg, 24 November 2026');
    expect(text).toContain('Dear Sir or Madam,');
  });

  it('marks everything missing from an empty profile as a placeholder', () => {
    const text = fillTemplate(emptyProfile(), job, 'de', today);
    for (const p of ['[Dein Name]', '[Straße und Hausnummer]', '[PLZ Ort]', '[E-Mail]', '[Telefon]', '[Ort]', '[Deine wichtigsten Kenntnisse für diese Stelle]']) {
      expect(text).toContain(p);
    }
  });

  it('uses a placeholder when the ad has no company', () => {
    expect(fillTemplate(profile, { ...job, firma: undefined }, 'de', today)).toContain('[Unternehmen]');
  });
});

describe('splitList', () => {
  it('splits on newlines, commas, semicolons and bullets', () => {
    expect(splitList('- a\n* b, c; • d\n\n')).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('detectLanguage', () => {
  it('detects German ads', () => {
    expect(detectLanguage(job.stellenangebotsTitel, job.stellenangebotsBeschreibung)).toBe('de');
  });
  it('detects English ads', () => {
    expect(
      detectLanguage('Senior Developer (m/f/d)', 'We are looking for a developer who will join our team. You have experience with the cloud and you are fluent in English.'),
    ).toBe('en');
  });
  it('defaults to German when unsure', () => {
    expect(detectLanguage('Koch', '')).toBe('de');
    expect(detectLanguage('Software Engineer', 'the team')).toBe('de');
  });
});
