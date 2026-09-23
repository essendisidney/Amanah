import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { AppPage, PageHeader } from '@/components/app-page';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/supabase/auth';
import { isComplianceRole } from '@jamiya/auth';
import { closeSupportTicketAction } from '@/features/help/actions/support-ticket-actions';
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
};

export default async function AdminSupportPage() {
  const profile = await getUserProfile();
  if (!profile || !isComplianceRole(profile.platform_role)) {
    redirect('/dashboard');
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table pending gen:types
  const { data } = await (supabase as any)
    .from('support_tickets')
    .select('id, subject, body, status, created_at, user_id')
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

  return (
    <AppPage width="wide">
      <PageHeader
        title="Support tickets"
        subtitle="Requests from Help & support. Reply to members using their profile contact."
      />
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets yet.</p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const who = byId.get(ticket.user_id);
            const label =
              who?.full_name || who?.email || who?.phone || ticket.user_id.slice(0, 8);
            return (
              <li key={ticket.id} className="amanah-surface space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{ticket.subject}</p>
                  <StatusBadge status={ticket.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(ticket.created_at)} · {label}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{ticket.body}</p>
                {ticket.status === 'open' ? (
                  <form action={closeSupportTicketAction}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Mark closed
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AppPage>
  );
}
