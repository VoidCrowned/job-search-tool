// Display language: provider, hook and language detection.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { FlagDE, FlagES, FlagGB } from '../icons.tsx';
import { de } from './de.ts';
import { en, type Messages } from './en.ts';
import { es } from './es.ts';

export const LANGUAGES = { en, de, es } satisfies Record<string, Messages>;
export type Lang = keyof typeof LANGUAGES;
export type { Messages };

const STORAGE_KEY = 'jobsuche:lang';

function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && v in LANGUAGES;
}

/** Saved choice first, then the browser's preferred languages, then English. */
export function detectLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // Storage unavailable: fall through.
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.slice(0, 2).toLowerCase();
    if (isLang(base)) return base;
  }
  return 'en';
}

interface I18n {
  lang: Lang;
  t: Messages;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18n>({ lang: 'en', t: en, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved; still switches for this visit.
    }
  };

  return <I18nContext.Provider value={{ lang, t: LANGUAGES[lang], setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}

/** Shortcut for the current language's messages. */
export function useT(): Messages {
  return useContext(I18nContext).t;
}

const FLAGS: Record<Lang, () => ReactNode> = { de: FlagDE, en: FlagGB, es: FlagES };
const ORDER: Lang[] = ['de', 'en', 'es'];

/**
 * Language switch: a button with flag and name that opens a short list. A native <select> can't show images
 * in its options, so this is a small listbox (arrow keys, Enter, Escape, click outside all work).
 */
export function LanguageSelect() {
  const { lang, t, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(lang);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const Flag = FLAGS[lang];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openList = () => {
    setActive(lang);
    setOpen(true);
  };
  const choose = (next: Lang) => {
    setLang(next);
    setOpen(false);
    buttonRef.current?.focus();
  };
  const onListKey = (e: React.KeyboardEvent) => {
    const i = ORDER.indexOf(active);
    if (e.key === 'ArrowDown') setActive(ORDER[(i + 1) % ORDER.length]);
    else if (e.key === 'ArrowUp') setActive(ORDER[(i + ORDER.length - 1) % ORDER.length]);
    else if (e.key === 'Home') setActive(ORDER[0]);
    else if (e.key === 'End') setActive(ORDER[ORDER.length - 1]);
    else if (e.key === 'Enter' || e.key === ' ') choose(active);
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      if (e.key === 'Escape') buttonRef.current?.focus();
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div className="lang-select" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="switch-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t.app.language}: ${LANGUAGES[lang].langName}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
      >
        <Flag />
        <span>{LANGUAGES[lang].langName}</span>
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul
          ref={listRef}
          className="lang-list"
          role="listbox"
          tabIndex={-1}
          aria-label={t.app.language}
          aria-activedescendant={`lang-option-${active}`}
          onKeyDown={onListKey}
        >
          {ORDER.map((code) => {
            const OptionFlag = FLAGS[code];
            return (
              <li
                key={code}
                id={`lang-option-${code}`}
                role="option"
                aria-selected={code === lang}
                className={code === active ? 'active' : undefined}
                onMouseEnter={() => setActive(code)}
                onClick={() => choose(code)}
                lang={code}
              >
                <OptionFlag />
                <span>{LANGUAGES[code].langName}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
