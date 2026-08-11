import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { revalidatePath } from 'next/cache';
import {
  scheduleMeetingAction,
  updateMeetingStatusAction,
} from '@/features/circles/actions/meeting-actions';

export const metadata: Metadata = { title: 'Circle chat & meetings' };
export const dynamic = 'force-dynamic';

async function postMessageAction(formData: FormData) {
  'use server';
  const slug = String(formData.get('slug') ?? '');
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!jamiyaId || body.length < 1) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('circle_messages').insert({
    jamiya_id: jamiyaId,
    sender_id: user.id,
    body,
  } as never);
  revalidatePath(`/circles/${slug}/community`);
}

async function requestGraceAction(formData: FormData) {
  'use server';
  const slug = String(formData.get('slug') ?? '');
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const contributionId = String(formData.get('contributionId') ?? '');
  const days = Number(formData.get('days') ?? 3);
  const reason = String(formData.get('reason') ?? '');
  if (!jamiyaId || !contributionId) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('grace_period_requests').insert({
    jamiya_id: jamiyaId,
    contribution_id: contributionId,
    requester_id: user.id,
    requested_days: days,
    reason: reason || null,
  } as never);
  revalidatePath(`/circles/${slug}/community`);
}

async function decideGraceAction(formData: FormData) {
  'use server';
  const slug = String(formData.get('slug') ?? '');
  const requestId = String(formData.get('requestId') ?? '');
  const approve = String(formData.get('approve') ?? '') === '1';
  await callRpc('decide_grace_request', { p_request_id: requestId, p_approve: approve });
  revalidatePath(`/circles/${slug}/community`);
}

type Props = { params: Promise<{ slug: string }> };

export default async function CircleCommunityPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <p className="text-muted-foreground">Sign in to view circle community.</p>;
  }

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!jamiya) {
    return <p className="text-muted-foreground">Circle not found.</p>;
  }

  const j = jamiya as { id: string; name: string; slug: string };

  const [{ data: messages }, { data: meetings }, { data: grace }, { data: dues }] =
    await Promise.all([
      supabase
        .from('circle_messages')
        .select('id, body, created_at, sender_id')
        .eq('jamiya_id', j.id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('circle_meetings')
        .select('id, title, location, starts_at, status')
        .eq('jamiya_id', j.id)
        .order('starts_at', { ascending: true })
        .limit(20),
      supabase
        .from('grace_period_requests')
        .select('id, status, requested_days, reason, contribution_id, requester_id')
        .eq('jamiya_id', j.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('contributions')
        .select('id, cycle_number, due_date, status, members!inner(user_id)')
        .eq('jamiya_id', j.id)
        .eq('members.user_id', user.id)
        .in('status', ['pending', 'late'])
        .limit(10),
    ]);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Community</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {j.name}
        </h1>
        <p className="mt-2 text-muted-foreground">Chat, meetings, and grace requests.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/elections` as Route}>Elections</Link>
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Chat</h2>
        <form action={postMessageAction} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="jamiyaId" value={j.id} />
          <Textarea name="body" required maxLength={2000} placeholder="Message your circle…" />
          <Button type="submit" size="sm">Send</Button>
        </form>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {((messages ?? []) as Array<{ id: string; body: string; created_at: string }>).map(
            (m) => (
              <li key={m.id} className="px-4 py-3 text-sm">
                <p>{m.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Meetings</h2>
        <form action={scheduleMeetingAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="jamiyaId" value={j.id} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Monthly chama meeting" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startsAt">Starts</Label>
            <Input id="startsAt" name="startsAt" type="datetime-local" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endsAt">Ends (optional)</Label>
            <Input id="endsAt" name="endsAt" type="datetime-local" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location / link</Label>
            <Input id="location" name="location" placeholder="Hall, Zoom, phone…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Agenda / notes</Label>
            <Input id="notes" name="notes" placeholder="Optional" />
          </div>
          <Button type="submit" className="min-h-11 w-full sm:col-span-2 sm:w-fit">
            Schedule meeting
          </Button>
        </form>
        <ul className="space-y-2 text-sm">
          {((meetings ?? []) as Array<{
            id: string;
            title: string;
            location: string | null;
            starts_at: string;
            status: string;
          }>).map((m) => (
            <li key={m.id} className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="font-medium">{m.title}</p>
              <p className="text-muted-foreground">
                {new Date(m.starts_at).toLocaleString()}
                {m.location ? ` · ${m.location}` : ''} · {m.status}
              </p>
              {m.status === 'scheduled' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={updateMeetingStatusAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="meetingId" value={m.id} />
                    <input type="hidden" name="status" value="completed" />
                    <Button type="submit" size="sm">
                      Mark completed
                    </Button>
                  </form>
                  <form action={updateMeetingStatusAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="meetingId" value={m.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <Button type="submit" size="sm" variant="outline">
                      Cancel
                    </Button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Grace period
        </h2>
        <form action={requestGraceAction} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="jamiyaId" value={j.id} />
          <div className="space-y-2">
            <Label htmlFor="contributionId">Your due contribution</Label>
            <select
              id="contributionId"
              name="contributionId"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select…</option>
              {((dues ?? []) as Array<{ id: string; cycle_number: number; due_date: string }>).map(
                (c) => (
                  <option key={c.id} value={c.id}>
                    Cycle {c.cycle_number} · due {c.due_date}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="days">Days requested</Label>
            <Input id="days" name="days" type="number" min={1} max={14} defaultValue={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" name="reason" />
          </div>
          <Button type="submit" size="sm">Request grace</Button>
        </form>
        <ul className="space-y-2 text-sm">
          {((grace ?? []) as Array<{
            id: string;
            status: string;
            requested_days: number;
            reason: string | null;
          }>).map((g) => (
            <li key={g.id} className="rounded-lg border border-border bg-card px-4 py-3">
              <p>
                {g.requested_days} days · {g.status}
              </p>
              {g.reason ? <p className="text-muted-foreground">{g.reason}</p> : null}
              {g.status === 'pending' ? (
                <div className="mt-2 flex gap-2">
                  <form action={decideGraceAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="requestId" value={g.id} />
                    <input type="hidden" name="approve" value="1" />
                    <Button type="submit" size="sm">Approve</Button>
                  </form>
                  <form action={decideGraceAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="requestId" value={g.id} />
                    <input type="hidden" name="approve" value="0" />
                    <Button type="submit" size="sm" variant="outline">Reject</Button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
