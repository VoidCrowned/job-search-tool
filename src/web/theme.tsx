// Theme switch: System / Light / Dark. The choice lives in localStorage and as data-theme on <html>;
// index.html applies it before first paint, this component keeps it in sync afterwards.
import { useEffect, useState } from 'react';
import { useT } from './i18n/index.tsx';

export type Theme = 'system' | 'light' | 'dark';
export const THEMES: Theme[] = ['system', 'light', 'dark'];
const STORAGE_KEY = 'jobsuche:theme';

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage unavailable.
  }
  return 'system';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not saved; still applies for this visit.
  }
}

export function ThemeSelect() {
  const t = useT();
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => applyTheme(theme), [theme]);

  return (
    <label className="header-control">
      <span className="visually-hidden">{t.theme.label}</span>
      <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label={t.theme.label}>
        {THEMES.map((value) => (
          <option key={value} value={value}>
            {t.theme[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
