// Application letters: shared types for server and web app.

export type LetterLanguage = 'de' | 'en';
export type LanguageChoice = LetterLanguage | 'auto';
export type LetterSource = 'template' | 'claude' | 'edit';

export interface LetterVersion {
  id: string;
  createdAt: string;
  source: LetterSource;
  language: LetterLanguage;
  text: string;
  /** Keywords from the ad (Claude only); used by the ATS check. */
  adKeywords?: string[];
  /** Points the profile didn't cover, left out of the letter (Claude only). Shown next to the letter, never in it. */
  missing?: string[];
}

export interface LetterFile {
  refnr: string;
  jobTitle: string;
  company?: string;
  /** Oldest first. */
  versions: LetterVersion[];
}

export const MAX_LETTER_LENGTH = 20_000;
/** Older versions beyond this are dropped. */
export const MAX_VERSIONS = 50;

/** Placeholders the user still has to fill look like "[Your name]". */
export const PLACEHOLDER = /\[[^\]\n]{2,80}\]/g;

/**
 * Last-resort cleanup for AI letters: takes "[…]" placeholders out of the text (so they can be listed next to it),
 * then drops lines left empty and stray spaces. Blank lines between paragraphs stay.
 */
export function extractPlaceholders(text: string): { text: string; removed: string[] } {
  const removed = [...new Set((text.match(PLACEHOLDER) ?? []).map((p) => p.slice(1, -1).replace(/^\s*optional\s*:\s*/i, '').trim()))].filter(Boolean);
  return { text: removePlaceholders(text), removed };
}

function removePlaceholders(text: string): string {
  return text
    .split('\n')
    .flatMap((line) => {
      if (!line.match(PLACEHOLDER)) return [line];
      const cleaned = line
        .replace(PLACEHOLDER, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +([.,;:!?])/g, '$1')
        .trim();
      return cleaned && !/^[.,;:!?]+$/.test(cleaned) ? [cleaned] : [];
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isLanguageChoice(v: unknown): v is LanguageChoice {
  return v === 'de' || v === 'en' || v === 'auto';
}
