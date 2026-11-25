// Theme switch: System / Light / Dark. The choice lives in localStorage and as data-theme on <html>;
// index.html applies it before first paint, this component keeps it in sync afterwards.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoonIcon, SunIcon, SystemIcon } from './icons.tsx';
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

const THEME_ICONS: Record<Theme, () => ReactNode> = { light: SunIcon, dark: MoonIcon, system: SystemIcon };
const THEME_ORDER: Theme[] = ['light', 'dark', 'system'];

/** Three icon buttons (light, dark, system) that work like radio buttons, arrow keys included. */
export function ThemeSelect() {
  const t = useT();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => applyTheme(theme), [theme]);

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + step + THEME_ORDER.length) % THEME_ORDER.length];
    setTheme(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-theme-option='${next}']`)?.focus();
  };

  return (
    <div className="theme-switch" role="radiogroup" aria-label={t.theme.label} ref={groupRef} onKeyDown={onKey}>
      {THEME_ORDER.map((value) => {
        const Icon = THEME_ICONS[value];
        const checked = value === theme;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t.theme[value]}
            title={t.theme[value]}
            tabIndex={checked ? 0 : -1}
            data-theme-option={value}
            onClick={() => setTheme(value)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
