// Display language: provider, hook and language detection.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

export function LanguageSelect() {
  const { lang, t, setLang } = useI18n();
  return (
    <label className="header-control">
      <span className="visually-hidden">{t.app.language}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t.app.language}>
        {Object.entries(LANGUAGES).map(([code, m]) => (
          <option key={code} value={code}>
            {m.langName}
          </option>
        ))}
      </select>
    </label>
  );
}
