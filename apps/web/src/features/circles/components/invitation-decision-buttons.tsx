'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { availablePayoutSlots, describePayoutSlot, formatCurrency } from '@jamiya/shared';
import { Alert, AlertDescription, Button, Label } from '@jamiya/ui';
import {
  acceptInvitationAction,
  declineInvitationAction,
} from '../actions/invitation-actions';
import type { CircleTermsView } from '../lib/circle-terms';
import { CircleTermsSummary } from './circle-terms-summary';

export type InviteSlotContext = {
  challengeKind: string | null;
  contributionAmount: number;
  currency: string;
  maxSlots: number;
  takenPositions: number[];
  slotPricingEnabled: boolean;
  earlySlotFeePct: number;
  lateSlotRebatePct: number;
};

export function InvitationDecisionButtons({
  token,
  disabled,
  slotContext,
  acceptLabel = 'Accept invitation',
  allowDecline = true,
  terms,
}: {
  token: string;
  disabled?: boolean;
  slotContext?: InviteSlotContext | null;
  acceptLabel?: string;
  /** Personal invites can be declined. A shared chama link cannot. */
  allowDecline?: boolean;
  /** The circle's fees and penalties; a member must accept them before any is charged. */
  terms?: CircleTermsView | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showSlots =
    slotContext &&
    (slotContext.challengeKind === 'rotating' || !slotContext.challengeKind);

  const openSlots = useMemo(() => {
    if (!slotContext) return [] as number[];
    return availablePayoutSlots(slotContext.maxSlots, slotContext.takenPositions);
  }, [slotContext]);

  const [slot, setSlot] = useState<number | ''>('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsVersion = terms?.ok && terms.terms ? terms.terms.version : null;
  const mustAcceptTerms = Boolean(terms?.ok && terms.has_charges);

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {showSlots && openSlots.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <Label htmlFor="payoutSlot">Choose your payout slot</Label>
          <p className="text-sm text-muted-foreground">
            Early slots get cash sooner (facilitation fee if enabled). Later slots save longer
            and may earn a rebate — not interest.
          </p>
          <select
            id="payoutSlot"
            value={slot === '' ? '' : String(slot)}
            onChange={(e) =>
              setSlot(e.target.value ? Number(e.target.value) : '')
            }
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Auto-assign next open slot</option>
            {openSlots.map((pos) => {
              const eco = describePayoutSlot({
                position: pos,
                maxSlots: slotContext!.maxSlots,
                contributionAmount: slotContext!.contributionAmount,
                slotPricingEnabled: slotContext!.slotPricingEnabled,
                earlySlotFeePct: slotContext!.earlySlotFeePct,
                lateSlotRebatePct: slotContext!.lateSlotRebatePct,
              });
              const money =
                eco.amount > 0
                  ? ` · ${formatCurrency(eco.amount, slotContext!.currency)}`
                  : '';
              return (
                <option key={pos} value={pos}>
                  #{pos} — {eco.label}
                  {money}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}

      {terms?.ok && terms.terms ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="font-semibold">Fees and penalties</p>
          <CircleTermsSummary terms={terms.terms} />
          {mustAcceptTerms ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I have read these fees and penalties and accept them. Nothing is charged
                without this.
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={disabled || pending || (mustAcceptTerms && !termsAccepted)}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await acceptInvitationAction(
                token,
                typeof slot === 'number' ? slot : null,
                !mustAcceptTerms || termsAccepted ? termsVersion : null,
              );
              if (!result.success) {
                setError(result.message ?? 'Accept failed');
                return;
              }
              setMessage(result.message ?? 'Joined');
              if (result.inviteUrl) {
                router.push(result.inviteUrl as Route);
                router.refresh();
              } else {
                router.push('/dashboard' as Route);
              }
            });
          }}
        >
          {pending ? 'Working…' : acceptLabel}
        </Button>
        {allowDecline ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await declineInvitationAction(token);
                if (!result.success) {
                  setError(result.message ?? 'Decline failed');
                  return;
                }
                setMessage(result.message ?? 'Declined');
                router.push('/dashboard' as Route);
                router.refresh();
              });
            }}
          >
            Decline
          </Button>
        ) : (
          <Button type="button" variant="outline" asChild>
            <Link href={'/dashboard' as Route}>Not now</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
