import { describe, expect, it } from 'vitest';
import { LANGUAGES } from './index.tsx';
import { en } from './en.ts';

/** Flattens messages into "a.b.c" → value, so languages can be compared key by key. */
function flatten(obj: object, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const reference = flatten(en);

describe.each(Object.entries(LANGUAGES))('translation %s', (code, messages) => {
  const flat = flatten(messages);

  it('has exactly the same keys as English', () => {
    expect(Object.keys(flat).sort()).toEqual(Object.keys(reference).sort());
  });

  it('has no empty texts', () => {
    const empty = Object.entries(flat).filter(([, v]) => typeof v === 'string' && v.trim() === '');
    expect(empty).toEqual([]);
  });

  it('uses the same kind of value (text or function) as English', () => {
    const mismatched = Object.keys(reference).filter((k) => typeof flat[k] !== typeof reference[k]);
    expect(mismatched).toEqual([]);
  });

  it('has a valid locale', () => {
    expect(() => new Intl.DateTimeFormat(messages.locale)).not.toThrow();
    expect(messages.locale.toLowerCase().startsWith(code)).toBe(true);
  });
});
