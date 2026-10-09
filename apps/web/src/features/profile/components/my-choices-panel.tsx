'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Alert, AlertDescription, Button } from '@jamiya/ui';
import {
  setNotificationPreferenceAction,
  setPlanAutoRenewAction,
  setSponsorshipStatusAction,
} from '../actions/choice-actions';
import type { ProfileActionState } from '../lib/state';
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  describeChoice,
  sponsorshipStatusLabel,
  type MyChoices,
  type NotificationCategory,
} from '../lib/my-choices';

/** Everything a member has opted into, with a switch to opt out (or back in). */
export function MyChoicesPanel({ choices }: { choices: MyChoices }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const act = (fn: () => Promise<ProfileActionState>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      setMessage({ ok: result.success, text: result.message ?? '' });
      router.refresh();
    });
  };

  const categories = Object.keys(CATEGORY_LABELS) as NotificationCategory[];

  return (
    <div className="space-y-5">
      {message ? (
        <Alert variant={message.ok ? 'success' : 'destructive'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <section className="jameiyah-surface space-y-4 px-5 py-5">
        <div>
          <h2 className="text-lg font-semibold">Messages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how we reach you. Receipts, security alerts, verification updates and circle
            decisions are always sent, and everything stays in your in-app inbox.
          </p>
        </div>
        {categories.map((category) => (
          <div key={category} className="space-y-2">
            <div>
              <p className="font-medium">{CATEGORY_LABELS[category].title}</p>
              <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[category].hint}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {choices.notifications
                .filter((n) => n.category === category)
                .map((n) => (
                  <Button
                    key={n.channel}
                    type="button"
                    size="sm"
                    variant={n.enabled ? 'default' : 'outline'}
                    aria-pressed={n.enabled}
                    disabled={pending}
                    onClick={() =>
                      act(() => setNotificationPreferenceAction(category, n.channel, !n.enabled))
                    }
                  >
                    {CHANNEL_LABELS[n.channel]}: {n.enabled ? 'On' : 'Off'}
                  </Button>
                ))}
            </div>
          </div>
        ))}
      </section>

      <section className="jameiyah-surface space-y-3 px-5 py-5">
        <div>
          <h2 className="text-lg font-semibold">Circle fees and terms you accepted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No circle fee is charged until you accept it. When fees change, you keep your old terms
            until you accept the new ones.
          </p>
        </div>
        {choices.circle_terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are not in any circle yet.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {choices.circle_terms.map((c) => (
              <li key={c.jamiya_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.accepted_at
                      ? `Accepted version ${c.accepted_version} on ${formatDate(c.accepted_at)}`
                      : 'Not accepted yet'}
                  </p>
                </div>
                {c.up_to_date ? (
                  <span className="text-xs font-medium text-muted-foreground">Up to date</span>
                ) : (
                  <Link
                    href={`/circles/${c.slug}` as Route}
                    className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Review new terms
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {choices.sponsorships.length > 0 ? (
        <section className="jameiyah-surface space-y-3 px-5 py-5">
          <div>
            <h2 className="text-lg font-semibold">Monthly sponsorships</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pause any time and resume later; you are not charged for the paused months. A charge
              already sent to your phone can still be approved or declined there.
            </p>
          </div>
          <ul className="divide-y divide-border/70">
            {choices.sponsorships.map((s) => (
              <li key={s.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(Number(s.monthly_amount), s.currency)} a month ·{' '}
                    {sponsorshipStatusLabel(s.status)}
                    {s.status === 'active' ? ` · next ${formatDate(s.next_charge_date)}` : ''}
                  </p>
                </div>
                {s.status !== 'cancelled' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        act(() =>
                          setSponsorshipStatusAction(s.id, s.status === 'active' ? 'paused' : 'active'),
                        )
                      }
                    >
                      {s.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm('Stop this sponsorship? You cannot restart it later.')) {
                          act(() => setSponsorshipStatusAction(s.id, 'cancelled'));
                        }
                      }}
                    >
                      Stop
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {choices.circle_plans.length > 0 ? (
        <section className="jameiyah-surface space-y-3 px-5 py-5">
          <div>
            <h2 className="text-lg font-semibold">Circle plans you manage</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A paid plan renews every 30 days from the wallet of the circle’s lead officer. Turn
              auto-renew off and it ends on its renewal date instead.
            </p>
          </div>
          <ul className="divide-y divide-border/70">
            {choices.circle_plans.map((p) => (
              <li key={p.jamiya_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.name}: {p.plan_name} ({formatCurrency(Number(p.price_kes), 'KES')})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.status === 'cancelled'
                      ? 'Ended'
                      : p.renews_at
                        ? `${p.auto_renew ? 'Renews' : 'Ends'} on ${formatDate(p.renews_at)}`
                        : p.status.replaceAll('_', ' ')}
                  </p>
                </div>
                {p.status !== 'cancelled' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={p.auto_renew ? 'default' : 'outline'}
                    aria-pressed={p.auto_renew}
                    disabled={pending}
                    onClick={() => act(() => setPlanAutoRenewAction(p.jamiya_id, !p.auto_renew))}
                  >
                    Auto-renew: {p.auto_renew ? 'On' : 'Off'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="jameiyah-surface space-y-3 px-5 py-5">
        <h2 className="text-lg font-semibold">Your choices so far</h2>
        {choices.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {choices.history.map((e, i) => (
              <li key={`${e.subject}-${e.created_at}-${i}`} className="flex flex-wrap justify-between gap-2">
                <span>{describeChoice(e)}</span>
                <span className="text-muted-foreground">{formatDate(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
