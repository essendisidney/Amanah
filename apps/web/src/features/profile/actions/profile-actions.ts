'use server';

import { updateProfileSchema, phoneSchema, sanitizePlainText, isValidKeMobile, toE164Kenya } from '@jamiya/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { getSafeRedirectPath } from '@/features/auth/lib/types';
import { mapProfileZodErrors, type ProfileActionState } from '../lib/state';

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const requirePhone = String(formData.get('requirePhone') ?? '') === '1';
  const continueNext = getSafeRedirectPath(String(formData.get('next') ?? ''), '');
  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone') || '',
    bio: formData.get('bio') || '',
    countryCode: formData.get('countryCode') || '',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: mapProfileZodErrors(parsed.error),
    };
  }

  const phoneNormalized = parsed.data.phone
    ? toE164Kenya(parsed.data.phone) ?? parsed.data.phone
    : '';

  if (requirePhone || phoneNormalized) {
    const phoneCheck = phoneSchema.safeParse(phoneNormalized || parsed.data.phone);
    if (!phoneCheck.success || !isValidKeMobile(phoneNormalized || parsed.data.phone)) {
      return {
        success: false,
        message: 'Please fix the errors below.',
        fieldErrors: {
          phone: ['Use a Kenya mobile, e.g. 0712345678 or +254712345678.'],
        },
      };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const fullName = sanitizePlainText(parsed.data.fullName, 120);
  const bio = parsed.data.bio ? sanitizePlainText(parsed.data.bio, 500) : null;
  const phone = phoneNormalized || null;
  const countryCode = parsed.data.countryCode || null;

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      bio,
      country_code: countryCode,
      profile_completed: true,
    } as never)
    .eq('id', user.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'update',
    entity_type: 'profile',
    entity_id: user.id,
    metadata: { profile_completed: true },
  } as never);

  revalidatePath('/profile');
  revalidatePath('/dashboard');
  revalidatePath('/circles');
  revalidatePath('/wallet');

  if (continueNext && continueNext !== '/dashboard') {
    redirect(continueNext);
  }

  return { success: true, message: 'Profile saved.' };
}

export async function linkMpesaPhoneAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const phone = String(formData.get('mpesaPhone') ?? '').trim();
  const { toE164Kenya } = await import('@jamiya/shared');
  const normalized = toE164Kenya(phone);
  if (!normalized) {
    return {
      success: false,
      message: 'Use a Kenya mobile, e.g. 0712345678 or +254712345678.',
    };
  }

  const { callRpc } = await import('@/lib/supabase/rpc');
  const { data, error } = await callRpc('link_mpesa_phone', { p_phone: normalized });
  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Could not link M-Pesa phone.' };
  }

  revalidatePath('/profile');
  return { success: true, message: 'M-Pesa number linked.' };
}

const KYC_DOC_TYPES = [
  'national_id',
  'passport',
  'driving_license',
  'proof_of_address',
  'selfie',
  'other',
];

/** Register a KYC file after the browser uploads it to Storage (avoids Vercel body-size crashes). */
export async function registerKycDocumentAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  try {
    const documentType = String(formData.get('documentType') ?? '');
    const documentId = String(formData.get('documentId') ?? '');
    const storagePath = String(formData.get('storagePath') ?? '');
    const fileName = String(formData.get('fileName') ?? 'document');
    const mimeType = String(formData.get('mimeType') ?? 'application/octet-stream');
    const fileSizeBytes = Number(formData.get('fileSizeBytes') ?? 0);

    if (!KYC_DOC_TYPES.includes(documentType)) {
      return { success: false, message: 'Select a valid document type.' };
    }
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
      return { success: false, message: 'Upload failed. Try again.' };
    }
    if (!storagePath || fileSizeBytes <= 0) {
      return { success: false, message: 'Choose a file to upload.' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }
    if (!storagePath.startsWith(`${user.id}/`)) {
      return { success: false, message: 'Upload failed. Try again.' };
    }

    const { error: insertError } = await supabase.from('kyc_documents').insert({
      id: documentId,
      user_id: user.id,
      document_type: documentType,
      status: 'uploaded',
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
    } as never);

    if (insertError) {
      return { success: false, message: insertError.message };
    }

    await supabase
      .from('profiles')
      .update({ kyc_status: 'under_review' } as never)
      .eq('id', user.id)
      .in('kyc_status', ['not_started', 'rejected', 'pending']);

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'create',
      entity_type: 'kyc_document',
      entity_id: documentId,
      metadata: { document_type: documentType },
    } as never);

    try {
      const service = createServiceRoleClient();
      const { data: admins } = await service
        .from('profiles')
        .select('id')
        .in('platform_role', ['platform_admin', 'super_admin', 'compliance_officer']);
      const rows = ((admins ?? []) as Array<{ id: string }>).map((row) => ({
        user_id: row.id,
        type: 'admin',
        channel: 'in_app',
        title: 'KYC document pending review',
        body: 'A member uploaded identity documents for approval.',
        data: {
          document_id: documentId,
          href: '/admin/kyc',
        },
      }));
      if (rows.length > 0) {
        await service.from('notifications').insert(rows as never);
      }
    } catch {
      // Non-fatal — document is already queued for review.
    }

    revalidatePath('/profile');
    revalidatePath('/notifications');
    return { success: true, message: 'Document uploaded for review.' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Could not save that ID document.',
    };
  }
}

export async function verifyIprsAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  try {
    const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const nationalId = String(formData.get('nationalId') ?? '').trim();
  const dateOfBirth = String(formData.get('dateOfBirth') ?? '').trim() || null;

  if (firstName.length < 2 || lastName.length < 2) {
    return { success: false, message: 'Enter first and last name as on the National ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return { success: false, message: 'Server is not configured for IPRS lookup.' };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from('iprs_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', hourAgo);

  if ((count ?? 0) >= 5) {
    return { success: false, message: 'Too many IPRS checks this hour. Try again later.' };
  }

  const { lookupIprs, normalizeKenyaNationalId } = await import('@/lib/iprs/client');
  const id = normalizeKenyaNationalId(nationalId);
  if (!id) {
    return { success: false, message: 'Enter an 8- or 9-digit Kenya National ID / Maisha Namba.' };
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

  const profilePatch: Record<string, unknown> = {
    national_id: id,
    date_of_birth: dateOfBirth,
    iprs_status: iprsStatus,
    iprs_full_name: result.fullName ?? `${firstName} ${lastName}`,
    iprs_verified_at: result.matched ? new Date().toISOString() : null,
  };
  if (result.matched) {
    profilePatch.full_name = result.fullName ?? `${firstName} ${lastName}`;
    profilePatch.kyc_status = 'approved';
    profilePatch.profile_completed = true;
  }

  const { error: profileError } = await service
    .from('profiles')
    .update(profilePatch as never)
    .eq('id', user.id);

  if (profileError) {
    return { success: false, message: profileError.message };
  }

  await service.from('audit_logs').insert({
    actor_id: user.id,
    action: 'kyc_update',
    entity_type: 'profile',
    entity_id: user.id,
    metadata: {
      source: 'iprs',
      provider: result.provider,
      outcome: result.outcome,
      matched: result.matched,
    },
  } as never);

  revalidatePath('/profile');
  revalidatePath('/dashboard');

  return {
    success: result.matched,
    message: result.message,
  };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'IPRS lookup failed. Try again.',
    };
  }
}
