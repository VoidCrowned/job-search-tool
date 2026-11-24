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

export function isLanguageChoice(v: unknown): v is LanguageChoice {
  return v === 'de' || v === 'en' || v === 'auto';
}
