import { AppLoader } from '@/components/app-loader';

export default function CirclesLoading() {
  return <AppLoader message="Gathering your circles…" variant="compact" showBrand={false} />;
}
