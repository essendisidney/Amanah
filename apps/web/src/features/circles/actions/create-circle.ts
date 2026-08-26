'use server';

import {
  createCircleSchema,
  sanitizePlainText,
  type CreateCircleInput,
} from '@jamiya/shared';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { allocateUniqueSlug } from '../lib/allocate-unique-slug';
import {
  mapCreateCircleZodErrors,
  type CreateCircleActionState,
} from '../lib/create-circle-state';

function formDataToPayload(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get('name'),
    description: formData.get('description') || '',
    contributionAmount: formData.get('contributionAmount'),
    currency: formData.get('currency'),
    maxMembers: formData.get('maxMembers') || undefined,
    cycleCount: formData.get('cycleCount') || undefined,
    contributionFrequencyDays: formData.get('contributionFrequencyDays'),
    startDate: formData.get('startDate') || '',
    status: formData.get('status') || 'open',
    segment: formData.get('segment') || 'general',
    joinFeeAmount: formData.get('joinFeeAmount') || 0,
    transactionFeeAmount: formData.get('transactionFeeAmount') || 0,
    gracePeriodDays: formData.get('gracePeriodDays') || 3,
    challengeKind: formData.get('challengeKind') || 'savings',
    slotPricingEnabled: formData.get('slotPricingEnabled') === 'true' || formData.get('slotPricingEnabled') === 'on',
    earlySlotFeePct: formData.get('earlySlotFeePct') || 0,
    lateSlotRebatePct: formData.get('lateSlotRebatePct') || 0,
  };
}

export async function createCircleAction(
  _prev: CreateCircleActionState,
  formData: FormData,
): Promise<CreateCircleActionState> {
  const parsed = createCircleSchema.safeParse(formDataToPayload(formData));

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: mapCreateCircleZodErrors(parsed.error),
    };
  }

  const input: CreateCircleInput = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'You must be signed in to create a circle.',
    };
  }

  const name = sanitizePlainText(input.name, 80);
  const description = input.description
    ? sanitizePlainText(input.description, 1000)
    : null;

  let slug: string;
  try {
    slug = await allocateUniqueSlug(supabase, name);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Could not allocate a unique URL slug.',
    };
  }

  const insertPayload = {
    name,
    slug,
    description,
    status: input.status,
    created_by: user.id,
    contribution_amount: input.contributionAmount,
    currency: input.currency,
    max_members: input.maxMembers,
    cycle_count: input.cycleCount ?? null,
    contribution_frequency_days: input.contributionFrequencyDays,
    start_date: input.startDate || null,
    segment: input.segment,
    join_fee_amount: input.joinFeeAmount,
    transaction_fee_amount: input.transactionFeeAmount,
    grace_period_days: input.gracePeriodDays,
    challenge_kind: input.challengeKind ?? 'savings',
    slot_pricing_enabled: Boolean(input.slotPricingEnabled),
    early_slot_fee_pct: input.earlySlotFeePct ?? 0,
    late_slot_rebate_pct: input.lateSlotRebatePct ?? 0,
  };

  const { data: jamiya, error } = await supabase
    .from('jamiyas')
    .insert(insertPayload as never)
    .select('id, slug')
    .single();

  let createdRow = jamiya as unknown as { id: string; slug: string } | null;
  let insertError = error;

  if (insertError?.message?.includes('slot_pricing') || insertError?.message?.includes('early_slot')) {
    const { slot_pricing_enabled: _a, early_slot_fee_pct: _b, late_slot_rebate_pct: _c, ...legacy } =
      insertPayload;
    const retry = await supabase.from('jamiyas').insert(legacy as never).select('id, slug').single();
    createdRow = retry.data as unknown as { id: string; slug: string } | null;
    insertError = retry.error;
  }

  if (insertError || !createdRow) {
    return {
      success: false,
      message: insertError?.message ?? 'Failed to create circle. Please try again.',
    };
  }

  const created = createdRow;

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'create',
    entity_type: 'circle',
    entity_id: created.id,
    jamiya_id: created.id,
    metadata: {
      name,
      slug: created.slug,
      status: input.status,
      contribution_amount: input.contributionAmount,
      currency: input.currency,
      max_members: input.maxMembers,
      cycle_count: input.cycleCount,
    },
  } as never);

  revalidatePath('/dashboard');
  revalidatePath('/circles');
  redirect(`/circles/${created.slug}`);
}
