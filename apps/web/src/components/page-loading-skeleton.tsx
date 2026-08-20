/** Lightweight route loading — no animations that can crash mobile browsers. */
export function PageLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 py-2" aria-hidden>
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-9 w-56 max-w-full rounded-md bg-muted" />
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-24 rounded-xl bg-muted" />
    </div>
  );
}
