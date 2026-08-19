'use client';

import { usePathname } from 'next/navigation';
import { SadakaSiteHeader } from '@/components/sadaka-site-header';

export function SadakaSiteHeaderClient({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() || '';
  return <SadakaSiteHeader signedIn={signedIn} pathname={pathname} />;
}
