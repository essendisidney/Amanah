import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { Button, Input, Label } from '@jamiya/ui';
import { tipFormAction } from '@/features/charity/actions';
import { getDictionary } from '@/i18n/get-dictionary';
import { LanguageSwitcher } from '@/i18n/language-switcher';

export const metadata: Metadata = {
  title: 'Support Amanah',
};

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const { locale, dict } = await getDictionary();
  const labels = dict.support;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8 sm:gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={'/dashboard' as Route}>{dict.common.backToDashboard}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={'/' as Route}>{dict.common.home}</Link>
        </Button>
        <LanguageSwitcher locale={locale} label={dict.common.language} />
      </div>

      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
        {labels.eyebrow}
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
        {labels.title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{labels.body}</p>
      <form
        action={tipFormAction}
        className="mt-10 max-w-md space-y-5 border border-border bg-card p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="amount">{labels.tipLabel}</Label>
          <Input id="amount" name="amount" type="number" min="10" step="10" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{labels.phoneOptional}</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+254712345678" />
        </div>
        <Button type="submit">{labels.submit}</Button>
      </form>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href={'/dashboard' as Route} className="text-accent underline-offset-4 hover:underline">
          ← {dict.common.backToDashboard}
        </Link>
      </p>
    </main>
  );
}
