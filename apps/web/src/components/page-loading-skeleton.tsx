import { AppLoader } from '@/components/app-loader';

/** Soft branded loader while a route is fetching. */
export function PageLoadingSkeleton({ message = 'Loading…' }: { message?: string }) {
  return <AppLoader message={message} variant="compact" showBrand={false} />;
}
