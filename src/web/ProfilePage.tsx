import { useEffect, useState, type FormEvent } from 'react';
import { MAX_LENGTH, MULTILINE_FIELDS, type Profile, type ProfileField } from '../shared/profile.ts';
import { errorText, RequestError, sendJson, useJson } from './api.ts';
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
      {result.state === 'done' && <ProfileForm initial={result.data} />}
    </article>
  );
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; error: RequestError };

function ProfileForm({ initial }: { initial: Profile }) {
  const t = useT();
  const [profile, setProfile] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

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
        <button type="submit" className="primary" disabled={status.kind === 'saving'}>
          {status.kind === 'saving' ? t.profile.saving : t.profile.save}
        </button>
        <span aria-live="polite" className={status.kind === 'error' ? 'error' : 'hint'}>
          {status.kind === 'error' ? errorText(status.error, t) : dirty ? t.profile.unsaved : status.kind === 'saved' ? t.profile.saved : ''}
        </span>
      </div>
    </form>
  );
}
