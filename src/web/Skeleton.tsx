// Placeholders shown while something loads: grey shapes in the layout of what is coming, gently pulsing.
// The page doesn't jump when the content arrives, and the wait feels shorter. Screen readers get the text.

function Lines({ widths }: { widths: string[] }) {
  return (
    <>
      {widths.map((w, i) => (
        <span key={i} className="skeleton-line" style={{ width: w }} />
      ))}
    </>
  );
}

/** Result cards: logo square, title, company, details. */
export function ResultsSkeleton({ label, count = 5 }: { label: string; count?: number }) {
  return (
    <div className="skeleton" role="status">
      <span className="visually-hidden">{label}</span>
      <ol className="job-list" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="job-card skeleton-card">
            <div className="card-head">
              <span className="card-logo skeleton-block" />
              <div className="card-text">
                <Lines widths={[`${55 + ((i * 13) % 30)}%`, '35%', '50%']} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A block of text lines, e.g. a job ad or the profile form. */
export function TextSkeleton({ label, lines = 6 }: { label: string; lines?: number }) {
  return (
    <div className="skeleton skeleton-text" role="status">
      <span className="visually-hidden">{label}</span>
      <div aria-hidden="true">
        <Lines widths={Array.from({ length: lines }, (_, i) => (i % 4 === 3 ? '60%' : `${90 - ((i * 7) % 20)}%`))} />
      </div>
    </div>
  );
}
