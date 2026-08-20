import { Skeleton } from '@jamiya/ui';

/**
 * Quiet in-route placeholder — not the branded AppLoader.
 * Boot splash / top progress already cover the “opening” moment; repeating
 * the emblem loader here made loading feel like it ran twice.
 */
export function PageLoadingSkeleton({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="space-y-6 py-2" role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">{message}</p>
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-56 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}
