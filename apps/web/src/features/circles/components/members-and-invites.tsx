import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { revokeInvitationAction } from '../actions/invitation-actions';
import { setMemberRoleAction, vouchMemberAction } from '../actions/member-actions';

export type MemberListItem = {
  id: string;
  role: string;
  status: string;
  payoutPosition: number | null;
  joinedAt: string | null;
  fullName: string | null;
  email: string | null;
  memberCode?: string | null;
  vouchStatus?: string | null;
};

export type InvitationListItem = {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
};

const OFFICER_ROLES = ['member', 'secretary', 'treasurer', 'chair', 'circle_admin'] as const;

export function MembersList({
  members,
  slug,
  canManage,
}: {
  members: MemberListItem[];
  slug: string;
  canManage: boolean;
}) {
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {members.map((member) => (
        <li key={member.id} className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">
                  {member.fullName ?? member.email ?? 'Member'}
                </p>
                {member.memberCode ? (
                  <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {member.memberCode}
                  </span>
                ) : null}
                <StatusBadge status={member.role} />
                <StatusBadge status={member.status} />
                {member.vouchStatus ? <StatusBadge status={`vouch:${member.vouchStatus}`} /> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {member.email ?? '—'}
                {member.payoutPosition ? ` · Payout #${member.payoutPosition}` : ''}
                {member.joinedAt ? ` · Joined ${formatDate(member.joinedAt)}` : ''}
              </p>
            </div>
          </div>

          {canManage ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <form action={setMemberRoleAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="memberId" value={member.id} />
                <input type="hidden" name="slug" value={slug} />
                <label className="text-xs text-muted-foreground">
                  Role
                  <select
                    name="role"
                    defaultValue={member.role}
                    className="ml-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {OFFICER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" size="sm" variant="outline">
                  Update role
                </Button>
              </form>

              <form action={vouchMemberAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="memberId" value={member.id} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="approve" value="true" />
                <Button type="submit" size="sm">
                  Vouch
                </Button>
              </form>
              <form action={vouchMemberAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="memberId" value={member.id} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="approve" value="false" />
                <Button type="submit" size="sm" variant="outline">
                  Reject vouch
                </Button>
              </form>
            </div>
          ) : null}
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
