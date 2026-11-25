// Writing a letter for one job and keeping its version list. Shared by the local server and the online
// version, which differ only in where the profile and letters are stored.
import type { JobDetails } from '../../api/types.ts';
import { MAX_VERSIONS, type LanguageChoice, type LetterFile, type LetterLanguage, type LetterVersion } from '../letter.ts';
import type { Profile } from '../profile.ts';
import type { LetterGenerator } from './claude.ts';
import { detectLanguage } from './language.ts';
import { fillTemplate } from './template.ts';

export type NewVersion = Omit<LetterVersion, 'id' | 'createdAt'>;

export interface WriteRequest {
  profile: Profile;
  job: JobDetails;
  language: LanguageChoice;
  /** `generator` must be set for 'ai'. */
  mode: 'ai' | 'template';
  generator?: LetterGenerator | null;
  /** Left-out points the candidate ticked as true. */
  confirmed?: string[];
}

export function letterLanguage(choice: LanguageChoice, job: JobDetails): LetterLanguage {
  return choice === 'auto' ? detectLanguage(job.stellenangebotsTitel, job.stellenangebotsBeschreibung) : choice;
}

/** Writes a new letter with Claude or from the template. Errors from Claude (refusal, bad key, …) pass through. */
export async function writeLetter({ profile, job, language: choice, mode, generator, confirmed }: WriteRequest): Promise<NewVersion> {
  const language = letterLanguage(choice, job);
  if (mode === 'template') return { source: 'template', language, text: fillTemplate(profile, job, language) };
  if (!generator) throw new Error('No AI generator configured.');
  const result = await generator({ profile, job, language, confirmed });
  return {
    source: 'claude',
    language,
    text: result.letter,
    adKeywords: result.adKeywords,
    missing: result.missing.length ? result.missing : undefined,
    confirmed: confirmed?.length ? confirmed : undefined,
  };
}

/** A job's letter file, created empty if there is none yet; job title and company are refreshed from the ad. */
export function letterFileFor(refnr: string, stored: LetterFile | undefined, job?: JobDetails): LetterFile {
  const file = stored ?? { refnr, jobTitle: '', versions: [] };
  if (job) {
    file.jobTitle = job.stellenangebotsTitel;
    file.company = job.firma;
  }
  return file;
}

/** Appends a version (with id and time) and drops the oldest beyond MAX_VERSIONS. Changes `file`. */
export function addVersion(file: LetterFile, version: NewVersion, now = new Date()): LetterVersion {
  const full: LetterVersion = { id: crypto.randomUUID(), createdAt: now.toISOString(), ...version };
  file.versions.push(full);
  if (file.versions.length > MAX_VERSIONS) file.versions.splice(0, file.versions.length - MAX_VERSIONS);
  return full;
}
