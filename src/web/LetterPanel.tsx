// "Write application" section on the job page: generate a letter, edit it, save it, copy it.
import { useEffect, useRef, useState } from 'react';
import { PLACEHOLDER, type LanguageChoice, type LetterFile, type LetterVersion } from '../shared/letter.ts';
import { isProfileEmpty, type Profile } from '../shared/profile.ts';
import { errorText, getJson, RequestError, sendJson } from './api.ts';
import { AtsChecklist } from './AtsChecklist.tsx';
import { formatDateTime } from './format.ts';
import { useT } from './i18n/index.tsx';
import { onLinkClick } from './router.ts';

export const LETTER_ANCHOR = 'letter';

interface AiConfig {
  ai: boolean;
  model?: string;
  provider?: 'anthropic' | 'openrouter';
}

interface Loaded {
  file: LetterFile;
  profile: Profile;
  config: AiConfig;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; mode?: 'ai' | 'template'; regenerate?: boolean }
  | { kind: 'saved' }
  | { kind: 'copied' }
  | { kind: 'copyFailed' }
  | { kind: 'error'; error: RequestError };

/** Edits don't carry keywords themselves; reuse the newest ones Claude found for this job. */
function latestKeywords(file: LetterFile): string[] | undefined {
  return [...file.versions].reverse().find((v) => v.adKeywords?.length)?.adKeywords;
}

/** The generated letter a version came from: itself, or for an edit the newest generated version before it. */
function generatedSource(file: LetterFile, version: LetterVersion): LetterVersion | undefined {
  if (version.source !== 'edit') return version;
  // Match by id: after a save, the version and the file's list come from separate JSON objects.
  const index = file.versions.findIndex((v) => v.id === version.id);
  return file.versions.slice(0, index + 1).reverse().find((v) => v.source !== 'edit');
}

/** Notes on what Claude left out. An edited version shows the notes of the generated letter it came from. */
export function notesFor(file: LetterFile, version: LetterVersion): string[] {
  return generatedSource(file, version)?.missing ?? [];
}

/** Points already confirmed for the letter a version came from; kept for every later regeneration. */
function confirmedFor(file: LetterFile, version: LetterVersion): string[] {
  return generatedSource(file, version)?.confirmed ?? [];
}

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
        const [file, profile, config] = await Promise.all([
          getJson<LetterFile>(`/api/letters/${encodeURIComponent(refnr)}`),
          getJson<Profile>('/api/profile'),
          getJson<AiConfig>('/api/config'),
        ]);
        if (!Array.isArray(file?.versions)) throw new RequestError(500, 'Unexpected answer from the server.');
        if (!active) return;
        setLoaded({ file, profile, config });
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
      {open && loaded && 'file' in loaded && <LetterEditor refnr={refnr} initial={loaded.file} profile={loaded.profile} config={loaded.config} />}
    </section>
  );
}

function LetterEditor({ refnr, initial, profile, config }: { refnr: string; initial: LetterFile; profile: Profile; config: AiConfig }) {
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
  const notes = current ? notesFor(file, current) : [];
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  // A different version on screen starts with nothing ticked.
  const [tickedFor, setTickedFor] = useState(current?.id);
  if (current?.id !== tickedFor) {
    setTickedFor(current?.id);
    setTicked(new Set());
  }
  const toggleNote = (note: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(note)) next.add(note);
      return next;
    });
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

  async function generate(mode: 'ai' | 'template', regenerate = false) {
    if (dirty && !window.confirm(t.letter.replaceConfirm)) return;
    setStatus({ kind: 'working', mode, regenerate });
    // Regenerate: same language as the letter on screen, plus everything confirmed so far and now ticked.
    const body =
      regenerate && current
        ? { language: current.language, mode, confirmed: [...new Set([...confirmedFor(file, current), ...notes.filter((n) => ticked.has(n))])] }
        : { language, mode };
    try {
      show(await sendJson('POST', `${url}/generate`, body), { kind: 'idle' });
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
        {config.ai && (
          <button type="button" className="primary" onClick={() => generate('ai')} disabled={status.kind === 'working'}>
            {status.kind === 'working' && status.mode === 'ai' && !status.regenerate ? t.letter.working : t.letter.writeWithClaude}
          </button>
        )}
        <button
          type="button"
          className={config.ai ? 'button' : 'primary'}
          onClick={() => generate('template')}
          disabled={status.kind === 'working'}
        >
          {status.kind === 'working' && status.mode === 'template' ? t.letter.working : t.letter.fillTemplate}
        </button>
      </div>
      {config.ai ? (
        <p className="hint">
          {t.letter.aiHint(
            config.provider === 'openrouter' ? t.letter.viaOpenRouter(config.model ?? 'Claude') : (config.model ?? 'Claude'),
          )}
        </p>
      ) : (
        <p className="hint">
          {t.letter.templateHint} {t.letter.keyHint}
        </p>
      )}
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
          {(placeholders > 0 || notes.length > 0) && (
            <div className="notice letter-notes">
              {placeholders > 0 && <p>{t.letter.placeholdersLeft(placeholders)}</p>}
              {notes.length > 0 && config.ai && (
                <>
                  <p>{t.letter.leftOutTick}</p>
                  <ul className="note-checks">
                    {notes.map((note) => (
                      <li key={note}>
                        <label className="check">
                          <input type="checkbox" checked={ticked.has(note)} onChange={() => toggleNote(note)} />
                          {note}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="button"
                    onClick={() => generate('ai', true)}
                    disabled={ticked.size === 0 || status.kind === 'working'}
                  >
                    {status.kind === 'working' && status.regenerate ? t.letter.working : t.letter.regenerate}
                  </button>
                </>
              )}
              {notes.length > 0 && !config.ai && (
                <>
                  <p>{t.letter.leftOut}</p>
                  <ul>
                    {notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
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
          <AtsChecklist
            text={text}
            jobTitle={file.jobTitle}
            company={file.company}
            keywords={current.adKeywords ?? latestKeywords(file)}
          />
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
