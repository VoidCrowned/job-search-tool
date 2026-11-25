// Everything the website asks of its backend. Locally that is the Hono server (/api/*); online it will run
// in the browser (see #10). Pages only use this interface, never fetch('/api/…') themselves.
import type { JobDetails, SearchResponse } from '../../api/types.ts';
import type { LanguageChoice, LetterFile, LetterLanguage, LetterVersion } from '../../shared/letter.ts';
import type { Profile } from '../../shared/profile.ts';
import type { Backup } from '../../shared/backup.ts';

export interface AiConfig {
  ai: boolean;
  model?: string;
  provider?: 'anthropic' | 'openrouter';
}

export interface KeyStatus {
  set: boolean;
  provider?: 'anthropic' | 'openrouter';
  hint?: string;
}

export interface GenerateRequest {
  language: LanguageChoice;
  mode: 'ai' | 'template';
  /** Left-out points the candidate ticked as true. */
  confirmed?: string[];
}

export interface LetterResult {
  file: LetterFile;
  version: LetterVersion;
}

export interface Backend {
  /** 'local': the server on this computer. 'browser': the online version, everything stays in this browser. */
  kind: 'local' | 'browser';
  /** `query` is the search request built by toSearchRequest (src/api/params.ts). */
  searchJobs(query: URLSearchParams, signal?: AbortSignal): Promise<SearchResponse>;
  jobDetails(refnr: string, signal?: AbortSignal): Promise<JobDetails>;
  /** Image URL for an employer logo. */
  logoUrl(hash: string): string;

  getProfile(signal?: AbortSignal): Promise<Profile>;
  saveProfile(profile: Profile): Promise<Profile>;

  getLetters(refnr: string): Promise<LetterFile>;
  generateLetter(refnr: string, request: GenerateRequest): Promise<LetterResult>;
  saveVersion(refnr: string, version: { text: string; language: LetterLanguage }): Promise<LetterResult>;

  /** Everything personal as one file. `includeKey` only has an effect online (locally the key stays in .env). */
  exportData(includeKey: boolean): Promise<Backup>;
  /** Replaces the profile and adds the letters to the existing ones. The key (if any) is set separately. */
  importData(backup: Backup): Promise<{ letters: number }>;

  aiConfig(): Promise<AiConfig>;
  keyStatus(): Promise<KeyStatus>;
  setKey(key: string): Promise<KeyStatus>;
  removeKey(): Promise<KeyStatus>;
}
