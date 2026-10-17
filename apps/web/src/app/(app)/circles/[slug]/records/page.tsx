import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { AppPage } from '@/components/app-page';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { CircleRecordForm } from '@/features/circles/components/circle-record-form';
import {
  deleteCircleRecordAction,
  publishCircleRecordAction,
} from '@/features/circles/actions/record-actions';

export const metadata: Metadata = { title: 'Minutes & resolutions' };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

type RecordRow = {
  id: string;
  kind: 'minutes' | 'resolution';
  title: string;
  body: string;
  record_date: string;
  status: 'draft' | 'published';
  file_path: string | null;
  file_name: string | null;
  published_at: string | null;
  meeting_id: string | null;
};

const KEEPER_ROLES = ['secretary', 'chair', 'circle_admin'];

export default async function CircleRecordsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/records`);

  const { data: jamiya } = await supabase.from('jamiyas').select('id, name').eq('slug', slug).maybeSingle();
  if (!jamiya) redirect('/circles');
  const j = jamiya as { id: string; name: string };

  // circle_records is newer than the generated types.
  const db = supabase as unknown as SupabaseClient;
  const [{ data: me }, { data: records }, { data: meetings }] = await Promise.all([
    supabase
      .from('members')
      .select('role')
      .eq('jamiya_id', j.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    db
      .from('circle_records')
      .select('id, kind, title, body, record_date, status, file_path, file_name, published_at, meeting_id')
      .eq('jamiya_id', j.id)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('circle_meetings')
      .select('id, title, starts_at')
      .eq('jamiya_id', j.id)
      .order('starts_at', { ascending: false })
      .limit(30),
  ]);
  const canKeep = KEEPER_ROLES.includes(String((me as { role?: string } | null)?.role ?? ''));
  const rows = (records ?? []) as unknown as RecordRow[];
  const meetingRows = (meetings ?? []) as Array<{ id: string; title: string; starts_at: string }>;
  const meetingTitle = new Map(meetingRows.map((m) => [m.id, m.title]));

  // Members read files through short-lived links; the bucket is private to the circle.
  const links = new Map<string, string>();
  await Promise.all(
    rows
      .filter((r) => r.file_path)
      .map(async (r) => {
        const { data } = await supabase.storage.from('circle-records').createSignedUrl(r.file_path!, 3600);
        if (data?.signedUrl) links.set(r.id, data.signedUrl);
      }),
  );

  return (
    <AppPage>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Records</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {j.name}: minutes &amp; resolutions
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          What the circle met about and decided, kept in one place. The secretary, chair or circle
          admin posts them; every member can read them. Published records cannot be changed.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/community` as Route}>Chat &amp; meetings</Link>
          </Button>
        </div>
      </div>

      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      {canKeep ? (
        <CircleRecordForm
          jamiyaId={j.id}
          slug={slug}
          meetings={meetingRows.map((m) => ({ id: m.id, label: `${m.title} · ${formatDate(m.starts_at)}` }))}
        />
      ) : null}

      <section className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No minutes or resolutions yet.</p>
        ) : (
          rows.map((r) => (
            <article key={r.id} className="jameiyah-surface space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{r.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {r.kind === 'minutes' ? 'Minutes' : 'Resolution'} · {formatDate(r.record_date)}
                  {r.meeting_id && meetingTitle.get(r.meeting_id) ? ` · ${meetingTitle.get(r.meeting_id)}` : ''}
                  {r.status === 'draft' ? ' · Draft (only record keepers see this)' : ''}
                </p>
              </div>
              {r.body ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p> : null}
              {links.get(r.id) ? (
                <a
                  href={links.get(r.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Open {r.file_name ?? 'attached file'}
                </a>
              ) : null}
              {canKeep && r.status === 'draft' ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <form action={publishCircleRecordAction}>
                    <input type="hidden" name="recordId" value={r.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <Button type="submit" size="sm">
                      Publish to members
                    </Button>
                  </form>
                  <form action={deleteCircleRecordAction}>
                    <input type="hidden" name="recordId" value={r.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <Button type="submit" size="sm" variant="outline">
                      Delete draft
                    </Button>
                  </form>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
    </AppPage>
  );
}
