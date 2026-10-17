'use server';

import { revalidatePath } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice } from '../lib/circle-notice';

const RECORD_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ERRORS: Record<string, string> = {
  FORBIDDEN: 'Only the secretary, chair or circle admin can keep the circle’s records.',
  INVALID: 'Add a title (3 to 200 characters), and keep the text under 20,000 characters.',
  NOT_FOUND: 'That record was not found.',
  ALREADY_PUBLISHED: 'Published records cannot be changed or deleted. Add a new one instead.',
  EMPTY: 'Write the minutes or attach the signed copy before publishing.',
};

function done(slug: string) {
  revalidatePath(`/circles/${slug}/records`);
  revalidatePath(`/circles/${slug}/community`);
}

/** Write minutes or a resolution (as a draft), optionally attaching the signed copy. */
export async function saveCircleRecordAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;
  const kind = String(formData.get('kind') ?? 'minutes');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '');
  const recordDate = String(formData.get('recordDate') ?? '').trim() || null;
  const meetingId = String(formData.get('meetingId') ?? '').trim() || null;
  const publish = String(formData.get('publish') ?? '') === '1';
  // The browser uploads the file straight to storage (the circle's folder, which only record
  // keepers may write) and sends its path; the database checks it is in this circle's folder.
  const filePath = String(formData.get('filePath') ?? '').trim() || null;
  const fileName = filePath ? String(formData.get('fileName') ?? '').slice(0, 200) || null : null;
  const mimeType = filePath ? String(formData.get('mimeType') ?? '').slice(0, 120) || null : null;
  if (filePath && !RECORD_FILE_TYPES.includes(mimeType ?? '')) {
    redirectWithCircleNotice(slug, 'Attach a PDF, photo (JPEG, PNG, WebP) or Word file.', 'error', '/records');
  }

  const { data, error } = await callRpc('save_circle_record', {
    p_jamiya_id: jamiyaId,
    p_kind: kind,
    p_title: title,
    p_body: body,
    p_record_date: recordDate,
    p_meeting_id: meetingId,
    p_file_path: filePath,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_record_id: null,
  });
  const result = data as { ok?: boolean; error?: string; record_id?: string } | null;
  if (error || !result?.ok || !result.record_id) {
    done(slug);
    redirectWithCircleNotice(
      slug,
      ERRORS[result?.error ?? ''] ?? error?.message ?? 'Could not save the record.',
      'error',
      '/records',
    );
  }

  if (publish) {
    const { data: pub } = await callRpc('publish_circle_record', { p_record_id: result.record_id });
    const p = pub as { ok?: boolean; error?: string } | null;
    done(slug);
    if (!p?.ok) {
      redirectWithCircleNotice(
        slug,
        `Saved as a draft. ${ERRORS[p?.error ?? ''] ?? 'Publish it when ready.'}`,
        'info',
        '/records',
      );
    }
    redirectWithCircleNotice(slug, 'Published. Members have been told.', 'success', '/records');
  }
  done(slug);
  redirectWithCircleNotice(slug, 'Saved as a draft. Only record keepers can see it.', 'success', '/records');
}

export async function publishCircleRecordAction(formData: FormData): Promise<void> {
  const recordId = String(formData.get('recordId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!recordId || !slug) return;
  const { data, error } = await callRpc('publish_circle_record', { p_record_id: recordId });
  const result = data as { ok?: boolean; error?: string } | null;
  done(slug);
  if (error || !result?.ok) {
    redirectWithCircleNotice(slug, ERRORS[result?.error ?? ''] ?? 'Could not publish.', 'error', '/records');
  }
  redirectWithCircleNotice(slug, 'Published. Members have been told.', 'success', '/records');
}

export async function deleteCircleRecordAction(formData: FormData): Promise<void> {
  const recordId = String(formData.get('recordId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!recordId || !slug) return;
  const { data, error } = await callRpc('delete_circle_record', { p_record_id: recordId });
  const result = data as { ok?: boolean; error?: string; file_path?: string | null } | null;
  // The database checked the caller keeps this circle's records and that this was a draft.
  if (!error && result?.ok && result.file_path) {
    try {
      await createServiceRoleClient().storage.from('circle-records').remove([result.file_path]);
    } catch {
      // The draft is discarded either way; an unremoved file stays private to the circle.
    }
  }
  done(slug);
  if (error || !result?.ok) {
    redirectWithCircleNotice(slug, ERRORS[result?.error ?? ''] ?? 'Could not delete.', 'error', '/records');
  }
  redirectWithCircleNotice(slug, 'Draft discarded.', 'success', '/records');
}
