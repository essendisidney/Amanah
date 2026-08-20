'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">Amanah</p>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Could not open this page
      </h1>
      <p className="text-sm text-muted-foreground">
        Refresh and try again. If you were signing in, go back to the phone screen.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
