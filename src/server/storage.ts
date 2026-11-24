// Local file storage for personal data (profile, letters). Lives in data/ by default, which git ignores.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { emptyProfile, parseProfile, type Profile } from '../shared/profile.ts';

export interface Storage {
  readonly dir: string;
  readProfile(): Promise<Profile>;
  writeProfile(profile: Profile): Promise<void>;
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
  };
}
