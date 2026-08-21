'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { donateAction, type CharityActionState } from '../actions';

const initial: CharityActionState = { success: false, message: '' };

function extractReceipt(message: string): string | null {
  const match = message.match(/Receipt:\s*(AMA-[A-Z0-9-]+)/i) ?? message.match(/(AMA-[A-Z0-9-]+)/i);
  return match?.[1] ?? null;
}

export function DonateForm({
  campaignId,
  slug,
  currency,
  feeMode,
  feeBps,
}: {
  campaignId: string;
  slug: string;
  currency: string;
  feeMode: string;
  feeBps: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [state, action, pending] = useActionState(
    async (_prev: CharityActionState, formData: FormData) => donateAction(formData),
    initial,
  );

  const preview = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 10) return null;
    const fee = Math.round(((value * feeBps) / 10000) * 100) / 100;
    if (feeMode === 'donation_addon') {
      return {
        gift: value,
        fee,
        charged: value + fee,
        toCause: value,
      };
    }
    return {
      gift: value,
      fee,
      charged: value,
      toCause: Math.max(0, value - fee),
    };
  }, [amount, feeBps, feeMode]);

  useEffect(() => {
    if (!state.success) return;
    const code = state.receiptCode ?? extractReceipt(state.message);
    if (code) router.push(`/sadaka/receipt/${encodeURIComponent(code)}`);
  }, [state, router]);

  return (
    <form action={action} className="space-y-4 border border-border bg-card p-6">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="slug" value={slug} />
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Contribute</h2>
      <p className="text-sm text-muted-foreground">
        Your gift helps reach the target. When the goal is met, funds go to the beneficiary M-Pesa.
      </p>
      <div className="space-y-2">
        <Label htmlFor="amount">Amount ({currency})</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min="10"
          step="1"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      {preview ? (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {feeMode === 'donation_addon'
            ? `You pay ${preview.charged.toFixed(2)} (${preview.gift.toFixed(2)} gift + ${preview.fee.toFixed(2)} fee). Full ${preview.toCause.toFixed(2)} reaches the cause.`
            : `You pay ${preview.charged.toFixed(2)}. Fee ${preview.fee.toFixed(2)} is deducted; ${preview.toCause.toFixed(2)} reaches the cause.`}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="donorName">Name (optional)</Label>
        <Input id="donorName" name="donorName" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="donorPhone">Phone (optional)</Label>
        <Input id="donorPhone" name="donorPhone" type="tel" placeholder={KE_PHONE_PLACEHOLDER} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="donorEmail">Email (optional)</Label>
        <Input id="donorEmail" name="donorEmail" type="email" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="anonymous" type="checkbox" /> Give anonymously
      </label>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input name="feeAck" type="checkbox" required className="mt-1" />
        I understand the fee disclosure above before donating.
      </label>
      {state.message ? (
        <p className={`text-sm ${state.success ? 'text-primary' : 'text-destructive'}`}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Processing…' : 'Contribute'}
      </Button>
    </form>
  );
}
