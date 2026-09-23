import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { AppPage, PageCard, PageHeader } from '@/components/app-page';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Help & support',
};

export const dynamic = 'force-dynamic';

/**
 * Member help — no invented phone/email. Verified public channels only:
 * jameiyah.com (footer / company site) and in-app surfaces officers already use.
 */
export default async function HelpPage() {
  const { dict } = await getDictionary();
  const labels = dict.help;

  return (
    <AppPage width="medium">
      <PageHeader title={labels.title} subtitle={labels.subtitle} />

      <PageCard className="space-y-3">
        <h2 className="text-base font-semibold">{labels.circleTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.circleBody}</p>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href={'/circles' as Route}>{labels.openCircles}</Link>
        </Button>
      </PageCard>

      <PageCard className="space-y-3">
        <h2 className="text-base font-semibold">{labels.accountTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.accountBody}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={'/profile' as Route}>{labels.openProfile}</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={'/wallet' as Route}>{labels.openMoney}</Link>
          </Button>
        </div>
      </PageCard>

      <PageCard className="space-y-3">
        <h2 className="text-base font-semibold">{labels.webTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.webBody}</p>
        <p className="text-sm font-medium text-foreground">jameiyah.com</p>
      </PageCard>

      <PageCard className="space-y-3">
        <h2 className="text-base font-semibold">{labels.tipTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.tipBody}</p>
        <Button asChild size="sm" className="rounded-full">
          <Link href={'/support' as Route}>{labels.openTip}</Link>
        </Button>
      </PageCard>
    </AppPage>
  );
}
