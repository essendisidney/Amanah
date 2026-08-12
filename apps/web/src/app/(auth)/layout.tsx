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
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#d1fae5_0%,_transparent_50%),linear-gradient(180deg,_#fbfcfa_0%,_#eef5f0_100%)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8">
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-primary"
          >
            {APP_NAME}
          </Link>
          <LanguageSwitcher locale={locale} label={dict.common.language} />
        </div>
        <div className="flex flex-1 items-start justify-center md:items-center">{children}</div>
      </div>
    </div>
  );
}
