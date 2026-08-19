import { AppLoader } from '@/components/app-loader';

export default function CircleDetailsLoading() {
  return <AppLoader message="Opening circle details…" variant="compact" showBrand={false} />;
}
