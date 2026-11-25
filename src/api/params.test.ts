import { describe, expect, it } from 'vitest';
import { DEFAULT_SIZE, parseSearchParams, toApiQuery, toAppQuery, toSearchRequest, withAppDefaults } from './params.ts';

describe('parseSearchParams', () => {
  it('uses defaults for empty input', () => {
    expect(parseSearchParams({})).toEqual({ params: { page: 1, size: DEFAULT_SIZE }, errors: [] });
  });

  it('parses all supported fields', () => {
    const { params, errors } = parseSearchParams(
      new URLSearchParams(
        'was=Entwickler&wo=Berlin&umkreis=50&angebotsart=1&arbeitszeit=vz;tz&befristung=2&veroeffentlichtseit=7&zeitarbeit=false&page=3&size=50',
      ),
    );
    expect(errors).toEqual([]);
    expect(params).toEqual({
      was: 'Entwickler',
      wo: 'Berlin',
      umkreis: 50,
      angebotsart: '1',
      arbeitszeit: ['vz', 'tz'],
      befristung: ['2'],
      veroeffentlichtseit: 7,
      zeitarbeit: false,
      page: 3,
      size: 50,
    });
  });

  it('drops and reports invalid values', () => {
    const { params, errors } = parseSearchParams({ umkreis: '-1', angebotsart: '9', arbeitszeit: 'vz;ho', zeitarbeit: 'yes', size: '500' });
    expect(params).toEqual({ arbeitszeit: ['vz'], page: 1, size: DEFAULT_SIZE });
    expect(errors).toHaveLength(5);
  });

  it('keeps page × size within the API result window', () => {
    expect(parseSearchParams({ size: '100', page: '100' }).errors).toEqual([]);
    expect(parseSearchParams({ size: '100', page: '101' }).errors).toHaveLength(1);
  });

  it('ignores blank strings', () => {
    expect(parseSearchParams({ was: '  ', wo: '' }).params).toEqual({ page: 1, size: DEFAULT_SIZE });
  });
});

describe('query conversion', () => {
  it('toApiQuery joins lists with ;', () => {
    expect(toApiQuery({ arbeitszeit: ['vz', 'tz'], page: 1, size: 25 }).get('arbeitszeit')).toBe('vz;tz');
  });

  it('toAppQuery leaves out defaults', () => {
    expect(toAppQuery({ was: 'x', page: 1, size: DEFAULT_SIZE }).toString()).toBe('was=x');
  });

  it('round-trips through parseSearchParams', () => {
    const original = { was: 'Koch', befristung: ['1' as const, '3' as const], zeitarbeit: true, page: 2, size: 10 };
    expect(parseSearchParams(toAppQuery(original)).params).toEqual(original);
  });
});

describe('website defaults', () => {
  it('leaves temp agency jobs out unless asked for', () => {
    expect(withAppDefaults({ page: 1, size: DEFAULT_SIZE }).zeitarbeit).toBe(false);
    expect(withAppDefaults({ zeitarbeit: true, page: 1, size: DEFAULT_SIZE }).zeitarbeit).toBe(true);
  });

  it('keeps the default out of page URLs but sends it to the server', () => {
    const excluded = withAppDefaults({ was: 'Koch', page: 1, size: DEFAULT_SIZE });
    expect(toAppQuery(excluded).toString()).toBe('was=Koch');
    expect(toSearchRequest(excluded).toString()).toBe('was=Koch&zeitarbeit=false');
    const included = { was: 'Koch', zeitarbeit: true, page: 2, size: DEFAULT_SIZE };
    expect(toAppQuery(included).toString()).toBe('was=Koch&zeitarbeit=true&page=2');
    expect(toSearchRequest(included).toString()).toBe('was=Koch&zeitarbeit=true&page=2');
  });
});
