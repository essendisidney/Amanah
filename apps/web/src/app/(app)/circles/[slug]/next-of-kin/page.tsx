import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@jamiya/ui';
import { AppPage } from '@/components/app-page';
import { createClient } from '@/lib/supabase/server';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { NextOfKinForm } from '@/features/circles/components/next-of-kin-form';
import { deleteMemberNextOfKinAction } from '@/features/circles/actions/next-of-kin-actions';

export const metadata: Metadata = { title: 'Next of kin' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

function relationshipLabel(value: string) {
  const map: Record<string, string> = {
    spouse: 'Spouse',
    parent: 'Parent',
    sibling: 'Sibling',
    child: 'Child',
    guardian: 'Guardian',
    friend: 'Friend',
    other: 'Other',
  };
  return map[value] ?? value;
}

export default async function NextOfKinPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/next-of-kin`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, challenge_kind')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as {
    id: string;
    name: string;
    slug: string;
    challenge_kind: string | null;
  } | null;
  if (!jamiya) notFound();

  const { data: myMemberData } = await supabase
    .from('members')
    .select('id, role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const me = myMemberData as { id: string; role: string; status: string } | null;
  if (!me || me.status !== 'active') notFound();

  const isOfficer = OFFICER_ROLES.has(me.role);

  const { data: membersData } = await supabase
    .from('members')
    .select('id, user_id, member_code, status')
    .eq('jamiya_id', jamiya.id)
    .in('status', ['active', 'pending', 'suspended'])
    .order('joined_at', { ascending: true });

  const members = (membersData ?? []) as Array<{
    id: string;
    user_id: string;
    member_code: string | null;
    status: string;
  }>;

  const userIds = members.map((m) => m.user_id);
  const [{ data: profiles }, { data: kinRows }] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('member_next_of_kin')
      .select('id, member_id, full_name, phone, relationship, notes')
      .eq('jamiya_id', jamiya.id)
      .order('updated_at', { ascending: false }),
  ]);

  const profileMap = new Map(
    (
      (profiles ?? []) as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
      }>
    ).map((p) => [p.id, p]),
  );

  const memberOptions = members.map((m) => {
    const p = profileMap.get(m.user_id);
    return {
      id: m.id,
      label:
        p?.full_name || p?.phone || p?.email || m.member_code || m.id.slice(0, 8),
    };
  });

  const kinList = (
    (kinRows ?? []) as Array<{
      id: string;
      member_id: string;
      full_name: string;
      phone: string | null;
      relationship: string;
      notes: string | null;
    }>
  ).map((row) => {
    const member = members.find((m) => m.id === row.member_id);
    const profile = member ? profileMap.get(member.user_id) : null;
    return {
      ...row,
      memberLabel:
        profile?.full_name ||
        profile?.phone ||
        profile?.email ||
        member?.member_code ||
        'Member',
    };
  });

  const existing = kinList.map((k) => ({
    memberId: k.member_id,
    fullName: k.full_name,
    phone: k.phone,
    relationship: k.relationship,
    notes: k.notes,
  }));

  const kindLabel =
    jamiya.challenge_kind === 'share_dividend'
      ? 'Table banking'
      : jamiya.challenge_kind === 'savings'
        ? 'Savings'
        : 'Merry-go-round';

  return (
    <AppPage>
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            Next of kin · {kindLabel}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Emergency contacts for every member — name, phone, and relationship.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11 rounded-full">
          <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
        </Button>
      </div>

      {isOfficer ? (
        <section className="amanah-surface space-y-3 px-5 py-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Add or update next of kin
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick a member, then save their emergency contact. Saving again updates the same person.
          </p>
          <NextOfKinForm
            jamiyaId={jamiya.id}
            slug={slug}
            members={memberOptions}
            existing={existing}
            returnTo="next-of-kin"
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Recorded ({kinList.length})
        </h2>
        {kinList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No next of kin saved yet
            {isOfficer ? ' — use the form above after adding members.' : '.'}
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/50">
            {kinList.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{row.memberLabel}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Next of kin: <span className="text-foreground">{row.full_name}</span>
                    {' · '}
                    {relationshipLabel(row.relationship)}
                    {row.phone ? ` · ${row.phone}` : ''}
                  </p>
                  {row.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>
                  ) : null}
                </div>
                {isOfficer ? (
                  <form action={deleteMemberNextOfKinAction}>
                    <input type="hidden" name="jamiyaId" value={jamiya.id} />
                    <input type="hidden" name="memberId" value={row.member_id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="returnTo" value="next-of-kin" />
                    <Button type="submit" variant="outline" size="sm" className="min-h-10">
                      Remove
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppPage>
  );
}
