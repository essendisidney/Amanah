'use client';

import { AddMemberForm } from './add-member-form';
import { BulkPhoneInviteForm } from './bulk-phone-invite-form';
import { InviteMemberForm } from './invite-member-form';

/** One place to add people: create account, bulk phones, or share a join link. */
export function AddPeoplePanel({
  jamiyaId,
  circleName,
}: {
  jamiyaId: string;
  circleName: string;
}) {
  return (
    <div className="space-y-4">
      <AddMemberForm jamiyaId={jamiyaId} circleName={circleName} />

      <details className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          Paste many phones at once
        </summary>
        <div id="bulk-invite" className="mt-4">
          <BulkPhoneInviteForm jamiyaId={jamiyaId} circleName={circleName} />
        </div>
      </details>

      <details className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          Share join link / invite code
        </summary>
        <div className="mt-4">
          <InviteMemberForm jamiyaId={jamiyaId} circleName={circleName} />
        </div>
      </details>
    </div>
  );
}
