'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { withNoticeQuery } from '@/features/auth/lib/types';

const DOC_TYPES = [
  'certificate_of_registration',
  'constitution',
  'minutes',
  'bank_letter',
  'group_photo',
  'other',
] as const;

export type JamiyaKycActionState = { success: boolean; message: string };

export async function uploadJamiyaKycDocumentAction(
  _prev: JamiyaKycActionState,
  formData: FormData,
): Promise<JamiyaKycActionState> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const documentType = String(formData.get('documentType') ?? '');
  const registrationNumber = String(formData.get('registrationNumber') ?? '').trim();
  const file = formData.get('file');

  if (!jamiyaId) return { success: false, message: 'Circle required.' };
  if (!DOC_TYPES.includes(documentType as (typeof DOC_TYPES)[number])) {
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
  if (!user) return { success: false, message: 'Authentication required.' };

  const documentId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/jamiya/${jamiyaId}/${documentId}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('kyc-documents')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadError) return { success: false, message: uploadError.message };

  const { error: insertError } = await supabase.from('jamiya_kyc_documents').insert({
    id: documentId,
    jamiya_id: jamiyaId,
    uploaded_by: user.id,
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

  await supabase
    .from('jamiyas')
    .update({
      registration_status: 'pending',
      registration_number: registrationNumber || null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', jamiyaId);

  if (slug) {
    revalidatePath(`/circles/${slug}`);
    revalidatePath(`/circles/${slug}/registration`);
  }
  revalidatePath('/admin/kyc');
  return { success: true, message: 'Circle document uploaded for review.' };
}

export async function reviewJamiyaKycAction(formData: FormData): Promise<void> {
  await requireAdminAccess('compliance');
  const documentId = String(formData.get('documentId') ?? '');
  const status = String(formData.get('status') ?? '');
  const notes = String(formData.get('notes') ?? '');
  if (!documentId || !status) {
    redirect(withNoticeQuery('/admin/kyc', 'Missing document or status.', 'error'));
  }
  const { data, error } = await callRpc('review_jamiya_kyc_document', {
    p_document_id: documentId,
    p_status: status,
    p_notes: notes || null,
  });
  revalidatePath('/admin/kyc');
  revalidatePath('/admin');
  revalidatePath('/notifications');
  revalidatePath('/circles');

  if (error) {
    redirect(withNoticeQuery('/admin/kyc', error.message, 'error'));
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (result && result.ok === false) {
    redirect(
      withNoticeQuery(
        '/admin/kyc',
        result.error ?? 'Could not update circle KYC document.',
        'error',
      ),
    );
  }
  redirect(
    withNoticeQuery(
      '/admin/kyc',
      status === 'approved' ? 'Circle document approved.' : 'Circle document rejected.',
      'success',
    ),
  );
}
