import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeaderBand } from '@/components/site-chrome';

export const metadata: Metadata = {
  title: 'Account',
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="jameiyah-light jameiyah-premium flex min-h-dvh flex-col bg-[#f5f3ee] text-foreground">
      <SiteHeaderBand />
      <div className="relative flex-1 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[420px] w-[420px] rounded-full bg-[#D8A038]/10 blur-[110px]" />
        <div aria-hidden className="pointer-events-none absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full bg-[#004038]/10 blur-[110px]" />
        <div className="relative mx-auto flex w-full max-w-6xl justify-center px-4 py-10 sm:px-6 sm:py-16">{children}</div>
      </div>
    </div>
  );
}
