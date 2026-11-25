import type { ReactNode } from 'react';

/**
 * A button label that switches text without changing the button's size: every label takes up the same
 * grid cell, and only the one shown is visible. So the widest label sets the width.
 */
export function StableLabel({ labels, show }: { labels: ReactNode[]; show: number }) {
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
