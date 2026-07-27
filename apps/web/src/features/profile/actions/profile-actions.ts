'use server';

import { updateProfileSchema, sanitizePlainText } from '@jamiya/shared';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { mapProfileZodErrors, type ProfileActionState } from '../lib/state';

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const fullName = sanitizePlainText(parsed.data.fullName, 120);
  const bio = parsed.data.bio ? sanitizePlainText(parsed.data.bio, 500) : null;
  const phone = parsed.data.phone || null;
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

  return { success: true, message: 'Profile updated.' };
}

export async function linkMpesaPhoneAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const phone = String(formData.get('mpesaPhone') ?? '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return {
      success: false,
      message: 'Enter M-Pesa phone in E.164 form, e.g. +254712345678.',
    };
  }

  const { callRpc } = await import('@/lib/supabase/rpc');
  const { data, error } = await callRpc('link_mpesa_phone', { p_phone: phone });
  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Could not link M-Pesa phone.' };
  }

  revalidatePath('/profile');
  return { success: true, message: 'M-Pesa number linked.' };
}

export async function uploadKycDocumentAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const documentType = String(formData.get('documentType') ?? '');
  const file = formData.get('file');

  if (
    !['national_id', 'passport', 'driving_license', 'proof_of_address', 'selfie', 'other'].includes(
      documentType,
    )
  ) {
    return { success: false, message: 'Select a valid document type.' };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: 'Choose a file to upload.' };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, message: 'File must be 10MB or smaller.' };
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    return { success: false, message: 'Upload a JPEG, PNG, WebP, or PDF file.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const documentId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/${documentId}/${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from('kyc-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { error: insertError } = await supabase.from('kyc_documents').insert({
    id: documentId,
    user_id: user.id,
    document_type: documentType,
    status: 'uploaded',
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
  } as never);

  if (insertError) {
    await supabase.storage.from('kyc-documents').remove([storagePath]);
    return { success: false, message: insertError.message };
  }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'create',
    entity_type: 'kyc_document',
    entity_id: documentId,
    metadata: { document_type: documentType },
  } as never);

  revalidatePath('/profile');
  return { success: true, message: 'Document uploaded for review.' };
}
