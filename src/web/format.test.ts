import { describe, expect, it } from 'vitest';
import { formatContract, formatDate, formatOfferType, formatPay, formatPlace, workingTimes } from './format.ts';
import searchFixture from '../api/fixtures/search.json';
import type { JobSearchItem } from '../api/types.ts';

const items = searchFixture.ergebnisliste as JobSearchItem[];

describe('format', () => {
  it('formats dates in British style', () => {
    expect(formatDate('2026-11-24')).toBe('24 Nov 2026');
    expect(formatDate(undefined)).toBeUndefined();
    expect(formatDate('nonsense')).toBeUndefined();
  });

  it('formats places from fixtures', () => {
    expect(formatPlace(items[0])).toBe('20146 Hamburg');
    expect(formatPlace({ referenznummer: 'x', stellenangebotsTitel: 'y' })).toBeUndefined();
  });

  it('counts extra locations', () => {
    const job = { referenznummer: 'x', stellenangebotsTitel: 'y', stellenlokationen: [{ adresse: { ort: 'A' } }, { adresse: { ort: 'B' } }] };
    expect(formatPlace(job)).toBe('A (+1 more)');
  });

  it('formats pay ranges and fixed pay with units', () => {
    const base = { referenznummer: 'x', stellenangebotsTitel: 'y' };
    expect(formatPay({ ...base, verguetungsangabe: 'JAHRESGEHALT', gehaltsspanneVon: 40000, gehaltsspanneBis: 50000 })).toBe(
      '€40,000.00 – €50,000.00 per year',
    );
    expect(formatPay({ ...base, verguetungsangabe: 'STUNDENLOHN', festgehalt: 27.89 })).toBe('€27.89 per hour');
    expect(formatPay(base)).toBeUndefined();
  });

  it('lists working times', () => {
    expect(workingTimes({ referenznummer: 'x', stellenangebotsTitel: 'y', arbeitszeitVollzeit: true, arbeitszeitTeilzeitFlexibel: true })).toEqual([
      'Full-time',
      'Part-time',
    ]);
  });

  it('labels contracts and offer types', () => {
    const base = { referenznummer: 'x', stellenangebotsTitel: 'y' };
    expect(formatContract({ ...base, vertragsdauer: 'BEFRISTET', befristetBis: '2027-11-30' })).toBe('Fixed-term until 30 Nov 2027');
    expect(formatContract({ ...base, vertragsdauer: 'KEINE_ANGABE' })).toBeUndefined();
    expect(formatOfferType({ ...base, stellenangebotsart: 'AUSBILDUNG' })).toBe('Apprenticeship');
  });
});
