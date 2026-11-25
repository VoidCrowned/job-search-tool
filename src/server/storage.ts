// Local file storage for personal data (profile, letters). Lives in data/ by default, which git ignores.
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_VERSIONS, type LetterFile } from '../shared/letter.ts';
import { emptyProfile, parseProfile, type Profile } from '../shared/profile.ts';

export interface Storage {
  readonly dir: string;
  readProfile(): Promise<Profile>;
  writeProfile(profile: Profile): Promise<void>;
  readLetters(refnr: string): Promise<LetterFile | undefined>;
  writeLetters(file: LetterFile): Promise<void>;
  /** Every job's letters, for the backup file. */
  listLetters(): Promise<LetterFile[]>;
}

/** Reference numbers become file names: keep only safe characters. */
export function letterFileName(refnr: string): string {
  return `${refnr.replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

/** Writes via a temp file + rename, so a crash never leaves a half-written file. */
async function writeJson(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await rename(tmp, path);
}

export function createStorage(dir: string = process.env.DATA_DIR ?? 'data'): Storage {
  const profilePath = join(dir, 'profile.json');
  const lettersDir = join(dir, 'letters');
  const ensureDir = () => mkdir(dir, { recursive: true });

  return {
    dir,
    async readProfile() {
      const raw = await readJson(profilePath);
      // A hand-edited file with bad fields still loads; invalid fields are simply left empty.
      return raw === undefined ? emptyProfile() : parseProfile(raw).profile;
    },
    async writeProfile(profile) {
      await ensureDir();
      await writeJson(profilePath, profile);
    },
    async readLetters(refnr) {
      const raw = (await readJson(join(lettersDir, letterFileName(refnr)))) as LetterFile | undefined;
      return raw && Array.isArray(raw.versions) ? raw : undefined;
    },
    async writeLetters(file) {
      await mkdir(lettersDir, { recursive: true });
      const versions = file.versions.slice(-MAX_VERSIONS);
      await writeJson(join(lettersDir, letterFileName(file.refnr)), { ...file, versions });
    },
    async listLetters() {
      const names = await readdir(lettersDir).catch((err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') return [] as string[];
        throw err;
      });
      const files = await Promise.all(names.filter((n) => n.endsWith('.json')).map((n) => readJson(join(lettersDir, n))));
      return files.filter((f): f is LetterFile => Boolean(f) && Array.isArray((f as LetterFile).versions));
    },
  };
}
