import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { getDictionary } from '@/i18n/get-dictionary';
import {
  runAutoFinesAction,
  setCircleAutoFineAction,
} from '@/features/circles/actions/billing-actions';
import { remindInvoicesAction } from '@/features/circles/actions/invoice-actions';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { EmptyState } from '@/features/dashboard/components/empty-state';

export const metadata: Metadata = { title: 'Arrears aging' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

export default async function CircleArrearsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const { dict } = await getDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/arrears`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as {
    id: string;
    name: string;
    slug: string;
    currency: string;
  } | null;
  if (!jamiya) notFound();

  const { data: membership } = await supabase
    .from('members')
    .select('role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership || !OFFICER_ROLES.has((membership as { role: string }).role)) {
    redirect(`/circles/${slug}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fineSettings } = await (supabase as any)
    .from('jamiyas')
    .select('auto_fine_enabled, auto_fine_grace_days')
    .eq('id', jamiya.id)
    .maybeSingle();

  const { data: pack } = await callRpc('circle_arrears_aging', {
    p_jamiya_id: jamiya.id,
  });
  const aging = pack as {
    ok?: boolean;
    currency?: string;
    buckets?: Record<string, number | string>;
    members?: Array<{
      member_id: string;
      member_code: string | null;
      user_id: string;
      outstanding: number | string;
      days_overdue: number;
      open_items: number;
    }>;
  } | null;

  const buckets = aging?.buckets ?? {};
  const currency = aging?.currency ?? jamiya.currency;
  const members = aging?.members ?? [];
  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }>).map((p) => [p.id, p]),
  );

  const settings = fineSettings as {
    auto_fine_enabled?: boolean;
    auto_fine_grace_days?: number;
  } | null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            {dict.officer.arrearsEyebrow}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{dict.officer.arrearsIntro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={remindInvoicesAction}>
            <input type="hidden" name="jamiyaId" value={jamiya.id} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="returnTo" value="arrears" />
            <Button type="submit" size="sm" disabled={!members.length}>
              Remind all (SMS)
            </Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/officer` as Route}>{dict.circle.officerConsole}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/invoices` as Route}>{dict.circle.invoices}</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ['current', dict.officer.bucketCurrent],
            ['d1_7', dict.officer.bucket17],
            ['d8_30', dict.officer.bucket830],
            ['d31_60', dict.officer.bucket3160],
            ['d61_plus', dict.officer.bucket61],
            ['total', dict.officer.bucketTotal],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
              {formatCurrency(Number(buckets[key] ?? 0), currency)}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {dict.officer.autoFineTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{dict.officer.autoFineIntro}</p>
        <form action={setCircleAutoFineAction} className="space-y-3">
          <input type="hidden" name="jamiyaId" value={jamiya.id} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="enabled" value="false" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              value="true"
              defaultChecked={Boolean(settings?.auto_fine_enabled)}
            />
            {dict.officer.autoFineEnable}
          </label>
          <div className="space-y-1">
            <Label htmlFor="graceDays">{dict.officer.graceDays}</Label>
            <Input
              id="graceDays"
              name="graceDays"
              type="number"
              min={0}
              max={90}
              defaultValue={Number(settings?.auto_fine_grace_days ?? 3)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              {dict.officer.saveAutoFine}
            </Button>
          </div>
        </form>
        <form action={runAutoFinesAction}>
          <input type="hidden" name="jamiyaId" value={jamiya.id} />
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" size="sm" variant="outline">
            {dict.officer.runAutoFinesNow}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {dict.officer.memberArrears}
        </h2>
        {!members.length ? (
          <div className="space-y-3">
            <EmptyState
              title={dict.officer.noArrears}
              description="All members are current. Use invoices or treasury for related books."
              actionLabel={dict.circle.invoices}
              actionHref={`/circles/${slug}/invoices` as Route}
            />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/circles/${slug}/treasury` as Route}>{dict.circle.treasury}</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/circles/${slug}/officer` as Route}>{dict.circle.officerConsole}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {members.map((row) => {
              const profile = profileMap.get(row.user_id);
              return (
                <li
                  key={row.member_id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {profile?.full_name ?? profile?.email ?? row.member_code ?? row.member_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.open_items} {dict.officer.openItems} · {row.days_overdue}d{' '}
                      {dict.officer.overdue}
                      {profile?.phone ? ` · ${profile.phone}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {formatCurrency(Number(row.outstanding), currency)}
                    </p>
                    <form action={remindInvoicesAction}>
                      <input type="hidden" name="jamiyaId" value={jamiya.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="userId" value={row.user_id} />
                      <input type="hidden" name="returnTo" value="arrears" />
                      <Button type="submit" size="sm" variant="outline">
                        Remind
                      </Button>
                    </form>
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/circles/${slug}/statement?memberId=${row.member_id}` as Route}
                      >
                        Statement
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
