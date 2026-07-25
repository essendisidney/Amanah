import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { revokeInvitationAction } from '../actions/invitation-actions';

export type MemberListItem = {
  id: string;
  role: string;
  status: string;
  payoutPosition: number | null;
  joinedAt: string | null;
  fullName: string | null;
  email: string | null;
};

export type InvitationListItem = {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
};

export function MembersList({ members }: { members: MemberListItem[] }) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No members yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {members.map((member) => (
        <li
          key={member.id}
          className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">
                {member.fullName ?? member.email ?? 'Member'}
              </p>
              <StatusBadge status={member.role} />
              <StatusBadge status={member.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {member.email ?? '—'}
              {member.payoutPosition ? ` · Payout #${member.payoutPosition}` : ''}
              {member.joinedAt ? ` · Joined ${formatDate(member.joinedAt)}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PendingInvitationsList({
  invitations,
  slug,
  canManage,
}: {
  invitations: InvitationListItem[];
  slug: string;
  canManage: boolean;
}) {
  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending invitations.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {invitations.map((invite) => (
        <li
          key={invite.id}
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">
                {invite.email ?? invite.phone ?? 'Invite'}
              </p>
              <StatusBadge status={invite.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Expires {formatDate(invite.expiresAt)} · Sent {formatDate(invite.createdAt)}
            </p>
          </div>
          {canManage && invite.status === 'pending' ? (
            <form action={revokeInvitationAction}>
              <input type="hidden" name="invitationId" value={invite.id} />
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" size="sm" variant="outline">
                Revoke
              </Button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
