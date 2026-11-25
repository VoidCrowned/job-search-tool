// One file with everything personal: profile and letters (and, in the online version, optionally the key).
// Used to keep a copy, or to move to another browser or computer.
import { isValidApiKey } from './apiKey.ts';
import { MAX_CONFIRMED, MAX_LETTER_LENGTH, MAX_VERSIONS, type LetterFile, type LetterVersion } from './letter.ts';
import { parseProfile, type Profile } from './profile.ts';

export const BACKUP_APP = 'job-search-tool';
export const BACKUP_VERSION = 1;
/** Generous, but keeps a broken or hostile file from filling the storage. */
export const MAX_BACKUP_JOBS = 2000;

export interface Backup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  profile: Profile;
  letters: LetterFile[];
  /** Only when the person chose to include it (online version). */
  apiKey?: string;
}

const SOURCES = new Set(['template', 'claude', 'edit']);
const REFNR = /^[^\s/\\?#]{3,120}$/;

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const stringList = (v: unknown, max: number): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length <= 500).slice(0, max) : undefined;

function parseVersion(v: unknown): LetterVersion | undefined {
  if (!isObject(v)) return undefined;
  const { id, createdAt, source, language, text } = v;
  if (typeof id !== 'string' || !id || id.length > 100) return undefined;
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return undefined;
  if (typeof source !== 'string' || !SOURCES.has(source)) return undefined;
  if (language !== 'de' && language !== 'en') return undefined;
  if (typeof text !== 'string' || text.length > MAX_LETTER_LENGTH) return undefined;
  const version: LetterVersion = { id, createdAt, source: source as LetterVersion['source'], language, text };
  const adKeywords = stringList(v.adKeywords, 50);
  const missing = stringList(v.missing, 50);
  const confirmed = stringList(v.confirmed, MAX_CONFIRMED);
  if (adKeywords?.length) version.adKeywords = adKeywords;
  if (missing?.length) version.missing = missing;
  if (confirmed?.length) version.confirmed = confirmed;
  return version;
}

function parseLetterFile(f: unknown): LetterFile | undefined {
  if (!isObject(f) || typeof f.refnr !== 'string' || !REFNR.test(f.refnr) || !Array.isArray(f.versions)) return undefined;
  const versions = f.versions.map(parseVersion).filter((v): v is LetterVersion => Boolean(v));
  if (!versions.length) return undefined;
  return {
    refnr: f.refnr,
    jobTitle: typeof f.jobTitle === 'string' ? f.jobTitle.slice(0, 500) : '',
    ...(typeof f.company === 'string' ? { company: f.company.slice(0, 500) } : {}),
    versions: versions.slice(-MAX_VERSIONS),
  };
}

/** Checks a backup file. Broken letters are skipped (counted in `skipped`); a broken file as a whole is an error. */
export function parseBackup(input: unknown): { backup?: Backup; skipped: number; error?: string } {
  if (!isObject(input) || input.app !== BACKUP_APP) return { skipped: 0, error: 'Not a backup of this tool.' };
  if (input.version !== BACKUP_VERSION) return { skipped: 0, error: 'Backup from an unknown version.' };
  const { profile, errors } = parseProfile(input.profile);
  if (errors.length) return { skipped: 0, error: 'The profile in the backup is invalid.' };
  const raw = Array.isArray(input.letters) ? input.letters.slice(0, MAX_BACKUP_JOBS) : [];
  const letters = raw.map(parseLetterFile).filter((f): f is LetterFile => Boolean(f));
  const apiKey = typeof input.apiKey === 'string' && isValidApiKey(input.apiKey) ? input.apiKey : undefined;
  const backup: Backup = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : '',
    profile,
    letters,
    ...(apiKey ? { apiKey } : {}),
  };
  return { backup, skipped: raw.length - letters.length };
}

export function makeBackup(profile: Profile, letters: LetterFile[], apiKey?: string, now = new Date()): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), profile, letters, ...(apiKey ? { apiKey } : {}) };
}

/**
 * Adds imported letters to a job's existing ones: versions are matched by id, so importing the same file twice
 * changes nothing. Oldest first, at most MAX_VERSIONS. Nothing already there is lost unless the limit is reached.
 */
export function mergeLetterFiles(existing: LetterFile | undefined, imported: LetterFile): LetterFile {
  if (!existing) return { ...imported, versions: imported.versions.slice(-MAX_VERSIONS) };
  const byId = new Map(existing.versions.map((v) => [v.id, v]));
  for (const v of imported.versions) if (!byId.has(v.id)) byId.set(v.id, v);
  const versions = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-MAX_VERSIONS);
  return { ...existing, jobTitle: existing.jobTitle || imported.jobTitle, company: existing.company ?? imported.company, versions };
}

export function backupFileName(now = new Date()): string {
  return `job-search-backup-${now.toISOString().slice(0, 10)}.json`;
}
