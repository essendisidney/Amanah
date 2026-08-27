'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { formatDate } from '@jamiya/shared';
import { Button, Input } from '@jamiya/ui';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { revokeInvitationAction } from '../actions/invitation-actions';
import {
  correctMemberContactAction,
  removeMemberAction,
  setMemberRoleAction,
  vouchMemberAction,
} from '../actions/member-actions';
import { InviteSharePanel } from './invite-share-panel';

export type MemberListItem = {
  id: string;
  role: string;
  status: string;
  payoutPosition: number | null;
  joinedAt: string | null;
  fullName: string | null;
  email: string | null;
  phone?: string | null;
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
  inviteCode?: string | null;
};

const OFFICER_ROLES = ['member', 'secretary', 'treasurer', 'chair', 'circle_admin'] as const;

function memberInitials(member: MemberListItem) {
  const label = member.fullName ?? member.email ?? member.phone ?? 'M';
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export function MembersList({
  members,
  slug,
  canManage,
  canRecordPayments = false,
}: {
  members: MemberListItem[];
  slug: string;
  canManage: boolean;
  canRecordPayments?: boolean;
}) {
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {members.map((member) => {
        const isGone = member.status === 'removed' || member.status === 'left';
        const displayName = member.fullName ?? member.email ?? member.phone ?? 'Member';
        return (
          <li
            key={member.id}
            className="rounded-xl border border-border/70 bg-card/80 px-4 py-4 shadow-sm transition-colors hover:border-primary/20 sm:px-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                  {memberInitials(member)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{displayName}</p>
                    {member.memberCode ? (
                      <span className="rounded-md border border-border/80 bg-secondary/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {member.memberCode}
                      </span>
                    ) : null}
                    <StatusBadge status={member.role} />
                    <StatusBadge status={member.status} />
                    {member.vouchStatus ? (
                      <StatusBadge status={`vouch:${member.vouchStatus}`} />
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {member.email ?? member.phone ?? '—'}
                    {member.payoutPosition ? ` · Payout #${member.payoutPosition}` : ''}
                    {member.joinedAt ? ` · Joined ${formatDate(member.joinedAt)}` : ''}
                  </p>
                </div>
              </div>
              {canRecordPayments && !isGone ? (
                <Button asChild size="sm" className="min-h-10 shrink-0 rounded-full px-4">
                  <Link href={`/circles/${slug}/books?view=member&memberId=${member.id}` as Route}>
                    Enter payments
                  </Link>
                </Button>
              ) : null}
            </div>

            {canManage && !isGone ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4">
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

                  <form
                    action={removeMemberAction}
                    onSubmit={(event) => {
                      const label = member.fullName ?? member.phone ?? member.email ?? 'this member';
                      if (!window.confirm(`Remove ${label} from this circle?`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="memberId" value={member.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <Button type="submit" size="sm" variant="destructive">
                      Remove
                    </Button>
                  </form>
                </div>

                <form
                  action={correctMemberContactAction}
                  className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <input type="hidden" name="memberId" value={member.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <Input
                    name="fullName"
                    placeholder="Correct name"
                    defaultValue={member.fullName ?? ''}
                    aria-label={`Correct name for ${member.fullName ?? 'member'}`}
                  />
                  <Input
                    name="phone"
                    placeholder="Correct phone (07… or +254…)"
                    defaultValue={member.phone ?? ''}
                    aria-label={`Correct phone for ${member.fullName ?? 'member'}`}
                  />
                  <Button type="submit" size="sm" variant="outline" className="min-h-10">
                    Save contact
                  </Button>
                </form>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function PendingInvitationsList({
  invitations,
  slug,
  canManage,
  siteUrl,
  circleName,
}: {
  invitations: InvitationListItem[];
  slug: string;
  canManage: boolean;
  siteUrl: string;
  circleName?: string;
}) {
  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending invitations.</p>;
  }

  const origin = siteUrl.replace(/\/$/, '');

  return (
    <ul className="space-y-3">
      {invitations.map((invite) => {
        const inviteUrl = invite.inviteCode
          ? `${origin}/invitations/${invite.inviteCode}`
          : null;
        return (
          <li
            key={invite.id}
            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">
                  {invite.phone ?? invite.email ?? 'Invite'}
                </p>
                <StatusBadge status={invite.status} />
              </div>
              {invite.inviteCode ? (
                <p className="mt-1 font-mono text-sm font-semibold tracking-wide text-foreground">
                  {invite.inviteCode}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-muted-foreground">
                Expires {formatDate(invite.expiresAt)} · Sent {formatDate(invite.createdAt)}
              </p>
            </div>
            {canManage && invite.status === 'pending' ? (
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                {invite.inviteCode && inviteUrl ? (
                  <InviteSharePanel
                    compact
                    inviteUrl={inviteUrl}
                    inviteCode={invite.inviteCode}
                    circleName={circleName}
                  />
                ) : null}
                <form action={revokeInvitationAction}>
                  <input type="hidden" name="invitationId" value={invite.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <Button type="submit" size="sm" variant="outline" className="min-h-11">
                    Revoke
                  </Button>
                </form>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
