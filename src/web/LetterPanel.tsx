// "Write application" section on the job page: generate a letter, edit it, save it, copy it.
import { useEffect, useRef, useState } from 'react';
import { PLACEHOLDER, type LanguageChoice, type LetterFile, type LetterVersion } from '../shared/letter.ts';
import { isProfileEmpty, type Profile } from '../shared/profile.ts';
import { errorText, getJson, RequestError, sendJson } from './api.ts';
import { formatDateTime } from './format.ts';
import { useT } from './i18n/index.tsx';
import { onLinkClick } from './router.ts';

export const LETTER_ANCHOR = 'letter';

interface Loaded {
  file: LetterFile;
  profile: Profile;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'saved' }
  | { kind: 'copied' }
  | { kind: 'copyFailed' }
  | { kind: 'error'; error: RequestError };

const toRequestError = (err: unknown) => (err instanceof RequestError ? err : new RequestError(0, String(err)));

export function LetterPanel({ refnr }: { refnr: string }) {
  const t = useT();
  const sectionRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(() => window.location.hash === `#${LETTER_ANCHOR}`);
  const [loaded, setLoaded] = useState<Loaded | { error: RequestError } | undefined>();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [file, profile] = await Promise.all([
          getJson<LetterFile>(`/api/letters/${encodeURIComponent(refnr)}`),
          getJson<Profile>('/api/profile'),
        ]);
        if (!Array.isArray(file?.versions)) throw new RequestError(500, 'Unexpected answer from the server.');
        if (!active) return;
        setLoaded({ file, profile });
        // Jobs that already have a letter open straight away.
        if (file.versions.length) setOpen(true);
      } catch (err) {
        if (active) setLoaded({ error: toRequestError(err) });
      }
    })();
    return () => {
      active = false;
    };
  }, [refnr]);

  useEffect(() => {
    if (window.location.hash === `#${LETTER_ANCHOR}`) sectionRef.current?.scrollIntoView?.({ block: 'start' });
  }, [loaded]);

  return (
    <section className="letter-panel" id={LETTER_ANCHOR} ref={sectionRef} aria-labelledby="letter-title">
      <div className="letter-head">
        <h2 id="letter-title">{t.letter.title}</h2>
        {!open && (
          <button type="button" className="primary" onClick={() => setOpen(true)}>
            {t.letter.open}
          </button>
        )}
      </div>
      {open && loaded && 'error' in loaded && <p className="error">{errorText(loaded.error, t)}</p>}
      {open && loaded && 'file' in loaded && <LetterEditor refnr={refnr} initial={loaded.file} profile={loaded.profile} />}
    </section>
  );
}

function LetterEditor({ refnr, initial, profile }: { refnr: string; initial: LetterFile; profile: Profile }) {
  const t = useT();
  const [file, setFile] = useState(initial);
  const latest: LetterVersion | undefined = file.versions[file.versions.length - 1];
  const [current, setCurrent] = useState<LetterVersion | undefined>(latest);
  const [text, setText] = useState(latest?.text ?? '');
  const [language, setLanguage] = useState<LanguageChoice>('auto');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dirty = current !== undefined && text !== current.text;
  const placeholders = text.match(PLACEHOLDER)?.length ?? 0;
  const url = `/api/letters/${encodeURIComponent(refnr)}`;

  function show(result: { file: LetterFile; version: LetterVersion }, next: Status) {
    setFile(result.file);
    setCurrent(result.version);
    setText(result.version.text);
    setStatus(next);
  }

  function openVersion(version: LetterVersion) {
    if (dirty && !window.confirm(t.letter.switchConfirm)) return;
    setCurrent(version);
    setText(version.text);
    setStatus({ kind: 'idle' });
  }

  async function generate() {
    if (dirty && !window.confirm(t.letter.replaceConfirm)) return;
    setStatus({ kind: 'working' });
    try {
      show(await sendJson(`POST`, `${url}/generate`, { language }), { kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', error: toRequestError(err) });
    }
  }

  async function save() {
    if (!current) return;
    setStatus({ kind: 'working' });
    try {
      show(await sendJson('POST', `${url}/versions`, { text, language: current.language }), { kind: 'saved' });
    } catch (err) {
      setStatus({ kind: 'error', error: toRequestError(err) });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ kind: 'copied' });
    } catch {
      // Clipboard API unavailable (e.g. not a secure context): fall back to selecting the text.
      textRef.current?.select();
      const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
      setStatus({ kind: ok ? 'copied' : 'copyFailed' });
    }
  }

  const message =
    status.kind === 'error'
      ? errorText(status.error, t)
      : status.kind === 'copyFailed'
        ? t.letter.copyFailed
        : dirty
          ? t.letter.unsaved
          : status.kind === 'saved'
            ? t.letter.saved
            : status.kind === 'copied'
              ? t.letter.copied
              : '';

  return (
    <div className="letter-editor">
      {isProfileEmpty(profile) && (
        <p className="notice">
          {t.letter.profileEmpty}{' '}
          <a href="/profile" onClick={onLinkClick}>
            {t.letter.editProfile}
          </a>
        </p>
      )}
      <div className="row letter-controls">
        <label className="narrow">
          {t.letter.language}
          <select value={language} onChange={(e) => setLanguage(e.target.value as LanguageChoice)}>
            <option value="auto">{t.letter.languageAuto}</option>
            <option value="de">{t.letter.languageDe}</option>
            <option value="en">{t.letter.languageEn}</option>
          </select>
        </label>
        <button type="button" className="primary" onClick={generate} disabled={status.kind === 'working'}>
          {status.kind === 'working' ? t.letter.working : t.letter.fillTemplate}
        </button>
      </div>
      <p className="hint">{t.letter.templateHint}</p>
      {!current && status.kind === 'error' && (
        <p className="error" aria-live="polite">
          {errorText(status.error, t)}
        </p>
      )}

      {current && (
        <>
          <label htmlFor="letter-text" className="visually-hidden">
            {t.letter.textLabel}
          </label>
          <textarea
            id="letter-text"
            ref={textRef}
            className="letter-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={22}
            lang={current.language}
            spellCheck
          />
          {placeholders > 0 && <p className="notice">{t.letter.placeholdersLeft(placeholders)}</p>}
          <div className="form-actions">
            <button type="button" className="primary" onClick={save} disabled={!dirty || status.kind === 'working'}>
              {t.letter.save}
            </button>
            <button type="button" className="button" onClick={copy}>
              {t.letter.copy}
            </button>
            <span aria-live="polite" className={status.kind === 'error' || status.kind === 'copyFailed' ? 'error' : 'hint'}>
              {message}
            </span>
          </div>
          {file.versions.length > 1 && (
            <details className="letter-history">
              <summary>{t.letter.history(file.versions.length)}</summary>
              <p className="hint">{t.letter.historyHint}</p>
              <ol>
                {[...file.versions].reverse().map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => openVersion(v)}
                      aria-current={v.id === current.id ? 'true' : undefined}
                    >
                      {formatDateTime(v.createdAt, t)} · {t.letter.sources[v.source] ?? v.source} · {v.language.toUpperCase()}
                    </button>
                    {v.id === current.id && <span className="hint"> ({t.letter.currentVersion})</span>}
                    <span className="version-preview">{v.text.slice(0, 120).replace(/\s+/g, ' ')}…</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </div>
  );
}
