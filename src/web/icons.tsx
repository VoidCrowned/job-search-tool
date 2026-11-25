// Small inline images: flags for the language switch (Windows shows flag emojis as two letters, so these are
// drawn here) and icons for the theme switch. All decorative: the text next to them or the button's label
// carries the meaning.

const flag = { width: 20, height: 14, 'aria-hidden': true, focusable: false, className: 'flag' } as const;

export function FlagDE() {
  return (
    <svg {...flag} viewBox="0 0 5 3">
      <rect width="5" height="1" y="0" fill="#000" />
      <rect width="5" height="1" y="1" fill="#D00" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  );
}

/** Union flag (the English texts are British English). */
export function FlagGB() {
  return (
    <svg {...flag} viewBox="0 0 60 30">
      <clipPath id="flag-gb-clip">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#flag-gb-clip)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

/** Spain's flag, simplified (without the coat of arms, which is unreadable at this size). */
export function FlagES() {
  return (
    <svg {...flag} viewBox="0 0 4 3">
      <rect width="4" height="3" fill="#AA151B" />
      <rect width="4" height="1.5" y="0.75" fill="#F1BF00" />
    </svg>
  );
}

const icon = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export function SunIcon() {
  return (
    <svg {...icon}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg {...icon}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** "Follow the system": a screen. */
export function SystemIcon() {
  return (
    <svg {...icon}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...icon} width={16} height={16} strokeWidth={2.5}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
