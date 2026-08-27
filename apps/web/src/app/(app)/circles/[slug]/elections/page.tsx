import type { Metadata } from 'next';
import { AppPage } from '@/components/app-page';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatDate } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import {
  castVoteAction,
  closeElectionAction,
  nominateCandidateAction,
  openElectionAction,
} from '@/features/circles/actions/election-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { EmptyState } from '@/features/dashboard/components/empty-state';

export const metadata: Metadata = { title: 'Circle elections' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

const SEATS = [
  { value: 'chair', label: 'Chair' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'circle_admin', label: 'Circle admin' },
] as const;

export default async function CircleElectionsPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/elections`);

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!jamiya) notFound();
  const j = jamiya as { id: string; name: string; slug: string };

  const [{ data: membership }, { data: members }, { data: elections }] = await Promise.all([
    supabase
      .from('members')
      .select('id, role, status')
      .eq('jamiya_id', j.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('members')
      .select('id, role, status, profiles(full_name, email)')
      .eq('jamiya_id', j.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
    supabase
      .from('circle_elections')
      .select('id, title, seat_role, status, closes_at, winner_member_id, created_at')
      .eq('jamiya_id', j.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const myMembership = membership as { id: string; role: string; status: string } | null;
  const canManage =
    myMembership?.status === 'active' &&
    ['circle_admin', 'chair', 'secretary'].includes(myMembership.role);

  type MemberRow = {
    id: string;
    role: string;
    profiles: { full_name: string | null; email: string | null } | null;
  };
  const memberRows = (members ?? []) as unknown as MemberRow[];
  const memberLabel = (id: string) => {
    const m = memberRows.find((row) => row.id === id);
    return m?.profiles?.full_name || m?.profiles?.email || 'Member';
  };

  type ElectionRow = {
    id: string;
    title: string;
    seat_role: string;
    status: string;
    closes_at: string | null;
    winner_member_id: string | null;
  };
  const electionRows = (elections ?? []) as unknown as ElectionRow[];

  const electionIds = electionRows.map((e) => e.id);
  const [{ data: candidates }, { data: myVotes }] = await Promise.all([
    electionIds.length
      ? supabase
          .from('circle_election_candidates')
          .select('id, election_id, member_id')
          .in('election_id', electionIds)
      : Promise.resolve({ data: [] as unknown[] }),
    myMembership && electionIds.length
      ? supabase
          .from('circle_votes')
          .select('election_id, candidate_id')
          .eq('voter_member_id', myMembership.id)
          .in('election_id', electionIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  type Cand = { id: string; election_id: string; member_id: string };
  const candRows = (candidates ?? []) as unknown as Cand[];
  const voteMap = new Map(
    ((myVotes ?? []) as Array<{ election_id: string; candidate_id: string }>).map((v) => [
      v.election_id,
      v.candidate_id,
    ]),
  );

  return (
    <AppPage>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Governance</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Elections · {j.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Nominate and vote for chair, treasurer, secretary, or circle admin.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/community` as Route}>Meetings</Link>
          </Button>
        </div>
      </div>

      {canManage ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Open an election
          </h2>
          <form action={openElectionAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="jamiyaId" value={j.id} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="2026 Chair election" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seatRole">Seat</Label>
              <select
                id="seatRole"
                name="seatRole"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="chair"
              >
                {SEATS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closesAt">Closes (optional)</Label>
              <Input id="closesAt" name="closesAt" type="datetime-local" />
            </div>
            <Button type="submit" className="min-h-11 sm:col-span-2 sm:w-fit">
              Open election
            </Button>
          </form>
        </section>
      ) : null}

      <section className="space-y-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Active & recent
        </h2>
        {!electionRows.length ? (
          canManage ? (
            <EmptyState
              title="No elections yet"
              description="Open an election above to nominate and vote for chair, treasurer, secretary, or circle admin."
              actionLabel="Open community"
              actionHref={`/circles/${slug}/community` as Route}
            />
          ) : (
            <EmptyState
              title="No elections yet"
              description="Officers open elections for circle seats. Check Community for meetings, or return to the circle hub."
              actionLabel="Open community"
              actionHref={`/circles/${slug}/community` as Route}
            />
          )
        ) : (
          electionRows.map((election) => {
            const cands = candRows.filter((c) => c.election_id === election.id);
            const myVote = voteMap.get(election.id);
            return (
              <article
                key={election.id}
                className="space-y-4 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{election.title}</h3>
                      <StatusBadge status={election.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Seat: {election.seat_role.replace('_', ' ')}
                      {election.closes_at
                        ? ` · closes ${formatDate(election.closes_at)}`
                        : ''}
                    </p>
                    {election.winner_member_id ? (
                      <p className="mt-1 text-sm text-primary">
                        Winner: {memberLabel(election.winner_member_id)}
                      </p>
                    ) : null}
                  </div>
                  {canManage && election.status === 'open' ? (
                    <form action={closeElectionAction}>
                      <input type="hidden" name="electionId" value={election.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <Button type="submit" size="sm" variant="outline" className="min-h-11">
                        Close & elect
                      </Button>
                    </form>
                  ) : null}
                </div>

                {election.status === 'open' && canManage ? (
                  <form action={nominateCandidateAction} className="flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="electionId" value={election.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <select
                      name="memberId"
                      required
                      className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Nominate member…
                      </option>
                      {memberRows.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.profiles?.full_name || m.profiles?.email || m.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" className="min-h-11">
                      Nominate
                    </Button>
                  </form>
                ) : null}

                <ul className="space-y-2">
                  {cands.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
                    >
                      <span className="text-sm font-medium">{memberLabel(c.member_id)}</span>
                      {election.status === 'open' && myMembership?.status === 'active' ? (
                        <form action={castVoteAction}>
                          <input type="hidden" name="electionId" value={election.id} />
                          <input type="hidden" name="candidateId" value={c.id} />
                          <input type="hidden" name="slug" value={slug} />
                          <Button
                            type="submit"
                            size="sm"
                            className="min-h-11"
                            variant={myVote === c.id ? 'default' : 'outline'}
                          >
                            {myVote === c.id ? 'Your vote' : 'Vote'}
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                  {!cands.length ? (
                    <li className="text-sm text-muted-foreground">
                      {election.status === 'open'
                        ? canManage
                          ? 'No candidates yet. Nominate a member above.'
                          : 'Waiting for nominations.'
                        : 'No candidates were nominated.'}
                    </li>
                  ) : null}
                </ul>
              </article>
            );
          })
        )}
      </section>
    
    </AppPage>
  );
}
