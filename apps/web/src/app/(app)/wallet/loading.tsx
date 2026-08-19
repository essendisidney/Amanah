import { AppLoader } from '@/components/app-loader';

export default function WalletLoading() {
  return <AppLoader message="Loading your wallet…" variant="compact" showBrand={false} />;
}
