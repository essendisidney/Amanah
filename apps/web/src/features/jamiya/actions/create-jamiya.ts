'use server';

import {
  createJamiyaSchema,
  sanitizePlainText,
  type CreateJamiyaInput,
} from '@jamiya/shared';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { allocateUniqueSlug } from '../lib/allocate-unique-slug';
import {
  mapCreateJamiyaZodErrors,
  type CreateJamiyaActionState,
} from '../lib/create-jamiya-state';

function formDataToPayload(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get('name'),
    description: formData.get('description') || '',
    contributionAmount: formData.get('contributionAmount'),
    currency: formData.get('currency'),
    maxMembers: formData.get('maxMembers'),
    cycleCount: formData.get('cycleCount'),
    contributionFrequencyDays: formData.get('contributionFrequencyDays'),
    startDate: formData.get('startDate') || '',
    status: formData.get('status') || 'open',
  };
}

export async function createJamiyaAction(
  _prev: CreateJamiyaActionState,
  formData: FormData,
): Promise<CreateJamiyaActionState> {
  const parsed = createJamiyaSchema.safeParse(formDataToPayload(formData));

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: mapCreateJamiyaZodErrors(parsed.error),
    };
  }

  const input: CreateJamiyaInput = parsed.data;
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
    cycle_count: input.cycleCount,
    contribution_frequency_days: input.contributionFrequencyDays,
    start_date: input.startDate || null,
  };

  const { data: jamiya, error } = await supabase
    .from('jamiyas')
    .insert(insertPayload as never)
    .select('id, slug')
    .single();

  if (error || !jamiya) {
    return {
      success: false,
      message: error?.message ?? 'Failed to create circle. Please try again.',
    };
  }

  const created = jamiya as unknown as { id: string; slug: string };

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'create',
    entity_type: 'jamiya',
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
  revalidatePath('/jamiyas');
  redirect(`/jamiyas/${created.slug}`);
}
