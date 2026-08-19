import { AppLoader } from '@/components/app-loader';

export default function ProfileLoading() {
  return <AppLoader message="Loading your profile…" variant="compact" showBrand={false} />;
}
