import { describe, expect, it } from 'vitest';
import { removePlaceholders } from './letter.ts';

describe('removePlaceholders', () => {
  it('drops placeholders, lines left empty and stray spaces, keeping paragraphs', () => {
    const text = 'Sehr geehrte Damen und Herren,\n\nIch kann ab Februar anfangen. [Umzug ergänzen]\n\n[Optional: Weiterbildung]\n\nIch arbeite gern [Beispiel] , im Team.\n\nMit freundlichen Grüßen';
    expect(removePlaceholders(text)).toBe(
      'Sehr geehrte Damen und Herren,\n\nIch kann ab Februar anfangen.\n\nIch arbeite gern, im Team.\n\nMit freundlichen Grüßen',
    );
  });

  it('leaves clean letters unchanged', () => {
    const text = 'Zeile 1\n\nZeile 2 (m/w/d)';
    expect(removePlaceholders(text)).toBe(text);
  });
});
