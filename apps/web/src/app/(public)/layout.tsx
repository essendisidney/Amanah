import type { ReactNode } from 'react';
import { SiteFooter, SiteHeaderBand } from '@/components/site-chrome';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="jameiyah-light jameiyah-premium relative flex min-h-dvh flex-col overflow-x-hidden bg-[#f5f3ee] text-foreground">
      <SiteHeaderBand />
      <div className="relative flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
