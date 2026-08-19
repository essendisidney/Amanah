import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { lookupIprs, normalizeKenyaNationalId } from '@/lib/iprs/client';

/** POST { nationalId, firstName, lastName, dateOfBirth? } — Kenya IPRS / NPDM lookup. */
export async function POST(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    nationalId?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  } | null;

  const firstName = (body?.firstName ?? '').trim();
  const lastName = (body?.lastName ?? '').trim();
  const id = normalizeKenyaNationalId(body?.nationalId ?? '');
  const dateOfBirth = (body?.dateOfBirth ?? '').trim() || null;

  if (!id || firstName.length < 2 || lastName.length < 2) {
    return NextResponse.json({ ok: false, error: 'INVALID_IPRS_INPUT' }, { status: 400 });
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'SERVICE_ROLE_MISSING' }, { status: 500 });
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from('iprs_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', hourAgo);

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ ok: false, error: 'RATE_LIMIT' }, { status: 429 });
  }

  const result = await lookupIprs({
    nationalId: id,
    firstName,
    lastName,
    dateOfBirth,
  });

  await service.from('iprs_verifications').insert({
    user_id: user.id,
    national_id: id,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dateOfBirth,
    provider: result.provider,
    outcome: result.outcome,
    matched: result.matched,
    response: result.raw,
  } as never);

  const iprsStatus = result.matched
    ? 'matched'
    : result.outcome === 'not_found'
      ? 'not_found'
      : result.outcome === 'error'
        ? 'error'
        : 'mismatch';

  await service
    .from('profiles')
    .update({
      national_id: id,
      date_of_birth: dateOfBirth,
      iprs_status: iprsStatus,
      iprs_full_name: result.fullName ?? `${firstName} ${lastName}`,
      iprs_verified_at: result.matched ? new Date().toISOString() : null,
      ...(result.matched
        ? {
            full_name: result.fullName ?? `${firstName} ${lastName}`,
            kyc_status: 'approved',
            profile_completed: true,
          }
        : {}),
    } as never)
    .eq('id', user.id);

  return NextResponse.json({
    ok: true,
    matched: result.matched,
    outcome: result.outcome,
    provider: result.provider,
    message: result.message,
  });
}
