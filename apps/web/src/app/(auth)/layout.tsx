import type { Metadata } from 'next';
import { AmanahLogo } from '@/components/amanah-logo';
import { getDictionary } from '@/i18n/get-dictionary';
import { LanguageSwitcher } from '@/i18n/language-switcher';

export const metadata: Metadata = {
  title: 'Account',
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getDictionary();
  return (
    <div className="amanah-geo min-h-dvh bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[50vh] bg-[radial-gradient(ellipse_at_top,_rgba(91,141,239,0.08)_0%,_transparent_60%)]"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <div className="mb-10 flex items-center justify-between gap-3">
          <AmanahLogo href="/" size="lg" tone="brand" />
          <LanguageSwitcher locale={locale} label={dict.common.language} />
        </div>
        <div className="flex flex-1 items-start justify-center md:items-center">{children}</div>
      </div>
    </div>
  );
}
