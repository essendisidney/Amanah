'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
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
import { createCircleAction } from '../actions/create-circle';
import { initialCreateCircleState } from '../lib/create-circle-state';
import { contributionFrequencyLabel } from '../lib/contribution-frequency';

type FormValues = Omit<CreateCircleInput, 'maxMembers' | 'cycleCount'> & {
  maxMembers?: number;
  cycleCount?: number;
};

type WizardStep = 'type' | 'details' | 'rules' | 'review';

const STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: 'type', label: 'Type', number: 1 },
  { id: 'details', label: 'Details', number: 2 },
  { id: 'rules', label: 'Rules', number: 3 },
  { id: 'review', label: 'Review', number: 4 },
];

type FrequencyPreset = 'weekly' | 'monthly' | 'custom';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function frequencyPresetFromDays(days: number): FrequencyPreset {
  if (days === 7) return 'weekly';
  if (days === 30) return 'monthly';
  return 'custom';
}

const CHALLENGE_KIND_LABELS: Record<
  NonNullable<CreateCircleInput['challengeKind']>,
  string
> = {
  rotating: 'Merry-go-round',
  share_dividend: 'Table banking',
  savings: 'Savings',
};

const SEGMENT_LABELS: Record<CreateCircleInput['segment'], string> = {
  general: 'General',
  womens_circle: "Women's circle",
  boda_stage: 'Boda / tuktuk stage',
};

export function CreateCircleForm({
  defaultSegment = 'general',
  segmentHint,
}: {
  defaultSegment?: 'general' | 'womens_circle' | 'boda_stage';
  segmentHint?: string | null;
} = {}) {
  const [state, formAction] = useActionState(createCircleAction, initialCreateCircleState);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>('type');
  const [frequencyPreset, setFrequencyPreset] = useState<FrequencyPreset>('monthly');

  const form = useForm<FormValues>({
    resolver: zodResolver(createCircleSchema) as Resolver<FormValues>,
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
    trigger,
    formState: { errors },
  } = form;

  const challengeKind = watch('challengeKind');
  const slotPricingEnabled = watch('slotPricingEnabled');
  const contributionFrequencyDays = watch('contributionFrequencyDays');
  const values = watch();

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const setChallengeKind = (kind: 'rotating' | 'savings' | 'share_dividend') => {
    setValue('challengeKind', kind, { shouldDirty: true, shouldValidate: true });
    if (kind !== 'rotating') {
      setValue('cycleCount', undefined);
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
      setFrequencyPreset('monthly');
      setValue('cycleCount', 10);
      setValue('maxMembers', 10);
      setValue('slotPricingEnabled', false);
      setValue('earlySlotFeePct', 0);
      setValue('lateSlotRebatePct', 0);
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
      setFrequencyPreset('monthly');
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
      setFrequencyPreset('monthly');
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
      setFrequencyPreset('monthly');
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
      setFrequencyPreset('weekly');
      setValue('cycleCount', 8);
      setValue('maxMembers', 8);
      setValue('slotPricingEnabled', false);
      setValue('description', 'Weekly stage merry-go-round for riders.');
    }
  };

  const setFrequency = (preset: FrequencyPreset) => {
    setFrequencyPreset(preset);
    if (preset === 'weekly') {
      setValue('contributionFrequencyDays', 7, { shouldDirty: true, shouldValidate: true });
    } else if (preset === 'monthly') {
      setValue('contributionFrequencyDays', 30, { shouldDirty: true, shouldValidate: true });
    }
  };

  const onValid = (formValues: FormValues) => {
    const fd = new FormData();
    fd.set('name', formValues.name);
    fd.set('description', formValues.description ?? '');
    fd.set('contributionAmount', String(formValues.contributionAmount));
    fd.set('currency', formValues.currency);
    if (formValues.maxMembers != null && Number.isFinite(formValues.maxMembers)) {
      fd.set('maxMembers', String(formValues.maxMembers));
    }
    if (formValues.cycleCount != null) {
      fd.set('cycleCount', String(formValues.cycleCount));
    }
    fd.set('contributionFrequencyDays', String(formValues.contributionFrequencyDays));
    fd.set('startDate', formValues.startDate ?? '');
    fd.set('status', formValues.status);
    fd.set('segment', formValues.segment);
    fd.set('challengeKind', formValues.challengeKind ?? 'savings');
    fd.set('joinFeeAmount', String(formValues.joinFeeAmount ?? 0));
    fd.set('transactionFeeAmount', String(formValues.transactionFeeAmount ?? 0));
    fd.set('gracePeriodDays', String(formValues.gracePeriodDays ?? 3));
    fd.set('slotPricingEnabled', formValues.slotPricingEnabled ? 'true' : 'false');
    fd.set('earlySlotFeePct', String(formValues.earlySlotFeePct ?? 0));
    fd.set('lateSlotRebatePct', String(formValues.lateSlotRebatePct ?? 0));

    startTransition(() => {
      formAction(fd);
    });
  };

  const fieldError = (name: keyof FormValues) =>
    errors[name]?.message ?? state.fieldErrors?.[name]?.[0];

  const detailsFields: (keyof FormValues)[] = useMemo(() => {
    const fields: (keyof FormValues)[] = [
      'name',
      'description',
      'contributionAmount',
      'currency',
      'contributionFrequencyDays',
      'maxMembers',
      'startDate',
    ];
    if (challengeKind === 'rotating') {
      fields.push('cycleCount');
    }
    return fields;
  }, [challengeKind]);

  const rulesFields: (keyof FormValues)[] = useMemo(() => {
    const fields: (keyof FormValues)[] = [
      'segment',
      'gracePeriodDays',
      'joinFeeAmount',
      'transactionFeeAmount',
      'status',
    ];
    if (challengeKind === 'rotating' && slotPricingEnabled) {
      fields.push('earlySlotFeePct', 'lateSlotRebatePct');
    }
    return fields;
  }, [challengeKind, slotPricingEnabled]);

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  };

  const goContinue = async () => {
    if (step === 'type') {
      const ok = await trigger('challengeKind');
      if (ok) setStep('details');
      return;
    }
    if (step === 'details') {
      const ok = await trigger(detailsFields);
      if (ok) setStep('rules');
      return;
    }
    if (step === 'rules') {
      const ok = await trigger(rulesFields);
      if (ok) setStep('review');
    }
  };

  const frequencyLabel = useMemo(() => {
    return contributionFrequencyLabel(Number(contributionFrequencyDays));
  }, [contributionFrequencyDays]);

  const effectivePreset =
    frequencyPreset === 'custom'
      ? frequencyPreset
      : frequencyPresetFromDays(Number(contributionFrequencyDays));

  return (
    <div className="space-y-6">
      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <nav aria-label="Create circle steps" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s) => {
          const active = s.id === step;
          const currentStep = STEPS[Math.max(0, stepIndex)] ?? STEPS[0]!;
          const done = s.number < currentStep.number;
          return (
            <div
              key={s.id}
              aria-current={active ? 'step' : undefined}
              className={[
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : done
                    ? 'border-primary/30 bg-primary/8 text-foreground'
                    : 'border-border bg-card text-muted-foreground',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  active
                    ? 'bg-primary-foreground text-primary'
                    : done
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {s.number}
              </span>
              <span className={active ? 'font-semibold' : 'font-medium'}>{s.label}</span>
            </div>
          );
        })}
      </nav>

      <form onSubmit={handleSubmit(onValid)} className="space-y-6" noValidate>
        {step === 'type' ? (
          <>
            <div className="space-y-3">
              <div>
                <Label>How will this circle work?</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick one. Templates fill amounts on the next step.
                </p>
              </div>
              <input type="hidden" {...register('challengeKind')} />
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    {
                      value: 'rotating' as const,
                      title: 'Merry-go-round',
                      hint: 'Contributions · payout slots',
                    },
                    {
                      value: 'share_dividend' as const,
                      title: 'Table banking',
                      hint: 'Shares · savings · loans',
                    },
                    {
                      value: 'savings' as const,
                      title: 'Savings',
                      hint: 'Calendar · goals',
                    },
                  ] as const
                ).map((card) => {
                  const selected = challengeKind === card.value;
                  return (
                    <button
                      key={card.value}
                      type="button"
                      onClick={() => setChallengeKind(card.value)}
                      aria-pressed={selected}
                      className={[
                        'rounded-xl border-2 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border bg-card hover:border-primary/40',
                      ].join(' ')}
                    >
                      <p className="text-sm font-semibold text-foreground">{card.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                      {selected ? (
                        <p className="mt-2 text-xs font-bold text-primary">Selected</p>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">Tap to select</p>
                      )}
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
                Templates set name, amount, and cadence — and update the circle type cards above so
                you always see what you are creating.
              </p>
            </div>
          </>
        ) : null}

        {step === 'details' ? (
          <>
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

            <div className="space-y-3">
              <div>
                <Label>Contribution frequency</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Schedules add a fixed number of days from the start date for each round. That is{' '}
                  <strong>not</strong> the same as calendar months (which vary 28–31 days).{' '}
                  <strong>7 days</strong> ≈ weekly. <strong>30 days</strong> ≈ every 30 days — not
                  “the 1st of each month.”
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['weekly', 'Every 7 days'],
                    ['monthly', 'Every 30 days'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([preset, label]) => {
                  const selected = effectivePreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFrequency(preset)}
                      className={[
                        'rounded-md border px-3 py-1.5 text-sm transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {effectivePreset === 'custom' ? (
                <div className="space-y-2">
                  <Label htmlFor="contributionFrequencyDays">Days between contributions</Label>
                  <Input
                    id="contributionFrequencyDays"
                    type="number"
                    min={1}
                    max={365}
                    {...register('contributionFrequencyDays', {
                      onChange: (e) => {
                        const n = Number(e.target.value);
                        if (n !== 7 && n !== 30) {
                          setFrequencyPreset('custom');
                        }
                      },
                    })}
                  />
                  <FieldError message={fieldError('contributionFrequencyDays')} />
                </div>
              ) : (
                <input type="hidden" {...register('contributionFrequencyDays')} />
              )}
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
                  Leave blank for an open chama (no fixed size). Only set a number if you want a
                  hard member cap.
                </p>
                <FieldError message={fieldError('maxMembers')} />
              </div>

              {challengeKind === 'rotating' ? (
                <div className="space-y-2">
                  <Label htmlFor="cycleCount">Number of cycles</Label>
                  <Input
                    id="cycleCount"
                    type="number"
                    min={JAMIYA_CONSTRAINTS.minCycles}
                    max={JAMIYA_CONSTRAINTS.maxCycles}
                    placeholder="e.g. 10 or 12"
                    {...register('cycleCount')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usually matches how many members take a payout turn.
                  </p>
                  <FieldError message={fieldError('cycleCount')} />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start date (optional)</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              <FieldError message={fieldError('startDate')} />
            </div>
          </>
        ) : null}

        {step === 'rules' ? (
          <>
            {challengeKind === 'rotating' ? (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1" {...register('slotPricingEnabled')} />
                  <span>
                    <span className="font-medium text-foreground">
                      Early-slot fee / late-slot rebate
                    </span>
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
                      <FieldError message={fieldError('earlySlotFeePct')} />
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
                      <FieldError message={fieldError('lateSlotRebatePct')} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

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

            <details className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Optional circle fees
              </summary>
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Optional. Members see fees on join and pay.
                </p>
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
                    <p className="text-xs text-muted-foreground">
                      Charged from wallet when a member joins.
                    </p>
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
                      Fixed amount after each contribution payment — not a hidden % on M-Pesa.
                    </p>
                    <FieldError message={fieldError('transactionFeeAmount')} />
                  </div>
                </div>
              </div>
            </details>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Visibility</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <input type="radio" value="open" className="mt-1" {...register('status')} />
                <span>
                  <span className="block text-sm font-medium">Open for joining</span>
                  <span className="text-xs text-muted-foreground">
                    Discoverable by members. You can invite people immediately.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <input type="radio" value="draft" className="mt-1" {...register('status')} />
                <span>
                  <span className="block text-sm font-medium">Save as draft</span>
                  <span className="text-xs text-muted-foreground">
                    Only you can see it until you open the circle.
                  </span>
                </span>
              </label>
              <FieldError message={fieldError('status')} />
            </fieldset>
          </>
        ) : null}

        {step === 'review' ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Summary</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm everything before creating the circle.
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium text-foreground">
                  {CHALLENGE_KIND_LABELS[values.challengeKind ?? 'savings']}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium text-foreground">{values.name || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="font-medium text-foreground">
                  {values.description?.trim() ? values.description : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contribution</dt>
                <dd className="font-medium text-foreground">
                  {values.contributionAmount} {values.currency}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Frequency</dt>
                <dd className="font-medium text-foreground">{frequencyLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Max members</dt>
                <dd className="font-medium text-foreground">
                  {values.maxMembers != null && Number.isFinite(Number(values.maxMembers))
                    ? values.maxMembers
                    : 'Open chama'}
                </dd>
              </div>
              {challengeKind === 'rotating' ? (
                <div>
                  <dt className="text-muted-foreground">Cycles</dt>
                  <dd className="font-medium text-foreground">
                    {values.cycleCount ?? '—'}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Start date</dt>
                <dd className="font-medium text-foreground">
                  {values.startDate?.trim() ? values.startDate : 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Segment</dt>
                <dd className="font-medium text-foreground">
                  {SEGMENT_LABELS[values.segment ?? 'general']}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Grace period</dt>
                <dd className="font-medium text-foreground">{values.gracePeriodDays} days</dd>
              </div>
              {challengeKind === 'rotating' && values.slotPricingEnabled ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Slot pricing</dt>
                  <dd className="font-medium text-foreground">
                    Early fee {values.earlySlotFeePct}% · Late rebate {values.lateSlotRebatePct}%
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Join fee</dt>
                <dd className="font-medium text-foreground">
                  {values.joinFeeAmount ? `${values.joinFeeAmount} KES` : 'None'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Per-contribution fee</dt>
                <dd className="font-medium text-foreground">
                  {values.transactionFeeAmount ? `${values.transactionFeeAmount} KES` : 'None'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Visibility</dt>
                <dd className="font-medium text-foreground">
                  {values.status === 'draft' ? 'Draft' : 'Open for joining'}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          {step !== 'type' ? (
            <Button type="button" variant="outline" onClick={goBack}>
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" asChild>
              <Link href={'/circles' as Route}>Cancel</Link>
            </Button>
          )}
          {step !== 'review' ? (
            <Button type="button" onClick={goContinue}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create circle'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
