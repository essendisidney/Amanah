import { AppLoader } from '@/components/app-loader';

export default function DashboardLoading() {
  return <AppLoader message="Preparing your dashboard…" variant="compact" showBrand={false} />;
}
