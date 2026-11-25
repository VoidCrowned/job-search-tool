import { useEffect, useRef, useState, type FormEvent } from 'react';
import { backupFileName, parseBackup } from '../shared/backup.ts';
import exampleProfile from '../../examples/profile.example.json';
import { isProfileEmpty, MAX_LENGTH, MULTILINE_FIELDS, parseProfile, type Profile, type ProfileField } from '../shared/profile.ts';
import { errorText, RequestError, useLoad } from './api.ts';
import { backend, isHosted, type KeyStatus } from './backend/index.ts';
import { TextSkeleton } from './Skeleton.tsx';
import { StableLabel } from './StableLabel.tsx';
import { useT } from './i18n/index.tsx';

const SECTIONS: { key: 'personal' | 'goals' | 'cv'; fields: ProfileField[] }[] = [
  { key: 'personal', fields: ['name', 'email', 'phone', 'street', 'postcode', 'city'] },
  { key: 'goals', fields: ['desiredRoles', 'skills', 'languages', 'notes'] },
  { key: 'cv', fields: ['cv'] },
];

export function ProfilePage() {
  const t = useT();
  // Bumped after an import, so the form and the key section show the imported data.
  const [generation, setGeneration] = useState(0);
  const result = useLoad<Profile>(`profile:${generation}`, (signal) => backend.getProfile(signal));

  useEffect(() => {
    document.title = t.app.pageTitle(t.profile.title);
  }, [t]);

  return (
    <article className="profile-page">
      <h1>{t.profile.title}</h1>
      <p className="hint">{isHosted ? t.profile.introOnline : t.profile.intro}</p>
      {result.state === 'loading' && <TextSkeleton label={t.profile.loading} lines={8} />}
      {result.state === 'error' && <p className="error">{errorText(result.error, t)}</p>}
      <KeySettings key={`key:${generation}`} />
      {result.state === 'done' && <ProfileForm key={generation} initial={result.data} />}
      <BackupSection onImported={() => setGeneration((g) => g + 1)} />
    </article>
  );
}


type KeyState = { kind: 'idle' } | { kind: 'working' } | { kind: 'saved' } | { kind: 'removed' } | { kind: 'error'; error: RequestError };

/** The Claude API key: saved by the server in .env. The browser only ever sees a short hint, never the key. */
function KeySettings() {
  const t = useT();
  const [status, setStatus] = useState<KeyStatus | undefined>();
  const [key, setKey] = useState('');
  const [state, setState] = useState<KeyState>({ kind: 'idle' });
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    let active = true;
    backend
      .keyStatus()
      .then((s) => active && setStatus(s))
      .catch((err: unknown) => active && setState({ kind: 'error', error: keyError(err) }));
    return () => {
      active = false;
    };
  }, []);

  async function run(action: () => Promise<KeyStatus>, done: KeyState) {
    setState({ kind: 'working' });
    try {
      setStatus(await action());
      setKey('');
      setState(done);
    } catch (err) {
      setState({ kind: 'error', error: keyError(err) });
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    void run(() => backend.setKey(key), { kind: 'saved' });
  }

  function remove() {
    if (!window.confirm(t.profile.key.removeConfirm)) return;
    void run(() => backend.removeKey(), { kind: 'removed' });
  }

  const typed = key.trim() !== '';
  return (
    <form className="key-settings" onSubmit={save}>
      <fieldset className="profile-section key-section">
        <legend>{t.profile.key.title}</legend>
        <div className="key-info">
          <p className="hint">{isHosted ? t.profile.key.introOnline : t.profile.key.intro}</p>
        </div>
        <div className="key-entry">
          <div className="profile-field">
            <label htmlFor="api-key">{t.profile.key.label}</label>
            <div className="secret-input">
              <input
                id="api-key"
                type={reveal ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                // The saved key never reaches the browser; its short hint stands in for it.
                placeholder={status?.set ? status.hint : 'sk-or-…'}
              />
              <button
                type="button"
                className="reveal"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? t.profile.key.hide : t.profile.key.show}
                aria-pressed={reveal}
                title={reveal ? t.profile.key.hide : t.profile.key.show}
              >
                <EyeIcon crossed={reveal} />
              </button>
            </div>
          </div>
          <div className="key-actions">
            <button type="submit" className="primary" disabled={!typed || state.kind === 'working'}>
              <StableLabel labels={[t.profile.key.save, t.profile.key.isSetButton]} show={typed || !status?.set ? 0 : 1} />
            </button>
            {status?.set && (
              <button type="button" className="button" onClick={remove} disabled={state.kind === 'working'}>
                {t.profile.key.remove}
              </button>
            )}
          </div>
          <span aria-live="polite" className={state.kind === 'error' ? 'error' : 'hint'}>
            {state.kind === 'error' ? errorText(state.error, t) : state.kind === 'removed' ? t.profile.key.removed : ''}
          </span>
        </div>
      </fieldset>
    </form>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M3 3l18 18" />}
    </svg>
  );
}

type BackupState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'exported'; letters: number }
  | { kind: 'imported'; letters: number; skipped: number }
  | { kind: 'error'; error: RequestError };

/** Export everything to one file, or import such a file (another browser or computer, or a kept copy). */
function BackupSection({ onImported }: { onImported: () => void }) {
  const t = useT();
  const [includeKey, setIncludeKey] = useState(false);
  const [state, setState] = useState<BackupState>({ kind: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportData() {
    setState({ kind: 'working' });
    try {
      const data = await backend.exportData(isHosted && includeKey);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName();
      link.click();
      URL.revokeObjectURL(url);
      setState({ kind: 'exported', letters: data.letters.length });
    } catch (err) {
      setState({ kind: 'error', error: toRequestError(err) });
    }
  }

  async function importFile(file: File) {
    let parsed: ReturnType<typeof parseBackup>;
    try {
      parsed = parseBackup(JSON.parse(await file.text()));
    } catch {
      parsed = { skipped: 0, error: 'invalid' };
    }
    const { backup, skipped } = parsed;
    if (!backup) {
      setState({ kind: 'error', error: new RequestError(400, 'Invalid backup.', 'INVALID_BACKUP') });
      return;
    }
    if (!window.confirm(t.profile.backup.importConfirm(backup.letters.length))) return;
    setState({ kind: 'working' });
    try {
      const { letters } = await backend.importData(backup);
      if (backup.apiKey) await backend.setKey(backup.apiKey);
      setState({ kind: 'imported', letters, skipped });
      onImported();
    } catch (err) {
      setState({ kind: 'error', error: toRequestError(err) });
    }
  }

  return (
    <section className="profile-section backup-section" aria-labelledby="backup-title">
      <h2 id="backup-title" className="section-title">
        {t.profile.backup.title}
      </h2>
      <p className="hint">{t.profile.backup.intro}</p>
      {isHosted && (
        <label className="check">
          <input type="checkbox" checked={includeKey} onChange={(e) => setIncludeKey(e.target.checked)} />
          {t.profile.backup.includeKey}
        </label>
      )}
      <div className="key-actions">
        <button type="button" className="button" onClick={exportData} disabled={state.kind === 'working'}>
          {t.profile.backup.export}
        </button>
        <button type="button" className="button" onClick={() => fileRef.current?.click()} disabled={state.kind === 'working'}>
          {t.profile.backup.import}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="backup-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>
      <span aria-live="polite" className={state.kind === 'error' ? 'error' : 'hint'}>
        {state.kind === 'error'
          ? errorText(state.error, t)
          : state.kind === 'exported'
            ? t.profile.backup.exported(state.letters)
            : state.kind === 'imported'
              ? t.profile.backup.imported(state.letters, state.skipped)
              : ''}
      </span>
    </section>
  );
}

const toRequestError = (err: unknown) => (err instanceof RequestError ? err : new RequestError(0, String(err)));

/** The key routes always exist, so a 404 there means the server still runs older code (before this feature). */
function keyError(err: unknown): RequestError {
  const e = toRequestError(err);
  return e.status === 404 ? new RequestError(404, e.message, 'UNKNOWN_ROUTE') : e;
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'example' } | { kind: 'error'; error: RequestError };

function ProfileForm({ initial }: { initial: Profile }) {
  const t = useT();
  const [profile, setProfile] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  function loadExample() {
    if (!isProfileEmpty(profile) && !window.confirm(t.profile.replaceConfirm)) return;
    setProfile(parseProfile(exampleProfile).profile);
    setStatus({ kind: 'example' });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus({ kind: 'saving' });
    try {
      const stored = await backend.saveProfile(profile);
      setSaved(stored);
      setProfile(stored);
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus({ kind: 'error', error: err instanceof RequestError ? err : new RequestError(0, String(err)) });
    }
  }

  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="example-row">
        <button type="button" className="button" onClick={loadExample}>
          {t.profile.loadExample}
        </button>
        <small className="hint">{t.profile.exampleHint}</small>
      </div>
      {SECTIONS.map((section) => (
        <fieldset key={section.key} className="profile-section">
          <legend>{t.profile.sections[section.key]}</legend>
          {section.fields.map((field) => {
            const multiline = MULTILINE_FIELDS.includes(field);
            const hint = t.profile.hints[field];
            const common = {
              id: `profile-${field}`,
              value: profile[field],
              maxLength: MAX_LENGTH[field],
              'aria-describedby': hint ? `profile-${field}-hint` : undefined,
              onChange: (e: { target: { value: string } }) => setProfile((p) => ({ ...p, [field]: e.target.value })),
            };
            return (
              <div key={field} className={`profile-field field-${field}`}>
                <label htmlFor={common.id}>{t.profile.fields[field]}</label>
                {multiline ? (
                  <textarea {...common} rows={field === 'cv' ? 16 : 3} />
                ) : (
                  <input {...common} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} />
                )}
                {hint && (
                  <small id={`profile-${field}-hint`} className="hint">
                    {hint}
                  </small>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={!dirty || status.kind === 'saving'}>
          {/* "Saved" while the form matches what is stored; "Save profile" as soon as anything differs. */}
          <StableLabel
            labels={[t.profile.save, t.profile.saving, t.profile.saved]}
            show={status.kind === 'saving' ? 1 : dirty ? 0 : 2}
          />
        </button>
        <span aria-live="polite" className={status.kind === 'error' ? 'error' : 'hint'}>
          {status.kind === 'error' ? errorText(status.error, t) : status.kind === 'example' && dirty ? t.profile.exampleLoaded : ''}
        </span>
      </div>
    </form>
  );
}
