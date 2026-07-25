import { Skeleton } from '@jamiya/ui';

export function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-3 border-b border-border/70 pb-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-80 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
