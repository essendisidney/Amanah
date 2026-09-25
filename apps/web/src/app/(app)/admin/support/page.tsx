import type { Metadata } from 'next';
import { formatDate } from '@jamiya/shared';
import { Button, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { ADMIN_SUPPORT_PATH } from '@/features/admin/lib/admin-support-access';
import {
  closeSupportTicketAction,
  replySupportTicketAction,
} from '@/features/help/actions/support-ticket-actions';
import { AdminSectionHeader } from '@/features/admin/components/admin-section-header';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Support tickets' };
export const dynamic = 'force-dynamic';

type TicketRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  user_id: string;
  admin_reply: string | null;
};

export default async function AdminSupportPage() {
  // Gate via requireAdminAccess (pass user id into profile lookups — bare getUserProfile
  // returns null and falsely sends Platform Admins to /dashboard, which breaks client nav).
  await requireAdminAccess('compliance', ADMIN_SUPPORT_PATH);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table pending gen:types
  const { data } = await (supabase as any)
    .from('support_tickets')
    .select('id, subject, body, status, created_at, user_id, admin_reply')
    .order('created_at', { ascending: false })
    .limit(100);

  const tickets = (data ?? []) as TicketRow[];
  const userIds = [...new Set(tickets.map((t) => t.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
      : { data: [] };
  const byId = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }>).map((p) => [p.id, p]),
  );
  const openCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        title="Support tickets"
        subtitle={
          openCount === 0
            ? 'No open tickets.'
            : `${openCount} open · reply in the ticket so the member sees it on Help.`
        }
      />
      {tickets.length === 0 ? (
        <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
          No tickets yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const who = byId.get(ticket.user_id);
            const label =
              who?.full_name || who?.email || who?.phone || ticket.user_id.slice(0, 8);
            return (
              <li key={ticket.id} className="amanah-surface space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{ticket.subject}</p>
                  <StatusBadge status={ticket.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(ticket.created_at)} · {label}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{ticket.body}</p>
                {ticket.admin_reply ? (
                  <p className="whitespace-pre-wrap border-t border-border/70 pt-3 text-sm text-foreground">
                    <span className="font-semibold">Reply · </span>
                    {ticket.admin_reply}
                  </p>
                ) : null}
                {ticket.status === 'open' ? (
                  <div className="space-y-3 border-t border-border/70 pt-3">
                    <form action={replySupportTicketAction} className="space-y-2">
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <Label htmlFor={`reply-${ticket.id}`}>Reply</Label>
                      <Textarea
                        id={`reply-${ticket.id}`}
                        name="reply"
                        required
                        minLength={1}
                        maxLength={4000}
                        rows={3}
                        defaultValue={ticket.admin_reply ?? ''}
                        className="text-base sm:text-sm"
                      />
                      <Button type="submit" className="min-h-11">
                        Send reply
                      </Button>
                    </form>
                    <form action={closeSupportTicketAction}>
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <Button type="submit" variant="outline" className="min-h-11">
                        Mark closed
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
