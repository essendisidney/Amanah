import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import {
  allocateDividendAction,
  payDividendAction,
  recordSharePurchaseAction,
  updateShareParValueAction,
} from '@/features/circles/actions/shares-actions';

export const metadata: Metadata = { title: 'Shares & dividends' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer']);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

export default async function CircleSharesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/shares`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency, share_par_value, share_currency')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    share_par_value: number | string;
    share_currency: string;
  } | null;
  if (!jamiya) notFound();

  const { data: membershipData } = await supabase
    .from('members')
    .select('id, role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const membership = membershipData as { id: string; role: string } | null;
  if (!membership) notFound();
  const canManage = OFFICER_ROLES.has(membership.role);

  const [{ data: glRaw }, { data: lotsData }, { data: divData }, { data: membersData }, { data: accountsData }] =
    await Promise.all([
      callRpc('circle_gl_pack', { p_jamiya_id: jamiya.id }),
      supabase
        .from('circle_share_lots')
        .select('id, member_id, shares, unit_price, amount, currency, purchased_on, notes')
        .eq('jamiya_id', jamiya.id)
        .order('purchased_on', { ascending: false })
        .limit(50),
      supabase
        .from('circle_dividends')
        .select('id, label, total_amount, currency, status, declared_at, period_start, period_end')
        .eq('jamiya_id', jamiya.id)
        .order('declared_at', { ascending: false })
        .limit(20),
      supabase
        .from('members')
        .select('id, member_code, user_id, status')
        .eq('jamiya_id', jamiya.id)
        .in('status', ['active', 'suspended'])
        .order('created_at'),
      supabase
        .from('circle_bank_accounts')
        .select('id, name')
        .eq('jamiya_id', jamiya.id)
        .eq('is_active', true)
        .order('name'),
    ]);

  const gl = glRaw as {
    ok?: boolean;
    balance_sheet?: { equity_liabilities?: { share_capital?: number } };
    share_register?: Array<{ member_id: string; shares: number; amount: number }>;
  } | null;

  const memberRows = (membersData ?? []) as Array<{
    id: string;
    member_code: string | null;
    user_id: string;
  }>;
  const userIds = memberRows.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (p) => [p.id, p],
    ),
  );
  const labelFor = (memberId: string) => {
    const m = memberRows.find((row) => row.id === memberId);
    if (!m) return memberId.slice(0, 8);
    const p = profileMap.get(m.user_id);
    return `${p?.full_name || p?.email || m.id.slice(0, 8)}${
      m.member_code ? ` (${m.member_code})` : ''
    }`;
  };

  const today = new Date().toISOString().slice(0, 10);
  const shareCapital = Number(gl?.balance_sheet?.equity_liabilities?.share_capital ?? 0);
  const currency = jamiya.share_currency || jamiya.currency;
  const bankAccounts = (accountsData ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            Share capital
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Register share purchases and allocate dividends, profits, and equity for investment
            groups.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/treasury` as Route}>Treasury</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/statement` as Route}>My statement</Link>
          </Button>
          {canManage ? (
            <Button asChild size="sm">
              <Link href={`/circles/${slug}/books` as Route}>Member payments</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/report` as Route}>GL reports</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/journal` as Route}>Journal</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/invoices` as Route}>Invoices</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Par value</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatCurrency(Number(jamiya.share_par_value), currency)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Share capital</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(shareCapital, currency)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Holders</p>
          <p className="mt-1 text-2xl font-semibold">{gl?.share_register?.length ?? 0}</p>
        </div>
      </section>

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Settings
          </h2>
          <form
            action={updateShareParValueAction}
            className="flex max-w-md flex-wrap items-end gap-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiya.id} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1">
              <Label htmlFor="shareParValue">Par value ({currency})</Label>
              <Input
                id="shareParValue"
                name="shareParValue"
                type="number"
                min="1"
                step="0.01"
                defaultValue={Number(jamiya.share_par_value)}
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Save
            </Button>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Record share purchase
          </h2>
          <form
            action={recordSharePurchaseAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiya.id} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="memberId">Member</Label>
              <select
                id="memberId"
                name="memberId"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Select…
                </option>
                {memberRows.map((m) => (
                  <option key={m.id} value={m.id}>
                    {labelFor(m.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="shares">Shares</Label>
              <Input id="shares" name="shares" type="number" min="0.0001" step="0.0001" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unitPrice">Unit price (blank = par)</Label>
              <Input id="unitPrice" name="unitPrice" type="number" min="0" step="0.01" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchasedOn">Date</Label>
              <Input id="purchasedOn" name="purchasedOn" type="date" defaultValue={today} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankAccountId">Deposit to account (optional)</Label>
              <select
                id="bankAccountId"
                name="bankAccountId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">— book only —</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Initial capital / top-up" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="min-h-11">
                Record purchase
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Share register
        </h2>
        {!(gl?.share_register?.length) ? (
          <EmptyState
            title="No shares recorded yet"
            description={
              canManage
                ? 'Record the first share purchase above to open the register.'
                : 'Ask an officer to record share purchases for this circle.'
            }
            actionLabel={canManage ? 'Open treasury' : 'Back to circle'}
            actionHref={
              (canManage
                ? `/circles/${slug}/treasury`
                : `/circles/${slug}`) as Route
            }
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {gl.share_register.map((row) => (
              <li
                key={row.member_id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <p className="font-medium">{labelFor(row.member_id)}</p>
                <p className="text-sm font-semibold">
                  {Number(row.shares).toLocaleString()} shares
                  <span className="block text-xs font-normal text-muted-foreground">
                    {formatCurrency(Number(row.amount), currency)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Recent lots
        </h2>
        {!(lotsData as unknown[] | null)?.length ? (
          <EmptyState
            title="No purchase lots yet"
            description={
              canManage
                ? 'Each recorded purchase creates a lot for audit and dividends.'
                : 'Share lots appear after an officer records purchases.'
            }
            actionLabel="Back to circle"
            actionHref={`/circles/${slug}` as Route}
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {((lotsData ?? []) as Array<Record<string, unknown>>).map((lot) => (
              <li
                key={String(lot.id)}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <div>
                  <p className="font-medium">{labelFor(String(lot.member_id))}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(String(lot.purchased_on))} · {Number(lot.shares)} @{' '}
                    {formatCurrency(Number(lot.unit_price), String(lot.currency))}
                    {lot.notes ? ` · ${lot.notes}` : ''}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatCurrency(Number(lot.amount), String(lot.currency))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Allocate dividend
          </h2>
          <p className="text-sm text-muted-foreground">
            Splits the pool by each member’s share holdings (pro‑rata).
          </p>
          <form
            action={allocateDividendAction}
            className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
          >
            <input type="hidden" name="jamiyaId" value={jamiya.id} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" required placeholder="FY2025 dividend" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="totalAmount">Total pool ({currency})</Label>
              <Input id="totalAmount" name="totalAmount" type="number" min="1" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="periodStart">Period start</Label>
              <Input id="periodStart" name="periodStart" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="periodEnd">Period end</Label>
              <Input id="periodEnd" name="periodEnd" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="divNotes">Notes</Label>
              <Input id="divNotes" name="notes" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Allocate</Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Dividend history
        </h2>
        {!(divData as unknown[] | null)?.length ? (
          <p className="text-sm text-muted-foreground">No dividends declared yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {((divData ?? []) as Array<Record<string, unknown>>).map((d) => (
              <li key={String(d.id)} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{String(d.label)}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(d.status)} · {formatDate(String(d.declared_at))}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(Number(d.total_amount), String(d.currency))}
                  </p>
                </div>
                {canManage && String(d.status) === 'allocated' ? (
                  bankAccounts.length > 0 ? (
                    <form action={payDividendAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="dividendId" value={String(d.id)} />
                      <div className="space-y-1">
                        <Label htmlFor={`payAcct-${String(d.id)}`}>Pay from account</Label>
                        <select
                          id={`payAcct-${String(d.id)}`}
                          name="bankAccountId"
                          required
                          className="h-11 min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm"
                          defaultValue={bankAccounts[0]?.id ?? ''}
                        >
                          {bankAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button type="submit" size="sm" className="min-h-11">
                        Pay to Money
                      </Button>
                    </form>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Add a treasury bank account first, then pay this dividend.{' '}
                      <Link
                        href={`/circles/${slug}/treasury` as Route}
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        Open treasury
                      </Link>
                    </p>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
