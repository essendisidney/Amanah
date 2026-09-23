import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { ChevronRight } from 'lucide-react';
import { AppPage, PageHeader } from '@/components/app-page';
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

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.circleTitle}</h2>
        <div className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
          <p className="text-sm text-muted-foreground">{labels.circleBody}</p>
          <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
            <Link href={'/circles' as Route}>{labels.openCircles}</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.accountTitle}</h2>
        <div className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
          <p className="text-sm text-muted-foreground">{labels.accountBody}</p>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
            <li>
              <Link
                href={'/profile' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-3.5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span>{labels.openProfile}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                href={'/wallet?focus=top-up#top-up' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-3.5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span>{labels.openMoney}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {contact.hasDirectChannel ? (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{labels.contactTitle}</h2>
          <div className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
            <p className="text-sm text-muted-foreground">{labels.contactBody}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {contact.mailtoHref && contact.email ? (
                <Button asChild className="min-h-11 w-full">
                  <a href={contact.mailtoHref}>{contact.email}</a>
                </Button>
              ) : null}
              {contact.whatsappHref ? (
                <Button asChild variant="outline" className="min-h-11 w-full">
                  <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer">
                    {labels.openWhatsapp}
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.faqTitle}</h2>
        <ul className="amanah-surface divide-y divide-border/70">
          <li className="space-y-1 px-4 py-4 sm:px-5">
            <p className="text-sm font-semibold text-foreground">{labels.faqShariahQ}</p>
            <p className="text-sm text-muted-foreground">{labels.faqShariahA}</p>
          </li>
          <li className="space-y-1 px-4 py-4 sm:px-5">
            <p className="text-sm font-semibold text-foreground">{labels.faqFeesQ}</p>
            <p className="text-sm text-muted-foreground">{labels.faqFeesA}</p>
          </li>
          <li className="space-y-1 px-4 py-4 sm:px-5">
            <p className="text-sm font-semibold text-foreground">{labels.faqRibaQ}</p>
            <p className="text-sm text-muted-foreground">{labels.faqRibaA}</p>
          </li>
        </ul>
        <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
          <Link href={'/shariah' as Route}>{labels.openShariah}</Link>
        </Button>
      </section>

      <section id="ticket" className="scroll-mt-24 space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.ticketTitle}</h2>
        <div className="amanah-surface px-4 py-4 sm:px-5">
          <SupportTicketForm
            labels={{
              ticketTitle: labels.ticketTitle,
              ticketBody: labels.ticketBody,
              subjectLabel: labels.ticketSubject,
              messageLabel: labels.ticketMessage,
              submit: labels.ticketSubmit,
              submitting: labels.ticketSubmitting,
            }}
            hideTitle
          />
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.webTitle}</h2>
        <div className="amanah-surface space-y-2 px-4 py-4 sm:px-5">
          <p className="text-sm text-muted-foreground">{labels.webBody}</p>
          <p className="text-sm font-semibold text-foreground">jameiyah.com</p>
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.tipTitle}</h2>
        <div className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
          <p className="text-sm text-muted-foreground">{labels.tipBody}</p>
          <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
            <Link href={'/support' as Route}>{labels.openTip}</Link>
          </Button>
        </div>
      </section>
    </AppPage>
  );
}
