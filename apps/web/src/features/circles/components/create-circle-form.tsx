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

type FormValues = CreateCircleInput;

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
      maxMembers: 6,
      cycleCount: undefined,
      contributionFrequencyDays: 30,
      startDate: '',
      status: 'open',
      segment: defaultSegment,
      challengeKind: 'savings',
      joinFeeAmount: 0,
      transactionFeeAmount: 0,
      gracePeriodDays: 3,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;

  const challengeKind = watch('challengeKind');

  const onValid = (values: FormValues) => {
    const fd = new FormData();
    fd.set('name', values.name);
    fd.set('description', values.description ?? '');
    fd.set('contributionAmount', String(values.contributionAmount));
    fd.set('currency', values.currency);
    fd.set('maxMembers', String(values.maxMembers));
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
            <Label htmlFor="maxMembers">Maximum members</Label>
            <Input
              id="maxMembers"
              type="number"
              min={JAMIYA_CONSTRAINTS.minMembers}
              max={JAMIYA_CONSTRAINTS.maxMembers}
              {...register('maxMembers')}
            />
            <FieldError message={fieldError('maxMembers')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycleCount">Number of cycles (optional)</Label>
            <Input
              id="cycleCount"
              type="number"
              min={JAMIYA_CONSTRAINTS.minCycles}
              max={JAMIYA_CONSTRAINTS.maxCycles}
              placeholder="Leave blank"
              {...register('cycleCount')}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank unless this is a merry-go-round. Savings and share groups do not need a
              fixed cycle count.
            </p>
            <FieldError message={fieldError('cycleCount')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="challengeKind">Challenge type</Label>
          <select
            id="challengeKind"
            className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('challengeKind')}
          >
            <option value="savings">Savings challenge (no rotating payouts)</option>
            <option value="share_dividend">Share / dividend group</option>
            <option value="rotating">Rotating payouts (merry-go-round)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {challengeKind === 'share_dividend'
              ? 'Members buy shares and take dividends or profits. Activation will not create merry-go-round payouts.'
              : challengeKind === 'rotating'
                ? 'Classic rotating circle: one scheduled payout turn per cycle.'
                : 'Contribution rounds only. Number of cycles is not the number of people.'}
          </p>
          <FieldError message={fieldError('challengeKind')} />
        </div>

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
