import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@jamiya/shared';
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
        className="pointer-events-none absolute inset-x-0 top-0 h-[50vh] bg-[radial-gradient(ellipse_at_top,_rgba(11,92,66,0.12)_0%,_transparent_60%)]"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-bold tracking-tight text-primary">
            {APP_NAME}
          </Link>
          <LanguageSwitcher locale={locale} label={dict.common.language} />
        </div>
        <div className="flex flex-1 items-start justify-center md:items-center">{children}</div>
      </div>
    </div>
  );
}
