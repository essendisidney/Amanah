import { formatDate } from '@jamiya/shared';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export type MemberTicket = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  admin_reply: string | null;
};

/** Member's own tickets, including the admin reply and status. */
export function MemberSupportTickets({
  title,
  empty,
  replyLabel,
  waiting,
  tickets,
}: {
  title: string;
  empty: string;
  replyLabel: string;
  waiting: string;
  tickets: MemberTicket[];
}) {
  return (
    <section className="space-y-2.5" aria-labelledby="my-tickets-heading">
      <h2 id="my-tickets-heading" className="text-sm font-semibold text-foreground">
        {title}
      </h2>
      {tickets.length === 0 ? (
        <p className="amanah-surface px-4 py-4 text-sm text-muted-foreground sm:px-5">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="amanah-surface space-y-2 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{ticket.subject}</p>
                <StatusBadge status={ticket.status} />
                <span className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</span>
              </div>
              {ticket.admin_reply ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  <span className="font-semibold">{replyLabel} · </span>
                  {ticket.admin_reply}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{waiting}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
