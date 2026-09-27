export type OwnInvitation = {
  jamiya_id: string;
  invite_code: string | null;
  invitee_user_id: string | null;
  email: string | null;
};

/** Open the invite preview. Rejects anything that is not a single path segment. */
export function invitationJoinHref(inviteCode: string | null | undefined): string | null {
  const code = inviteCode?.trim() ?? '';
  if (!code || /[/?#\\\s]/.test(code)) return null;
  return `/invitations/${encodeURIComponent(code)}`;
}

/** The pending code for this person only. Never another member's invite. */
export function ownInviteCode(
  invitations: OwnInvitation[],
  jamiyaId: string,
  user: { id: string; email?: string | null },
): string | null {
  const email = user.email?.trim().toLowerCase() ?? '';
  const match = invitations.find((row) => {
    if (row.jamiya_id !== jamiyaId) return false;
    if (row.invitee_user_id === user.id) return true;
    return Boolean(email) && row.email?.trim().toLowerCase() === email;
  });
  const code = match?.invite_code?.trim() ?? '';
  return code || null;
}
