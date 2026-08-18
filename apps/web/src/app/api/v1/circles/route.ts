import { NextResponse } from 'next/server';
import { createCircleSchema, sanitizePlainText, slugify } from '@jamiya/shared';
import { createApiClient } from '@/lib/supabase/api';

async function allocateUniqueSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (relation: string) => any },
  name: string,
): Promise<string> {
  const base = slugify(name) || 'circle';
  let candidate = base;
  let attempt = 1;

  while (attempt <= 50) {
    const { data, error } = await client
      .from('jamiyas')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (error) {
      throw new Error((error as { message: string }).message);
    }
    if (!data) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function GET(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('members')
    .select(
      `
      id, role, status, payout_position,
      jamiya:jamiyas (
        id, name, slug, status, contribution_amount, currency,
        member_count, max_members, current_cycle, cycle_count
      )
    `,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, memberships: data ?? [] });
}

/** Create a circle. Creator becomes circle_admin via DB trigger. */
export async function POST(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const parsed = createCircleSchema.safeParse({
    name: body.name,
    description: body.description ?? '',
    contributionAmount: body.contributionAmount ?? body.contribution_amount,
    currency: body.currency ?? 'KES',
    maxMembers: body.maxMembers ?? body.max_members ?? 10,
    cycleCount: body.cycleCount ?? body.cycle_count ?? 6,
    contributionFrequencyDays:
      body.contributionFrequencyDays ?? body.contribution_frequency_days ?? 30,
    startDate: body.startDate ?? body.start_date ?? '',
    status: body.status ?? 'open',
    segment: body.segment ?? 'general',
    joinFeeAmount: body.joinFeeAmount ?? body.join_fee_amount ?? 0,
    transactionFeeAmount: body.transactionFeeAmount ?? body.transaction_fee_amount ?? 0,
    gracePeriodDays: body.gracePeriodDays ?? body.grace_period_days ?? 3,
    challengeKind: body.challengeKind ?? body.challenge_kind ?? 'savings',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'VALIDATION', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const name = sanitizePlainText(input.name, 80);
  const description = input.description
    ? sanitizePlainText(input.description, 1000)
    : null;

  let slug: string;
  try {
    slug = await allocateUniqueSlug(supabase, name);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'SLUG_FAILED',
      },
      { status: 500 },
    );
  }

  const { data: jamiya, error } = await supabase
    .from('jamiyas')
    .insert({
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
      segment: input.segment,
      join_fee_amount: input.joinFeeAmount,
      transaction_fee_amount: input.transactionFeeAmount,
      grace_period_days: input.gracePeriodDays,
      challenge_kind: input.challengeKind ?? 'savings',
    })
    .select('id, slug, name, status, contribution_amount, currency, max_members, cycle_count')
    .single();

  if (error || !jamiya) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'CREATE_FAILED' },
      { status: 500 },
    );
  }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'create',
    entity_type: 'circle',
    entity_id: jamiya.id,
    jamiya_id: jamiya.id,
    metadata: {
      name,
      slug: jamiya.slug,
      status: input.status,
      source: 'api_v1',
    },
  });

  return NextResponse.json({ ok: true, circle: jamiya, jamiya });
}
