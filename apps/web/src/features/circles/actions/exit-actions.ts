'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { redirectWithCircleNotice } from '../lib/circle-notice';
import { exitErrorMessage } from '../lib/circle-exit';

function done(slug: string) {
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/leave`);
  revalidatePath(`/circles/${slug}/shares`);
}

async function run(
  slug: string,
  fn: string,
  args: Record<string, unknown>,
  success: (result: Record<string, unknown>) => string,
): Promise<never> {
  const { data, error } = await callRpc(fn, args);
  const result = (data ?? {}) as Record<string, unknown> & { ok?: boolean; error?: string };
  done(slug);
  if (error || !result.ok) {
    redirectWithCircleNotice(slug, exitErrorMessage(result.error ?? error?.message), 'error', '/leave');
  }
  redirectWithCircleNotice(slug, success(result), 'success', '/leave');
}

export async function requestCircleExitAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!jamiyaId || !slug) return;
  const recipient = String(formData.get('transferToMemberId') ?? '').trim() || null;
  await run(
    slug,
    'request_circle_exit',
    { p_jamiya_id: jamiyaId, p_transfer_to_member_id: recipient, p_reason: String(formData.get('reason') ?? '') },
    (r) =>
      r.status === 'awaiting_recipient'
        ? 'Request sent. The member you chose must agree to take your shares, then an officer approves.'
        : 'Request sent. An officer will approve it.',
  );
}

export async function respondShareTransferAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!requestId || !slug) return;
  const accept = String(formData.get('accept') ?? '') === '1';
  await run(slug, 'respond_share_transfer', { p_exit_request_id: requestId, p_accept: accept }, () =>
    accept
      ? 'You agreed to take over the shares. They move to you when an officer approves.'
      : 'You declined. The member will ask someone else.',
  );
}

export async function cancelCircleExitAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!requestId || !slug) return;
  await run(slug, 'cancel_circle_exit', { p_exit_request_id: requestId }, () => 'Request withdrawn. You are still a member.');
}

export async function decideCircleExitAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!requestId || !slug) return;
  const approve = String(formData.get('approve') ?? '') === '1';
  await run(
    slug,
    'decide_circle_exit',
    { p_exit_request_id: requestId, p_approve: approve, p_note: String(formData.get('note') ?? '') },
    (r) =>
      approve
        ? `Approved. The member has left${Number(r.shares ?? 0) > 0 ? ' and their shares were transferred' : ''}.`
        : 'Request not approved. The member has been told.',
  );
}
