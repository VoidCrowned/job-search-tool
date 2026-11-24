import { describe, expect, it } from 'vitest';
import { formatContract, formatDate, formatOfferType, formatPay, formatPlace, workingTimes } from './format.ts';
import { en } from './i18n/en.ts';
import { de } from './i18n/de.ts';
import searchFixture from '../api/fixtures/search.json';
import type { JobSearchItem } from '../api/types.ts';

const items = searchFixture.ergebnisliste as JobSearchItem[];
const base = { referenznummer: 'x', stellenangebotsTitel: 'y' };

describe('format (English)', () => {
  it('formats dates in British style', () => {
    expect(formatDate('2026-11-24', en)).toBe('24 Nov 2026');
    expect(formatDate(undefined, en)).toBeUndefined();
    expect(formatDate('nonsense', en)).toBeUndefined();
  });

  it('formats places from fixtures', () => {
    expect(formatPlace(items[0], en)).toBe('20146 Hamburg');
    expect(formatPlace(base, en)).toBeUndefined();
  });

  it('counts extra locations', () => {
    const job = { ...base, stellenlokationen: [{ adresse: { ort: 'A' } }, { adresse: { ort: 'B' } }] };
    expect(formatPlace(job, en)).toBe('A (+1 more)');
  });

  it('formats pay ranges and fixed pay with units', () => {
    expect(formatPay({ ...base, verguetungsangabe: 'JAHRESGEHALT', gehaltsspanneVon: 40000, gehaltsspanneBis: 50000 }, en)).toBe(
      '€40,000.00 – €50,000.00 per year',
    );
    expect(formatPay({ ...base, verguetungsangabe: 'STUNDENLOHN', festgehalt: 27.89 }, en)).toBe('€27.89 per hour');
    expect(formatPay(base, en)).toBeUndefined();
  });

  it('lists working times', () => {
    expect(workingTimes({ ...base, arbeitszeitVollzeit: true, arbeitszeitTeilzeitFlexibel: true }, en)).toEqual(['Full-time', 'Part-time']);
  });

  it('labels contracts and offer types', () => {
    expect(formatContract({ ...base, vertragsdauer: 'BEFRISTET', befristetBis: '2027-11-30' }, en)).toBe('Fixed-term until 30 Nov 2027');
    expect(formatContract({ ...base, vertragsdauer: 'KEINE_ANGABE' }, en)).toBeUndefined();
    expect(formatOfferType({ ...base, stellenangebotsart: 'AUSBILDUNG' }, en)).toBe('Apprenticeship');
  });
});

describe('format (German)', () => {
  it('uses German dates, currency and labels', () => {
    expect(formatDate('2026-11-24', de)).toBe('24. Nov. 2026');
    expect(formatPay({ ...base, verguetungsangabe: 'STUNDENLOHN', festgehalt: 27.89 }, de)).toBe('27,89 € pro Stunde');
    expect(formatContract({ ...base, vertragsdauer: 'UNBEFRISTET' }, de)).toBe('Unbefristet');
  });
});
