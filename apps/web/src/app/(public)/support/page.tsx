import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { Button, Input, Label } from '@jamiya/ui';
import { KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { ChevronRight } from 'lucide-react';
import { tipFormAction } from '@/features/charity/actions';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Support Jameiyah',
};

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const { dict } = await getDictionary();
  const labels = dict.support;

  return (
    <main className="jameiyah-ambient min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">

        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {labels.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {labels.title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{labels.body}</p>
        </header>

        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">Voluntary tip</h2>
          <form action={tipFormAction} className="jameiyah-surface max-w-md space-y-3.5 px-4 py-4 sm:px-5">
            <div className="space-y-2">
              <Label htmlFor="amount">{labels.tipLabel}</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="10"
                step="10"
                required
                className="h-11 text-base sm:h-10 sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{labels.phoneOptional}</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder={KE_PHONE_PLACEHOLDER}
                className="h-11 text-base sm:h-10 sm:text-sm"
              />
            </div>
            <Button type="submit" className="min-h-11 w-full">
              {labels.submit}
            </Button>
          </form>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">Giving elsewhere?</h2>
          <ul className="jameiyah-surface divide-y divide-border/70">
            <li>
              <Link
                href={'/sadaka' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span>{dict.common.sadaka} campaigns</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                href={'/zakat' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span>Zakat calculator</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                href={'/help' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span>{dict.help.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
