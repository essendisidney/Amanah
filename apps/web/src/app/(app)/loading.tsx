import { PageLoadingSkeleton } from '@/components/page-loading-skeleton';

// Sections without their own loading screen (admin, finance, notifications, services, help…)
// show this instead of a blank page while the server renders.
export default function AppLoading() {
  return <PageLoadingSkeleton />;
}
