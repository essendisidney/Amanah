'use client';

import { useActionState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import type { Route } from 'next';
import {
  DEFAULT_CURRENCY,
  JAMIYA_CONSTRAINTS,
  SUPPORTED_CURRENCIES,
  createCircleSchema,
  type CreateCircleInput,
} from '@jamiya/shared';
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
  Textarea,
} from '@jamiya/ui';
import {
  createCircleAction,
} from '../actions/create-circle';
import { initialCreateCircleState } from '../lib/create-circle-state';

type FormValues = Omit<CreateCircleInput, 'maxMembers' | 'cycleCount'> & {
  maxMembers?: number;
  cycleCount?: number;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function CreateCircleForm({
  defaultSegment = 'general',
  segmentHint,
}: {
  defaultSegment?: 'general' | 'womens_circle' | 'boda_stage';
  segmentHint?: string | null;
} = {}) {
  const [state, formAction] = useActionState(createCircleAction, initialCreateCircleState);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(createCircleSchema),
    defaultValues: {
      name: '',
      description: '',
      contributionAmount: 5000,
      currency: DEFAULT_CURRENCY,
      maxMembers: undefined,
      cycleCount: undefined,
      contributionFrequencyDays: 30,
      startDate: '',
      status: 'open',
      segment: defaultSegment,
      challengeKind: 'savings',
      joinFeeAmount: 0,
      transactionFeeAmount: 0,
      gracePeriodDays: 3,
      slotPricingEnabled: false,
      earlySlotFeePct: 0,
      lateSlotRebatePct: 0,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const challengeKind = watch('challengeKind');
  const slotPricingEnabled = watch('slotPricingEnabled');

  const setChallengeKind = (kind: 'rotating' | 'savings' | 'share_dividend') => {
    setValue('challengeKind', kind, { shouldDirty: true, shouldValidate: true });
    if (kind !== 'rotating') {
      setValue('slotPricingEnabled', false);
      setValue('earlySlotFeePct', 0);
      setValue('lateSlotRebatePct', 0);
    }
  };

  const applyTemplate = (key: 'sisters' | 'school' | 'wedding' | 'boda' | 'table') => {
    if (key === 'sisters') {
      setValue('name', 'Sisters Circle');
      setValue('segment', 'womens_circle');
      setChallengeKind('rotating');
      setValue('contributionAmount', 2000);
      setValue('contributionFrequencyDays', 30);
      setValue('cycleCount', 10);
      setValue('maxMembers', 10);
      setValue('slotPricingEnabled', true);
      setValue('earlySlotFeePct', 5);
      setValue('lateSlotRebatePct', 3);
      setValue(
        'description',
        'Women’s rotating chama — pick your payout month, contribute monthly, books stay transparent.',
      );
    } else if (key === 'school') {
      setValue('name', 'School Fees Chama');
      setValue('segment', 'womens_circle');
      setChallengeKind('rotating');
      setValue('contributionAmount', 5000);
      setValue('contributionFrequencyDays', 30);
      setValue('cycleCount', 12);
      setValue('maxMembers', 12);
      setValue('slotPricingEnabled', false);
      setValue(
        'description',
        'Save together for school fees — each member takes a payout turn for term fees.',
      );
    } else if (key === 'wedding') {
      setValue('name', 'Wedding Savings Circle');
      setValue('segment', 'womens_circle');
      setChallengeKind('savings');
      setValue('contributionAmount', 3000);
      setValue('contributionFrequencyDays', 30);
      setValue('cycleCount', undefined);
      setValue('maxMembers', undefined);
      setValue('slotPricingEnabled', false);
      setValue(
        'description',
        'Group savings toward a wedding or nikah — link a goal after you create the circle.',
      );
    } else if (key === 'table') {
      setValue('name', 'Table Banking Chama');
      setValue('segment', 'general');
      setChallengeKind('share_dividend');
      setValue('contributionAmount', 2000);
      setValue('contributionFrequencyDays', 30);
      setValue('cycleCount', undefined);
      setValue('maxMembers', undefined);
      setValue('slotPricingEnabled', false);
      setValue(
        'description',
        'Share capital, monthly savings, and member loans — table banking style books.',
      );
    } else {
      setValue('name', 'Boda Stage Chama');
      setValue('segment', 'boda_stage');
      setChallengeKind('rotating');
      setValue('contributionAmount', 1000);
      setValue('contributionFrequencyDays', 7);
      setValue('cycleCount', 8);
      setValue('maxMembers', 8);
      setValue('slotPricingEnabled', false);
      setValue('description', 'Weekly stage merry-go-round for riders.');
    }
  };

  const onValid = (values: FormValues) => {
    const fd = new FormData();
    fd.set('name', values.name);
    fd.set('description', values.description ?? '');
    fd.set('contributionAmount', String(values.contributionAmount));
    fd.set('currency', values.currency);
    if (values.maxMembers != null && Number.isFinite(values.maxMembers)) {
      fd.set('maxMembers', String(values.maxMembers));
    }
    if (values.cycleCount != null) {
      fd.set('cycleCount', String(values.cycleCount));
    }
    fd.set('contributionFrequencyDays', String(values.contributionFrequencyDays));
    fd.set('startDate', values.startDate ?? '');
    fd.set('status', values.status);
    fd.set('segment', values.segment);
    fd.set('challengeKind', values.challengeKind ?? 'savings');
    fd.set('joinFeeAmount', String(values.joinFeeAmount ?? 0));
    fd.set('transactionFeeAmount', String(values.transactionFeeAmount ?? 0));
    fd.set('gracePeriodDays', String(values.gracePeriodDays ?? 3));
    fd.set('slotPricingEnabled', values.slotPricingEnabled ? 'true' : 'false');
    fd.set('earlySlotFeePct', String(values.earlySlotFeePct ?? 0));
    fd.set('lateSlotRebatePct', String(values.lateSlotRebatePct ?? 0));

    startTransition(() => {
      formAction(fd);
    });
  };

  const fieldError = (name: keyof FormValues) =>
    errors[name]?.message ?? state.fieldErrors?.[name]?.[0];

  return (
    <div className="space-y-6">
      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onValid)} className="space-y-6" noValidate>
        <div className="space-y-3">
          <div>
            <Label>How will this circle work?</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick one first. Templates below fill amounts and cadence — they will not hide this
              choice.
            </p>
          </div>
          <input type="hidden" {...register('challengeKind')} />
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  value: 'rotating' as const,
                  title: 'Merry-go-round',
                  hint: 'Monthly contributions · payout slots · who gets the pot',
                },
                {
                  value: 'share_dividend' as const,
                  title: 'Table banking',
                  hint: 'Share capital · monthly savings grid · loans',
                },
                {
                  value: 'savings' as const,
                  title: 'Savings',
                  hint: 'Contribution calendar · goals · no rotating pot',
                },
              ] as const
            ).map((card) => {
              const selected = challengeKind === card.value;
              return (
                <button
                  key={card.value}
                  type="button"
                  onClick={() => setChallengeKind(card.value)}
                  className={[
                    'rounded-xl border px-4 py-4 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-background hover:border-primary/40',
                  ].join(' ')}
                >
                  <p className="text-sm font-semibold text-foreground">{card.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                  {selected ? (
                    <p className="mt-2 text-xs font-semibold text-primary">Selected</p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <FieldError message={fieldError('challengeKind')} />
        </div>

        <div className="space-y-2">
          <Label>Quick templates</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['sisters', 'Sisters (merry-go-round)'],
                ['school', 'School fees (merry-go-round)'],
                ['table', 'Table banking'],
                ['wedding', 'Wedding (savings)'],
                ['boda', 'Boda weekly (merry-go-round)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyTemplate(key)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Templates set name, amount, and cadence — and update the circle type cards above so you
            always see what you are creating.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Circle name</Label>
          <Input
            id="name"
            placeholder="e.g. Nairobi Sisters Circle"
            autoComplete="off"
            {...register('name')}
          />
          <FieldError message={fieldError('name')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            placeholder="Purpose, membership expectations, and payout customs…"
            {...register('description')}
          />
          <FieldError message={fieldError('description')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contributionAmount">Contribution amount</Label>
            <Input
              id="contributionAmount"
              type="number"
              inputMode="decimal"
              min={JAMIYA_CONSTRAINTS.minContributionAmount}
              step="1"
              {...register('contributionAmount')}
            />
            <FieldError message={fieldError('contributionAmount')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('currency')}
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <FieldError message={fieldError('currency')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxMembers">Maximum members (optional)</Label>
            <Input
              id="maxMembers"
              type="number"
              min={JAMIYA_CONSTRAINTS.minMembers}
              max={JAMIYA_CONSTRAINTS.maxMembers}
              placeholder="Leave blank for an open chama"
              {...register('maxMembers')}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank for an open chama (no fixed size). Only set a number if you want a hard
              member cap.
            </p>
            <FieldError message={fieldError('maxMembers')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycleCount">
              {challengeKind === 'rotating' ? 'Number of cycles' : 'Number of cycles (optional)'}
            </Label>
            <Input
              id="cycleCount"
              type="number"
              min={JAMIYA_CONSTRAINTS.minCycles}
              max={JAMIYA_CONSTRAINTS.maxCycles}
              placeholder={challengeKind === 'rotating' ? 'e.g. 10 or 12' : 'Leave blank'}
              {...register('cycleCount')}
            />
            <p className="text-xs text-muted-foreground">
              {challengeKind === 'rotating'
                ? 'Usually matches how many members take a payout turn.'
                : 'Not needed for savings or table banking.'}
            </p>
            <FieldError message={fieldError('cycleCount')} />
          </div>
        </div>

        {challengeKind === 'rotating' ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                {...register('slotPricingEnabled')}
              />
              <span>
                <span className="font-medium text-foreground">Early-slot fee / late-slot rebate</span>
                <span className="mt-0.5 block text-muted-foreground">
                  Facilitation fee for early payout turns; rebate shown for later savers. Not
                  interest — review with your Shariah advisor before enabling.
                </span>
              </span>
            </label>
            {slotPricingEnabled ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="earlySlotFeePct">Early fee (% of contribution)</Label>
                  <Input
                    id="earlySlotFeePct"
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    {...register('earlySlotFeePct')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lateSlotRebatePct">Late rebate (%)</Label>
                  <Input
                    id="lateSlotRebatePct"
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    {...register('lateSlotRebatePct')}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contributionFrequencyDays">Contribution frequency (days)</Label>
            <Input
              id="contributionFrequencyDays"
              type="number"
              min={1}
              max={365}
              {...register('contributionFrequencyDays')}
            />
            <FieldError message={fieldError('contributionFrequencyDays')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start date (optional)</Label>
            <Input id="startDate" type="date" {...register('startDate')} />
            <FieldError message={fieldError('startDate')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="segment">Segment</Label>
            <select
              id="segment"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              {...register('segment')}
            >
              <option value="general">General</option>
              <option value="womens_circle">Women&apos;s circle</option>
              <option value="boda_stage">Boda / tuktuk stage</option>
            </select>
            {segmentHint ? (
              <p className="text-xs text-muted-foreground">{segmentHint}</p>
            ) : null}
            <FieldError message={fieldError('segment')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gracePeriodDays">Grace period (days)</Label>
            <Input
              id="gracePeriodDays"
              type="number"
              min={0}
              max={14}
              {...register('gracePeriodDays')}
            />
            <FieldError message={fieldError('gracePeriodDays')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="joinFeeAmount">Join fee (KES)</Label>
            <Input
              id="joinFeeAmount"
              type="number"
              min={0}
              step={100}
              {...register('joinFeeAmount')}
            />
            <p className="text-xs text-muted-foreground">Charged from wallet when a member joins.</p>
            <FieldError message={fieldError('joinFeeAmount')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transactionFeeAmount">Per-contribution fee (KES)</Label>
            <Input
              id="transactionFeeAmount"
              type="number"
              min={0}
              step={10}
              {...register('transactionFeeAmount')}
            />
            <p className="text-xs text-muted-foreground">
              Disclosed platform/circle fee charged after each contribution payment.
            </p>
            <FieldError message={fieldError('transactionFeeAmount')} />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Visibility</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <input
              type="radio"
              value="open"
              className="mt-1"
              {...register('status')}
            />
            <span>
              <span className="block text-sm font-medium">Open for joining</span>
              <span className="text-xs text-muted-foreground">
                Discoverable by members. You can invite people immediately.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <input
              type="radio"
              value="draft"
              className="mt-1"
              {...register('status')}
            />
            <span>
              <span className="block text-sm font-medium">Save as draft</span>
              <span className="text-xs text-muted-foreground">
                Only you can see it until you open the circle.
              </span>
            </span>
          </label>
          <FieldError message={fieldError('status')} />
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create circle'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={'/circles' as Route}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
