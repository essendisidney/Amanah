import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatDate } from '@jamiya/shared';
import { Alert, AlertDescription, Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { hashInvitationToken } from '@/features/jamiya/lib/invitation-token';
import { InvitationDecisionButtons } from '@/features/jamiya/components/invitation-decision-buttons';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = {
  title: 'Invitation',
};

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/invitations/${encodeURIComponent(token)}`);
  }

  const tokenHash = hashInvitationToken(token);
  const { data, error } = await callRpc('preview_invitation', {
    p_token_hash: tokenHash,
  });

  const rows = (data ?? []) as unknown as Array<{
    invitation_id: string;
    jamiya_id: string;
    jamiya_name: string;
    jamiya_slug: string;
    status: string;
    email: string | null;
    phone: string | null;
    expires_at: string;
    invited_by_name: string | null;
  }>;

  const preview = rows[0];

  if (error || !preview) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10">
        <Alert variant="destructive">
          <AlertDescription>
            This invitation link is invalid or no longer available.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href={'/dashboard' as Route}>Go to dashboard</Link>
        </Button>
      </div>
    );
  }

  const isPending = preview.status === 'pending';
  const isExpired = new Date(preview.expires_at).getTime() < Date.now();

  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          Invitation
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Join {preview.jamiya_name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Invited by {preview.invited_by_name ?? 'a circle admin'}
          {preview.email ? ` · ${preview.email}` : ''}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={preview.status} />
          {isExpired && isPending ? <StatusBadge status="expired" /> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Expires {formatDate(preview.expires_at)}
        </p>
      </div>

      {isPending && !isExpired ? (
        <InvitationDecisionButtons token={token} />
      ) : (
        <Alert>
          <AlertDescription>
            {isExpired
              ? 'This invitation has expired. Ask the circle admin for a new link.'
              : `This invitation is ${preview.status.replaceAll('_', ' ')}.`}
          </AlertDescription>
        </Alert>
      )}

      <Button asChild variant="outline">
        <Link href={'/dashboard' as Route}>Back to dashboard</Link>
      </Button>
    </div>
  );
}
