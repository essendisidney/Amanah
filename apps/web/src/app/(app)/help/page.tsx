import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { AppPage, PageCard, PageHeader } from '@/components/app-page';
import { getDictionary } from '@/i18n/get-dictionary';
import { getSupportContact } from '@/lib/support-contact';
import { SupportTicketForm } from '@/features/help/components/support-ticket-form';

export const metadata: Metadata = {
  title: 'Help & support',
};

export const dynamic = 'force-dynamic';

/**
 * Member help. Direct contact only when NEXT_PUBLIC_SUPPORT_* is set.
 * Otherwise the in-app support ticket is the verified channel.
 */
export default async function HelpPage() {
  const { dict } = await getDictionary();
  const labels = dict.help;
  const contact = getSupportContact();

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
            <Link href={'/wallet?focus=top-up#top-up' as Route}>{labels.openMoney}</Link>
          </Button>
        </div>
      </PageCard>

      {contact.hasDirectChannel ? (
        <PageCard className="space-y-3">
          <h2 className="text-base font-semibold">{labels.contactTitle}</h2>
          <p className="text-sm text-muted-foreground">{labels.contactBody}</p>
          <div className="flex flex-wrap gap-2">
            {contact.mailtoHref && contact.email ? (
              <Button asChild size="sm" className="rounded-full">
                <a href={contact.mailtoHref}>{contact.email}</a>
              </Button>
            ) : null}
            {contact.whatsappHref ? (
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer">
                  {labels.openWhatsapp}
                </a>
              </Button>
            ) : null}
          </div>
        </PageCard>
      ) : null}

      <PageCard id="ticket" className="scroll-mt-24 space-y-3">
        <SupportTicketForm
          labels={{
            ticketTitle: labels.ticketTitle,
            ticketBody: labels.ticketBody,
            subjectLabel: labels.ticketSubject,
            messageLabel: labels.ticketMessage,
            submit: labels.ticketSubmit,
            submitting: labels.ticketSubmitting,
          }}
        />
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
