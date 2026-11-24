// Floating buttons: "Back to top" once you've scrolled down, "Collapse all" while any card is open.
import { useEffect, useState } from 'react';
import { useT } from './i18n/index.tsx';

/** How far (px) to scroll before "Back to top" appears. */
export const SCROLL_THRESHOLD = 400;

function useScrolledDown(): boolean {
  const [down, setDown] = useState(() => window.scrollY > SCROLL_THRESHOLD);
  useEffect(() => {
    const onScroll = () => setDown(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return down;
}

export function PageTools({ expandedCount, onCollapseAll }: { expandedCount: number; onCollapseAll: () => void }) {
  const t = useT();
  const scrolledDown = useScrolledDown();
  if (!scrolledDown && expandedCount === 0) return null;

  const toTop = () => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <div className="page-tools">
      {expandedCount > 0 && (
        <button type="button" onClick={onCollapseAll}>
          {t.tools.collapseAll(expandedCount)}
        </button>
      )}
      {scrolledDown && (
        <button type="button" onClick={toTop}>
          {t.tools.backToTop}
        </button>
      )}
    </div>
  );
}
