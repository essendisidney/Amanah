import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Alert, AlertDescription, Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { invitationRpcArgs } from '@/features/circles/lib/invitation-token';
import { InvitationDecisionButtons } from '@/features/circles/components/invitation-decision-buttons';
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
    redirect(`/phone?next=${encodeURIComponent(`/invitations/${token}`)}`);
  }

  const { data, error } = await callRpc(
    'preview_invitation',
    invitationRpcArgs(token),
  );

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

  const { data: circleData } = await supabase
    .from('jamiyas')
    .select(
      'contribution_amount, currency, contribution_frequency_days, member_count, max_members, status',
    )
    .eq('id', preview.jamiya_id)
    .maybeSingle();

  const circle = circleData as {
    contribution_amount: number | string;
    currency: string;
    contribution_frequency_days: number;
    member_count: number;
    max_members: number;
    status: string;
  } | null;

  const contributionAmount =
    circle &&
    (typeof circle.contribution_amount === 'number'
      ? circle.contribution_amount
      : Number(circle.contribution_amount));

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

      <div className="amanah-surface space-y-4 px-5 py-5">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={preview.status} />
          {circle?.status ? <StatusBadge status={circle.status} /> : null}
          {isExpired && isPending ? <StatusBadge status="expired" /> : null}
        </div>

        {circle && Number.isFinite(contributionAmount) ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contribution
              </dt>
              <dd className="amanah-money mt-1 font-semibold">
                {formatCurrency(contributionAmount as number, circle.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Every
              </dt>
              <dd className="mt-1 font-semibold">
                {circle.contribution_frequency_days} days
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Members
              </dt>
              <dd className="mt-1 font-semibold">
                {circle.member_count}/{circle.max_members}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Expires
              </dt>
              <dd className="mt-1 font-semibold">{formatDate(preview.expires_at)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Expires {formatDate(preview.expires_at)}
          </p>
        )}
      </div>

      {isPending && !isExpired ? (
        <InvitationDecisionButtons token={token} />
      ) : (
        <Alert>
          <AlertDescription>
            {isExpired
              ? 'This invitation has expired. Ask the circle admin for a new link.'
              : preview.status === 'accepted'
                ? 'You already joined this circle. Open it from My circles.'
                : `This invitation is ${preview.status.replaceAll('_', ' ')}.`}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {preview.status === 'accepted' && preview.jamiya_slug ? (
          <Button asChild>
            <Link href={`/circles/${preview.jamiya_slug}` as Route}>Open circle</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={'/circles' as Route}>My circles</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={'/dashboard' as Route}>Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
