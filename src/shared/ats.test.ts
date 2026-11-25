import { describe, expect, it } from 'vitest';
import { checkAts, containsCompany, containsTerm } from './ats.ts';

const filler = (n: number) => Array.from({ length: n }, (_, i) => `wort${i}`).join(' ');
const byId = (checks: ReturnType<typeof checkAts>) => Object.fromEntries(checks.map((c) => [c.id, c]));

describe('containsTerm', () => {
  it('matches phrases, compounds and inflected words', () => {
    expect(containsTerm('Erfahrung in der Pflegeplanung', 'Pflege')).toBe(true);
    expect(containsTerm('Kenntnisse in SAP ABAP', 'SAP')).toBe(true);
    expect(containsTerm('mit agilen Methoden wie Scrum', 'agile Methoden')).toBe(true);
    expect(containsTerm('Ich habe Erfahrungen gesammelt', 'IT')).toBe(false);
    expect(containsTerm('Projektleitung', 'Qualitätsmanagement')).toBe(false);
  });
});

describe('containsCompany', () => {
  const drk = 'Deutsches Rotes Kreuz Landesverband Hamburg e.V.';
  it('accepts the full name, the name without legal form, and initials', () => {
    expect(containsCompany(`beim ${drk} bewerbe ich mich`, drk)).toBe(true);
    expect(containsCompany('DRK Landesverband Hamburg e.V.\nFrau Kalina', drk)).toBe(true);
    expect(containsCompany('beim DRK Landesverband Hamburg', drk)).toBe(true);
    expect(containsCompany('bei der AlsterHerz Pflege', 'AlsterHerz Pflege GmbH')).toBe(true);
    expect(containsCompany('Siemens', 'Siemens AG')).toBe(true);
    expect(containsCompany('Müller Bau', 'Müller Bau GmbH & Co. KG')).toBe(true);
  });
  it('rejects other companies and partial names', () => {
    expect(containsCompany('beim DRK Kreisverband Harburg', drk)).toBe(false);
    expect(containsCompany('in Hamburg', drk)).toBe(false);
    expect(containsCompany('bei der AlsterHerz Pflege', 'Asklepios Kliniken GmbH')).toBe(false);
  });
});

describe('checkAts', () => {
  const good = `Bewerbung als Pflegefachkraft bei Klinikum Nord\n\nSehr geehrte Damen und Herren,\n\n${filler(220)} Pflegeplanung Teamarbeit\n\nMit freundlichen Grüßen`;

  it('passes a clean letter', () => {
    const checks = checkAts(good, { jobTitle: 'Pflegefachkraft (m/w/d)', company: 'Klinikum Nord', keywords: ['Pflegeplanung', 'Teamarbeit', 'Schichtdienst'] });
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(byId(checks).keywords).toMatchObject({ found: 2, total: 3, missing: ['Schichtdienst'] });
  });

  it('flags length outside one page', () => {
    expect(byId(checkAts('zu kurz')).length).toMatchObject({ ok: false, words: 2 });
    expect(byId(checkAts(filler(600))).length.ok).toBe(false);
  });

  it('flags Markdown, tables and tabs', () => {
    expect(byId(checkAts(`${good}\n**fett**`)).plainText.ok).toBe(false);
    expect(byId(checkAts(`## Profil\n${good}`)).plainText.ok).toBe(false);
    expect(byId(checkAts(`${good}\n| a | b |`)).plainText.ok).toBe(false);
    expect(byId(checkAts(`${good}\tx`)).plainText.ok).toBe(false);
    expect(byId(checkAts(`${good}\n- normale Aufzählung`)).plainText.ok).toBe(true);
  });

  it('flags emoji and decorative symbols', () => {
    expect(byId(checkAts(`${good} 🚀`)).symbols.ok).toBe(false);
    expect(byId(checkAts(`${good}\n• Punkt`)).symbols.ok).toBe(false);
    expect(byId(checkAts(`${good} – Gedankenstrich € 3,50`)).symbols.ok).toBe(true);
  });

  it('counts placeholders left', () => {
    expect(byId(checkAts(`${good} [Dein Name] [Ort]`)).placeholders).toMatchObject({ ok: false, count: 2 });
  });

  it('checks company and title only when known, ignoring gender suffixes', () => {
    const ids = checkAts(good).map((c) => c.id);
    expect(ids).not.toContain('company');
    expect(ids).not.toContain('keywords');
    expect(byId(checkAts(good, { jobTitle: 'Altenpfleger (m/w/d)' })).jobTitle.ok).toBe(false);
    expect(byId(checkAts(good, { company: 'Asklepios' })).company.ok).toBe(false);
  });

  it('needs 60 % of the keywords', () => {
    expect(byId(checkAts(good, { keywords: ['Pflegeplanung', 'Excel', 'SAP'] })).keywords.ok).toBe(false);
  });
});
