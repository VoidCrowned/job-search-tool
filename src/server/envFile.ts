// Changes single variables in the .env file, leaving every other line (comments, other settings) as it was.
import { readFile, rename, writeFile } from 'node:fs/promises';

const NAME = /^[A-Z][A-Z0-9_]*$/;

/** Sets (or with `undefined` removes) variables in the .env text. Commented-out lines stay untouched. */
export function updateEnvText(text: string, changes: Record<string, string | undefined>): string {
  const lines = text ? text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n') : [];
  for (const [name, value] of Object.entries(changes)) {
    if (!NAME.test(name)) throw new Error(`Invalid variable name: ${name}`);
    if (value !== undefined && /[\r\n]/.test(value)) throw new Error('Values must be one line.');
    const isLine = (l: string) => new RegExp(`^\\s*(export\\s+)?${name}\\s*=`).test(l);
    const index = lines.findIndex(isLine);
    // Drop every active line for this name; the new value goes where the first one was, or at the end.
    const kept = lines.filter((l) => !isLine(l));
    if (value !== undefined) kept.splice(index === -1 ? kept.length : index, 0, `${name}=${value}`);
    lines.splice(0, lines.length, ...kept);
  }
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export async function updateEnvFile(path: string, changes: Record<string, string | undefined>): Promise<void> {
  const text = await readFile(path, 'utf8').catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return '';
    throw err;
  });
  const tmp = `${path}.${process.pid}.tmp`;
  // Only the owner may read it: it holds the API key.
  await writeFile(tmp, updateEnvText(text, changes), { mode: 0o600 });
  await rename(tmp, path);
}
