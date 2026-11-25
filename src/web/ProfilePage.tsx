import { useEffect, useState, type FormEvent } from 'react';
import exampleProfile from '../../examples/profile.example.json';
import { isProfileEmpty, MAX_LENGTH, MULTILINE_FIELDS, parseProfile, type Profile, type ProfileField } from '../shared/profile.ts';
import { deleteJson, errorText, getJson, RequestError, sendJson, useJson } from './api.ts';
import { useT } from './i18n/index.tsx';

const SECTIONS: { key: 'personal' | 'goals' | 'cv'; fields: ProfileField[] }[] = [
  { key: 'personal', fields: ['name', 'email', 'phone', 'street', 'postcode', 'city'] },
  { key: 'goals', fields: ['desiredRoles', 'skills', 'languages', 'notes'] },
  { key: 'cv', fields: ['cv'] },
];

export function ProfilePage() {
  const t = useT();
  const result = useJson<Profile>('/api/profile');

  useEffect(() => {
    document.title = t.app.pageTitle(t.profile.title);
  }, [t]);

  return (
    <article className="profile-page">
      <h1>{t.profile.title}</h1>
      <p className="hint">{t.profile.intro}</p>
      {result.state === 'loading' && <p className="hint">{t.profile.loading}</p>}
      {result.state === 'error' && <p className="error">{errorText(result.error, t)}</p>}
      <KeySettings />
      {result.state === 'done' && <ProfileForm initial={result.data} />}
    </article>
  );
}

interface KeyStatus {
  set: boolean;
  provider?: 'anthropic' | 'openrouter';
  hint?: string;
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
    getJson<KeyStatus>('/api/settings/key')
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
    void run(() => sendJson<KeyStatus>('PUT', '/api/settings/key', { key }), { kind: 'saved' });
  }

  function remove() {
    if (!window.confirm(t.profile.key.removeConfirm)) return;
    void run(() => deleteJson<KeyStatus>('/api/settings/key'), { kind: 'removed' });
  }

  const typed = key.trim() !== '';
  return (
    <form className="key-settings" onSubmit={save}>
      <fieldset className="profile-section key-section">
        <legend>{t.profile.key.title}</legend>
        <div className="key-info">
          <p className="hint">{t.profile.key.intro}</p>
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

/**
 * A button label that switches text without changing the button's size: every label takes up the same
 * grid cell, and only the one shown is visible. So the widest label sets the width.
 */
function StableLabel({ labels, show }: { labels: string[]; show: number }) {
  return (
    <span className="stable-label">
      {labels.map((label, i) => (
        <span key={i} aria-hidden={i !== show} className={i === show ? undefined : 'stable-label-hidden'}>
          {label}
        </span>
      ))}
    </span>
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
      const stored = await sendJson<Profile>('PUT', '/api/profile', profile);
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
