'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { ADMIN_SUPPORT_PATH } from '@/features/admin/lib/admin-support-access';

export type SupportTicketState = {
  success: boolean;
  message: string;
};

export async function submitSupportTicketAction(
  _prev: SupportTicketState,
  formData: FormData,
): Promise<SupportTicketState> {
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (subject.length < 3 || subject.length > 200) {
    return { success: false, message: 'Subject must be 3–200 characters.' };
  }
  if (body.length < 10 || body.length > 4000) {
    return { success: false, message: 'Message must be 10–4000 characters.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Sign in to send a support request.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table pending gen:types
  const { error } = await (supabase as any).from('support_tickets').insert({
    user_id: user.id,
    subject,
    body,
    status: 'open',
  });

  if (error) {
    return {
      success: false,
      message: error.message || 'Could not submit your request. Try again.',
    };
  }

  // Notify platform admins (best-effort).
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .in('platform_role', ['platform_admin', 'super_admin']);

  if (admins && admins.length > 0) {
    await supabase.from('notifications').insert(
      admins.map((a) => ({
        user_id: a.id,
        type: 'admin' as const,
        channel: 'in_app' as const,
        title: 'Support ticket',
        body: subject.slice(0, 180),
        data: { kind: 'support_ticket', from_user_id: user.id },
      })),
    );
  }

  revalidatePath('/help');
  revalidatePath(ADMIN_SUPPORT_PATH);
  return { success: true, message: 'Request sent. We will follow up from the team.' };
}

export async function replySupportTicketAction(formData: FormData): Promise<void> {
  const ticketId = String(formData.get('ticketId') ?? '');
  const reply = String(formData.get('reply') ?? '').trim();
  if (!ticketId || reply.length < 1 || reply.length > 4000) return;

  const { userId } = await requireAdminAccess('compliance', ADMIN_SUPPORT_PATH);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table pending gen:types
  const { data: ticket } = await (supabase as any)
    .from('support_tickets')
    .select('user_id, subject')
    .eq('id', ticketId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table pending gen:types
  const { error } = await (supabase as any)
    .from('support_tickets')
    .update({
      admin_reply: reply,
      replied_at: new Date().toISOString(),
      replied_by: userId,
    })
    .eq('id', ticketId);

  if (error || !ticket?.user_id) {
    revalidatePath(ADMIN_SUPPORT_PATH);
    return;
  }

  await supabase.from('notifications').insert({
    user_id: ticket.user_id,
    type: 'system' as const,
    channel: 'in_app' as const,
    title: 'Support reply',
    body: reply.slice(0, 180),
    data: { kind: 'support_ticket_reply', ticket_id: ticketId },
  });

  revalidatePath(ADMIN_SUPPORT_PATH);
  revalidatePath('/help');
}

export async function closeSupportTicketAction(formData: FormData): Promise<void> {
  const ticketId = String(formData.get('ticketId') ?? '');
  if (!ticketId) return;

  await requireAdminAccess('compliance', ADMIN_SUPPORT_PATH);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table pending gen:types
  await (supabase as any).from('support_tickets').update({ status: 'closed' }).eq('id', ticketId);
  revalidatePath(ADMIN_SUPPORT_PATH);
  revalidatePath('/help');
}
