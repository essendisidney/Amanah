import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { AppPage } from '@/components/app-page';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import {
  cancelCircleExitAction,
  decideCircleExitAction,
  requestCircleExitAction,
  respondShareTransferAction,
} from '@/features/circles/actions/exit-actions';
import {
  exitBlockerMessage,
  exitStatusLabel,
  type CircleExitStatus,
} from '@/features/circles/lib/circle-exit';

export const metadata: Metadata = { title: 'Leaving the circle' };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

type ExitRow = {
  id: string;
  member_id: string;
  user_id: string;
  reason: string;
  transfer_to_member_id: string | null;
  shares: number | string;
  share_amount: number | string;
  status: CircleExitStatus;
  decision_note: string | null;
  created_at: string;
};

const OFFICER_ROLES = ['circle_admin', 'chair', 'treasurer', 'secretary'];
const OPEN: CircleExitStatus[] = ['awaiting_recipient', 'awaiting_approval'];

export default async function LeaveCirclePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/leave`);

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, name, share_currency')
    .eq('slug', slug)
    .maybeSingle();
  if (!jamiya) redirect('/circles');
  const j = jamiya as { id: string; name: string; share_currency: string | null };
  const currency = j.share_currency ?? 'KES';
  const money = (n: number) => formatCurrency(n, currency);

  // circle_exit_requests is newer than the generated types.
  const db = supabase as unknown as SupabaseClient;
  const [{ data: membersData }, { data: exitData }, { data: checkData }] = await Promise.all([
    supabase
      .from('members')
      .select('id, user_id, role, status')
      .eq('jamiya_id', j.id)
      .in('status', ['active', 'left']),
    db
      .from('circle_exit_requests')
      .select('id, member_id, user_id, reason, transfer_to_member_id, shares, share_amount, status, decision_note, created_at')
      .eq('jamiya_id', j.id)
      .order('created_at', { ascending: false })
      .limit(50),
    callRpc('my_circle_exit_check', { p_jamiya_id: j.id }),
  ]);

  const members = (membersData ?? []) as Array<{ id: string; user_id: string | null; role: string; status: string }>;
  const userIds = members.map((m) => m.user_id).filter((id): id is string => Boolean(id));
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const nameOf = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [
      p.id,
      p.full_name || p.email || 'Member',
    ]),
  );
  const memberName = (memberId: string | null) => {
    const m = members.find((row) => row.id === memberId);
    return (m?.user_id && nameOf.get(m.user_id)) || 'A member';
  };

  const me = members.find((m) => m.user_id === user.id && m.status === 'active') ?? null;
  const isOfficer = Boolean(me && OFFICER_ROLES.includes(me.role));
  const check = (checkData ?? null) as
    | { ok?: boolean; blocker?: string | null; shares?: number; share_amount?: number }
    | null;
  const exits = (exitData ?? []) as unknown as ExitRow[];

  const myOpen = exits.find((e) => e.user_id === user.id && OPEN.includes(e.status)) ?? null;
  const myHistory = exits.filter((e) => e.user_id === user.id && !OPEN.includes(e.status)).slice(0, 5);
  const forMe = exits.filter(
    (e) => e.status === 'awaiting_recipient' && e.transfer_to_member_id === me?.id,
  );
  const toApprove = isOfficer ? exits.filter((e) => e.status === 'awaiting_approval' && e.user_id !== user.id) : [];
  const recipients = members.filter((m) => m.status === 'active' && m.id !== me?.id && m.user_id);
  const shares = Number(check?.shares ?? 0);
  const blocker = exitBlockerMessage(check?.blocker);

  return (
    <AppPage>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Membership</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Leaving {j.name}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A member who leaves hands their shares to another member, who must agree. An officer
          then approves. Money in your Jameiyah wallet stays yours.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
          </Button>
        </div>
      </div>

      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      {forMe.map((e) => (
        <section key={e.id} className="jameiyah-surface space-y-3 px-5 py-5">
          <h2 className="text-lg font-semibold">Take over shares?</h2>
          <p className="text-sm">
            {memberName(e.member_id)} is leaving and asked you to take over their{' '}
            {Number(e.shares)} shares ({money(Number(e.share_amount))}). They become yours, with
            their future dividends, once an officer approves. You pay nothing on this screen; agree
            any payment between you directly.
          </p>
          <div className="flex flex-wrap gap-3">
            {['1', '0'].map((accept) => (
              <form key={accept} action={respondShareTransferAction}>
                <input type="hidden" name="requestId" value={e.id} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="accept" value={accept} />
                <Button type="submit" variant={accept === '1' ? 'default' : 'outline'}>
                  {accept === '1' ? 'Take over the shares' : 'Decline'}
                </Button>
              </form>
            ))}
          </div>
        </section>
      ))}

      {toApprove.length > 0 ? (
        <section className="jameiyah-surface space-y-4 px-5 py-5">
          <h2 className="text-lg font-semibold">Requests to leave</h2>
          {toApprove.map((e) => (
            <div key={e.id} className="space-y-2 rounded-xl border border-border p-4">
              <p className="font-medium">{memberName(e.member_id)}</p>
              <p className="text-sm text-muted-foreground">
                Asked {formatDate(e.created_at)}
                {e.reason ? ` · “${e.reason}”` : ''}
                {e.transfer_to_member_id
                  ? ` · ${Number(e.shares)} shares (${money(Number(e.share_amount))}) to ${memberName(e.transfer_to_member_id)}, who agreed`
                  : ' · no shares to transfer'}
              </p>
              <p className="text-xs text-muted-foreground">
                Approving marks them as left, waives their future contributions and cancels their
                scheduled payouts. Check the payout order afterwards.
              </p>
              <form action={decideCircleExitAction} className="space-y-2">
                <input type="hidden" name="requestId" value={e.id} />
                <input type="hidden" name="slug" value={slug} />
                <Textarea name="note" rows={2} maxLength={500} placeholder="Note to the member (optional)" />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" name="approve" value="1">
                    Approve
                  </Button>
                  <Button type="submit" name="approve" value="0" variant="outline">
                    Do not approve
                  </Button>
                </div>
              </form>
            </div>
          ))}
        </section>
      ) : null}

      {me ? (
        <section className="jameiyah-surface space-y-4 px-5 py-5">
          <h2 className="text-lg font-semibold">Your membership</h2>
          {myOpen ? (
            <div className="space-y-3">
              <p className="text-sm">
                You asked to leave on {formatDate(myOpen.created_at)}.{' '}
                <span className="font-semibold">{exitStatusLabel(myOpen.status)}</span>
                {myOpen.transfer_to_member_id
                  ? `. Your ${Number(myOpen.shares)} shares go to ${memberName(myOpen.transfer_to_member_id)}.`
                  : '.'}
              </p>
              <form action={cancelCircleExitAction}>
                <input type="hidden" name="requestId" value={myOpen.id} />
                <input type="hidden" name="slug" value={slug} />
                <Button type="submit" variant="outline">
                  Withdraw my request
                </Button>
              </form>
            </div>
          ) : blocker ? (
            <p className="text-sm">
              <span className="font-semibold">You cannot leave yet.</span> {blocker}
            </p>
          ) : (
            <form action={requestCircleExitAction} className="space-y-4">
              <input type="hidden" name="jamiyaId" value={j.id} />
              <input type="hidden" name="slug" value={slug} />
              {shares > 0 ? (
                <div className="space-y-1">
                  <Label htmlFor="transferToMemberId">
                    Who takes over your {shares} shares ({money(Number(check?.share_amount ?? 0))})?
                  </Label>
                  <select
                    id="transferToMemberId"
                    name="transferToMemberId"
                    required
                    defaultValue=""
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="" disabled>
                      Choose a member
                    </option>
                    {recipients.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberName(m.id)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    They must agree first. Any payment for the shares is agreed between you two.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">You hold no shares in this circle.</p>
              )}
              <div className="space-y-1">
                <Label htmlFor="reason">Why are you leaving? (optional)</Label>
                <Textarea id="reason" name="reason" rows={2} maxLength={500} />
              </div>
              <Button type="submit" variant="destructive">
                Ask to leave the circle
              </Button>
            </form>
          )}
          {myHistory.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {myHistory.map((e) => (
                <li key={e.id}>
                  {formatDate(e.created_at)}: {exitStatusLabel(e.status)}
                  {e.decision_note ? ` · “${e.decision_note}”` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">You are not an active member of this circle.</p>
      )}
    </AppPage>
  );
}
