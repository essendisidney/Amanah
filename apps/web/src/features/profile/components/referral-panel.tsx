'use client';

import { useActionState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';
import {
  applyReferralAction,
  syncPhoneFromAuthAction,
  type FinanceActionState,
} from '@/features/finance/actions';

const initial: FinanceActionState = { success: false, message: '' };

export function ReferralPanel({
  referralCode,
  referrals,
}: {
  referralCode: string | null;
  referrals: Array<{
    id: string;
    status: string;
    reward_amount: number | string;
    currency: string;
    created_at: string;
  }>;
}) {
  const [applyState, applyAction, applyPending] = useActionState(
    applyReferralAction,
    initial,
  );
  const [syncState, syncAction, syncPending] = useActionState(
    async (_prev: FinanceActionState, _formData: FormData) => syncPhoneFromAuthAction(),
    initial,
  );

  return (
    <section className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
        Referrals
      </h2>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <p className="text-sm text-muted-foreground">Your referral code</p>
          <p className="mt-1 font-mono text-lg font-semibold">{referralCode ?? '—'}</p>
          {referralCode ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void navigator.clipboard.writeText(referralCode)}
            >
              Copy code
            </Button>
          ) : null}
        </div>
        <form action={applyAction} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="referralCode">Apply someone’s code</Label>
            <Input id="referralCode" name="referralCode" placeholder="ABC12345" />
          </div>
          <Button type="submit" size="sm" disabled={applyPending}>
            {applyPending ? 'Applying…' : 'Apply'}
          </Button>
        </form>
        {applyState.message ? (
          <p className={`text-sm ${applyState.success ? 'text-primary' : 'text-destructive'}`}>
            {applyState.message}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Referral qualifies after your first paid contribution. Rewards are marked by admin.
        </p>
        {referrals.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border">
            {referrals.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-3 text-sm">
                <span className="capitalize">{row.status}</span>
                <span className="text-muted-foreground">
                  {row.reward_amount} {row.currency}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <form action={syncAction}>
        <Button type="submit" variant="outline" size="sm" disabled={syncPending}>
          {syncPending ? 'Syncing…' : 'Sync verified phone from sign-in'}
        </Button>
        {syncState.message ? (
          <p className={`mt-2 text-sm ${syncState.success ? 'text-primary' : 'text-destructive'}`}>
            {syncState.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
