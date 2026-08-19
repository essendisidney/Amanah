import { AppLoader } from '@/components/app-loader';
import { DashboardSkeleton } from '@/features/dashboard';

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <AppLoader message="Preparing your dashboard…" variant="compact" showBrand={false} />
      <div className="amanah-skeleton-shimmer rounded-xl">
        <DashboardSkeleton />
      </div>
    </div>
  );
}
