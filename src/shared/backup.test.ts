import { describe, expect, it } from 'vitest';
import { MAX_VERSIONS, type LetterFile, type LetterVersion } from './letter.ts';
import { emptyProfile } from './profile.ts';
import { backupFileName, makeBackup, mergeLetterFiles, parseBackup } from './backup.ts';

const v = (id: string, createdAt: string, text = id): LetterVersion => ({ id, createdAt, source: 'edit', language: 'de', text });
const file = (refnr: string, versions: LetterVersion[]): LetterFile => ({ refnr, jobTitle: 'Pflege', versions });
const profile = { ...emptyProfile(), name: 'Void' };

describe('backup file', () => {
  it('round-trips profile, letters and an included key', () => {
    const backup = makeBackup(profile, [file('10001-1-S', [v('a', '2026-11-01T10:00:00Z')])], 'sk-or-v1-0123456789abcdefWXYZ', new Date('2026-11-25T12:00:00Z'));
    expect(parseBackup(JSON.parse(JSON.stringify(backup)))).toEqual({ backup, skipped: 0 });
    expect(backup.exportedAt).toBe('2026-11-25T12:00:00.000Z');
    expect(backupFileName(new Date('2026-11-25T12:00:00Z'))).toBe('job-search-backup-2026-11-25.json');
  });

  it('refuses other files and invalid profiles', () => {
    expect(parseBackup({ hello: 1 }).error).toBeDefined();
    expect(parseBackup([]).error).toBeDefined();
    expect(parseBackup({ app: 'job-search-tool', version: 2 }).error).toMatch(/version/);
    expect(parseBackup({ app: 'job-search-tool', version: 1, profile: { name: 42 } }).error).toMatch(/profile/);
  });

  it('skips broken letters, extra fields and invalid keys', () => {
    const { backup, skipped } = parseBackup({
      app: 'job-search-tool',
      version: 1,
      profile,
      apiKey: 'not-a-key',
      letters: [
        file('10001-1-S', [{ ...v('a', '2026-11-01T10:00:00Z'), extra: '<script>' } as LetterVersion, { ...v('b', 'never'), id: 'b' }]),
        { refnr: '../../etc', versions: [v('c', '2026-11-01T10:00:00Z')] },
        file('10001-2-S', [{ ...v('d', '2026-11-01T10:00:00Z'), source: 'hacked' } as unknown as LetterVersion]),
      ],
    });
    expect(skipped).toBe(2);
    expect(backup?.apiKey).toBeUndefined();
    expect(backup?.letters).toEqual([file('10001-1-S', [v('a', '2026-11-01T10:00:00Z')])]);
  });
});

describe('mergeLetterFiles', () => {
  it('adds new versions by id, oldest first, and importing twice changes nothing', () => {
    const mine = file('x123', [v('a', '2026-11-01T10:00:00Z'), v('c', '2026-11-03T10:00:00Z')]);
    const theirs = file('x123', [v('b', '2026-11-02T10:00:00Z'), v('c', '2026-11-03T10:00:00Z', 'other text')]);
    const merged = mergeLetterFiles(mine, theirs);
    expect(merged.versions.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(merged.versions[2].text).toBe('c');
    expect(mergeLetterFiles(merged, theirs)).toEqual(merged);
  });

  it('keeps at most MAX_VERSIONS', () => {
    const many = Array.from({ length: MAX_VERSIONS }, (_, i) => v(`m${i}`, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString()));
    const merged = mergeLetterFiles(file('x123', many), file('x123', [v('new', '2026-11-25T00:00:00Z')]));
    expect(merged.versions).toHaveLength(MAX_VERSIONS);
    expect(merged.versions.at(-1)?.id).toBe('new');
  });
});
